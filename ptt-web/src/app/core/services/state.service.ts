import { Injectable, inject, computed, signal, effect, untracked } from '@angular/core';
import { Web3Service } from './web3.service';
import { UiStateService } from './ui-state.service';
import { ThemeService } from './theme.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  public readonly web3Service = inject(Web3Service);
  private readonly uiStateService = inject(UiStateService);
  private readonly themeService = inject(ThemeService);
  private readonly toastService = inject(ToastService);
  private readonly apiService = inject(ApiService);

  // ====================================================
  // PTT DAPP STATE SIGNALS
  // ====================================================
  public currentUser = signal<any | null>(null);
  public currentCompany = signal<any | null>(null);
  public userPermissions = signal<string[]>([]);
  public companiesList = signal<any[]>([]);
  public isCompaniesLoading = signal<boolean>(false);

  // Cờ session đã kiểm tra xong (tránh race condition với wallet reconnect)
  private isSessionRestored = signal<boolean>(false);
  private currentLoginRunId = 0;

  // ====================================================
  // DELEGATED UI STATE
  // ====================================================
  public readonly showMobileMenu = this.uiStateService.showMobileMenu;
  public readonly showDropdown = this.uiStateService.showDropdown;
  public readonly showNetworkDropdown = this.uiStateService.showNetworkDropdown;
  public readonly isLoading = this.uiStateService.isLoading;

  // ====================================================
  // DELEGATED THEME STATE
  // ====================================================
  public readonly isDarkMode = this.themeService.isDarkMode;
  public readonly themeMode = this.themeService.themeMode;

  // ====================================================
  // DELEGATED WEB3 STATE
  // ====================================================
  public readonly address = this.web3Service.address;
  public readonly chainId = this.web3Service.chainId;
  public readonly isConnected = this.web3Service.isConnected;
  public readonly balance = this.web3Service.balance;
  public readonly networkName = this.web3Service.networkName;
  
  // Wrong chain check: checking against both system support list and company specific chain lock-in
  public readonly isWrongChain = computed(() => {
    const systemWrongChain = this.web3Service.isWrongChain();
    if (systemWrongChain) return true;

    const connected = this.isConnected();
    const walletChainId = this.chainId();
    const company = this.currentCompany();
    
    if (connected && walletChainId && company && company.chain_id) {
      return Number(walletChainId) !== Number(company.chain_id);
    }
    return false;
  });

  public readonly chainSymbol = this.web3Service.chainSymbol;
  public readonly txSpeed = this.web3Service.txSpeed;
  public readonly gasMultiplier = this.web3Service.gasMultiplier;
  public readonly showWrongChainModal = this.web3Service.showWrongChainModal;
  public readonly POPULAR_CHAINS = this.web3Service.POPULAR_CHAINS;

  // Lấy thông tin mạng lưới (chain) của doanh nghiệp hiện tại
  public readonly currentCompanyChainInfo = computed(() => {
    const company = this.currentCompany();
    if (!company || !company.chain_id) return null;
    return this.POPULAR_CHAINS.find(c => Number(c.chainId) === Number(company.chain_id));
  });

  // Lấy ký hiệu Token Native của doanh nghiệp hiện tại (ví dụ: BNB, tBNB, ETH...)
  public readonly currentCompanyNativeSymbol = computed(() => {
    const info = this.currentCompanyChainInfo();
    return (info as any)?.nativeSymbol || 'BNB';
  });

  // Lọc danh sách chain hiển thị cho người dùng chuyển đổi mạng
  public readonly availableChains = computed(() => {
    const company = this.currentCompany();
    if (company && company.chain_id) {
      const targetChain = this.POPULAR_CHAINS.find(c => Number(c.chainId) === Number(company.chain_id));
      return targetChain ? [targetChain] : this.POPULAR_CHAINS;
    }
    return this.POPULAR_CHAINS;
  });

  public readonly shortenedAddress = computed(() => {
    const addr = this.address();
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  });

  constructor() {
    this.setupAuthSync();
    this.setupWrongChainSync();
    this.checkExistingSession();
  }

  // Tự động kích hoạt hiển thị modal sai mạng khi ví kết nối không đúng mạng của doanh nghiệp
  private setupWrongChainSync() {
    effect(() => {
      const wrong = this.isWrongChain();
      const connected = this.isConnected();
      if (connected && wrong) {
        this.web3Service.showWrongChainModal.set(true);
      } else {
        this.web3Service.showWrongChainModal.set(false);
      }
    }, { allowSignalWrites: true });
  }

  // Tự động đồng bộ luồng login/logout backend khi ví Web3 thay đổi trạng thái
  private setupAuthSync() {
    effect(async (onCleanup) => {
      const connected = this.isConnected();
      const walletAddr = this.address();
      const sessionRestored = this.isSessionRestored();

      // Chờ checkExistingSession hoàn thành trước khi xét login
      // Tránh race condition: ví kết nối lại nhanh hơn session restore
      if (!sessionRestored) return;

      const runId = ++this.currentLoginRunId;

      onCleanup(() => {
        console.log(`[AuthSync] Cleanup runId ${runId} (currentLoginRunId: ${this.currentLoginRunId})`);
      });

      // Sử dụng untracked để tránh effect tự chạy lại khi thay đổi currentUser
      const user = untracked(() => this.currentUser());

      if (connected && walletAddr) {
        if (!user) {
          // Thực hiện login ví Web3
          await this.loginWithWeb3(walletAddr, runId, () => runId === this.currentLoginRunId);
        } else if (user.wallet_address?.toLowerCase() !== walletAddr.toLowerCase()) {
          // Nếu đổi ví trên MetaMask, thực hiện logout ví cũ và tự động login ví mới
          await this.logoutBackend();
          
          if (runId !== this.currentLoginRunId) {
            console.warn(`[AuthSync] Bỏ qua đăng nhập ví mới cho runId ${runId} sau khi logout ví cũ`);
            return;
          }

          await this.loginWithWeb3(walletAddr, runId, () => runId === this.currentLoginRunId);
        }
      } else if (!connected && user) {
        // Thực hiện logout backend
        await this.logoutBackend();
      }
    }, { allowSignalWrites: true });
  }

  // Khôi phục session khi reload trang
  private async checkExistingSession() {
    if (typeof window === 'undefined') {
      this.isSessionRestored.set(true);
      return;
    }

    try {
      // Gọi /auth/me — TokenFromCookieMiddleware tự inject Bearer từ HttpOnly cookie
      // Cookie được gửi tự động qua withCredentials, không cần token trong JS
      const response = await firstValueFrom(this.apiService.get<any>('auth/me'));
      if (response?.user) {
        this.currentUser.set(response.user);
      } else {
        this.currentUser.set(null);
      }
    } catch (e) {
      // Session hết hạn hoặc cookie hết hiệu lực
      this.currentUser.set(null);
    } finally {
      // Luôn tải danh sách công ty để khách vãng lai/người dùng chưa kết nối ví vẫn xem được dữ liệu công khai
      await this.loadCompanies();
      this.isSessionRestored.set(true);
    }
  }

  // Thực hiện luồng Login Web3
  private async loginWithWeb3(walletAddress: string, runId: number, checkValid: () => boolean) {
    this.isLoading.set(true);
    try {
      // 1. Lấy challenge nonce từ API challenge
      const challenge = await firstValueFrom(
        this.apiService.get<any>('auth/challenge', undefined, { address: walletAddress })
      );

      if (!checkValid()) {
        console.warn(`[Auth] Bỏ qua loginWithWeb3 cho runId ${runId} (đã có kết nối mới hoặc thay đổi trạng thái ví)`);
        return;
      }

      // 2. Yêu cầu ví ký thông điệp challenge
      const signer = await this.web3Service.getSigner();
      const signature = await signer.signMessage(challenge.message);

      if (!checkValid()) {
        console.warn(`[Auth] Bỏ qua loginWithWeb3 sau khi ký cho runId ${runId}`);
        return;
      }

      // 3. Gửi signature lên API login
      const response = await firstValueFrom(
        this.apiService.post<any>('auth/login', {
          address: walletAddress,
          message: challenge.message,
          signature: signature
        })
      );

      if (!checkValid()) {
        console.warn(`[Auth] Bỏ qua loginWithWeb3 sau khi login backend cho runId ${runId}`);
        return;
      }

      // 4. Lưu thông tin user — auth qua HttpOnly cookie, không cần token trong JS
      this.currentUser.set(response.user);
      this.showToast('Đăng nhập ví Web3 thành công!', 'success');

      // Tải danh sách công ty
      await this.loadCompanies();
    } catch (error: any) {
      if (checkValid()) {
        console.error('[Auth] Đăng nhập ví Web3 thất bại:', error);
        this.showToast(error.error?.message || 'Chữ ký không hợp lệ hoặc bị từ chối!', 'error');
        // Ngắt kết nối ví nếu login backend lỗi
        await this.disconnectWallet();
      } else {
        console.warn(`[Auth] Bỏ qua lỗi login của runId ${runId} vì lượt chạy không còn hiệu lực:`, error);
      }
    } finally {
      if (checkValid()) {
        this.isLoading.set(false);
      }
    }
  }

  // Thực hiện logout backend
  private async logoutBackend() {
    try {
      await firstValueFrom(this.apiService.post<any>('auth/logout', {}));
    } catch (e) {
      // ignore
    }
    this.currentUser.set(null);
    this.currentCompany.set(null);
    this.userPermissions.set([]);
    localStorage.removeItem('ptt_selected_company_id');
  }

  // Refresh thông tin user hiện tại từ server (dùng khi KYC status thay đổi)
  public async refreshCurrentUser(): Promise<void> {
    try {
      const response = await firstValueFrom(this.apiService.get<any>('auth/me'));
      if (response?.user) {
        this.currentUser.set(response.user);
      }
    } catch (e) {
      // Ignore — user vẫn giữ trạng thái cũ nếu lỗi mạng
    }
  }

  // Tải danh sách các công ty doanh nghiệp
  public async loadCompanies() {
    this.isCompaniesLoading.set(true);
    try {
      const list = await firstValueFrom(this.apiService.get<any[]>('companies'));
      this.companiesList.set(list || []);
      
      const savedCompanyId = localStorage.getItem('ptt_selected_company_id');
      
      if (list && list.length > 0) {
        let targetCompany = null;
        if (savedCompanyId) {
          targetCompany = list.find(c => String(c.id) === savedCompanyId);
        }
        
        if (targetCompany) {
          this.selectCompany(targetCompany);
        } else {
          this.selectCompany(list[0]);
        }
      } else {
        this.currentCompany.set(null);
        this.userPermissions.set([]);
      }
    } catch (e) {
      console.error('Lỗi tải danh sách công ty:', e);
    } finally {
      this.isCompaniesLoading.set(false);
    }
  }

  // Chọn doanh nghiệp hiện hành
  public async selectCompany(company: any) {
    const isDifferentCompany = this.currentCompany()?.id !== company?.id;
    this.currentCompany.set(company);
    if (isDifferentCompany) {
      this.userPermissions.set([]);
    }
    
    if (company && company.id) {
      localStorage.setItem('ptt_selected_company_id', String(company.id));
    }
    
    // Tải thông tin quyền của user trong company này
    if (this.currentUser()) {
      await this.loadCurrentPermissions(company.id);
    }
  }

  // Tải quyền hạn của nhân sự trong doanh nghiệp
  private async loadCurrentPermissions(companyId: number) {
    try {
      // Gọi API lấy danh sách roles của công ty hiện tại
      const roles = await firstValueFrom(this.apiService.get<any[]>('roles', companyId));
      const userAddr = this.address()?.toLowerCase();
      
      // Lấy danh sách staffs của công ty này
      const staffs = await firstValueFrom(this.apiService.get<any[]>('staffs', companyId));
      
      // Tìm xem user hiện hành là staff nào
      const currentStaff = staffs.find(s => s.wallet_address.toLowerCase() === userAddr);
      if (currentStaff) {
        // Tìm role tương ứng để lấy permissions
        const userRole = roles.find(r => r.id === currentStaff.role_id);
        if (userRole) {
          this.userPermissions.set(userRole.permissions || []);
          return;
        }
      }
    } catch (e) {
      // Không có quyền hoặc không phải staff
    }
    this.userPermissions.set([]);
  }

  // Kiểm tra quyền hạn
  public hasPermission(permission: string): boolean {
    const perms = this.userPermissions();
    return perms.includes('*') || perms.includes(permission);
  }

  // ====================================================
  // DELEGATED METHODS
  // ====================================================
  public showToast(msg: string, type: 'success' | 'error' | 'warning' = 'success') {
    this.toastService.showToast(msg, type);
  }

  public copyToClipboard(text: string, label: string = 'Đã sao chép vào bộ nhớ tạm!') {
    if (text) {
      navigator.clipboard.writeText(text);
      this.toastService.showToast(label, 'success');
    }
  }

  public clearToasts() {
    this.toastService.clearAll();
  }

  public toggleTheme() {
    this.themeService.toggleTheme();
  }

  public setThemeMode(mode: 'light' | 'dark' | 'auto') {
    this.themeService.setThemeMode(mode);
  }

  public async connectWallet() {
    await this.web3Service.connect();
  }

  public async openNetworkModal() {
    await this.web3Service.openNetworkModal();
  }

  public async openAccountModal() {
    await this.web3Service.openAccountModal();
  }

  public async disconnectWallet() {
    await this.web3Service.disconnect();
    this.showWrongChainModal.set(false);
    this.currentUser.set(null);
    this.currentCompany.set(null);
    this.userPermissions.set([]);
    localStorage.removeItem('ptt_selected_company_id'); // Xóa ID công ty đã chọn khỏi localStorage
  }

  public async switchNetwork(chainId: number) {
    await this.web3Service.switchNetwork(chainId);
  }

  public async getSigner() {
    return await this.web3Service.getSigner();
  }

  public getProvider() {
    return this.web3Service.getProvider();
  }

  public async getGasOverrides(signer?: any) {
    return await this.web3Service.getGasOverrides(signer);
  }
}
