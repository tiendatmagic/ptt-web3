import { Injectable, inject, computed, signal, effect } from '@angular/core';
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

  // Token trong memory — ApiService đọc để gửi Authorization header
  public authToken = signal<string | null>(null);

  // Cờ session đã kiểm tra xong (tránh race condition với wallet reconnect)
  private isSessionRestored = signal<boolean>(false);

  // Key localStorage — persist token qua cả tắt browser
  // Token hết hạn server-side sau 8 tiếng, bị xóa khi logout
  private readonly SESSION_KEY = 'ptt_auth_token';

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
  public readonly isWrongChain = this.web3Service.isWrongChain;
  public readonly chainSymbol = this.web3Service.chainSymbol;
  public readonly txSpeed = this.web3Service.txSpeed;
  public readonly gasMultiplier = this.web3Service.gasMultiplier;
  public readonly showWrongChainModal = this.web3Service.showWrongChainModal;
  public readonly POPULAR_CHAINS = this.web3Service.POPULAR_CHAINS;

  public readonly shortenedAddress = computed(() => {
    const addr = this.address();
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  });

  constructor() {
    // Đăng ký tham chiếu vào ApiService để tránh circular dependency
    // ApiService cần đọc authToken từ StateService khi gửi request
    this.apiService.registerStateRef(this);

    this.setupAuthSync();
    this.checkExistingSession();
  }

  // Tự động đồng bộ luồng login/logout backend khi ví Web3 thay đổi trạng thái
  private setupAuthSync() {
    effect(async () => {
      const connected = this.isConnected();
      const walletAddr = this.address();
      const user = this.currentUser();
      const sessionRestored = this.isSessionRestored();

      // Chờ checkExistingSession hoàn thành trước khi xét login
      // Tránh race condition: ví kết nối lại nhanh hơn session restore
      if (!sessionRestored) return;

      if (connected && walletAddr && !user) {
        // Thực hiện login ví Web3
        await this.loginWithWeb3(walletAddr);
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
      // Bước 1: Đọc token từ localStorage (persist qua cả tắt browser)
      // ApiService sẽ gửi token này trong Authorization header cho /auth/me
      const savedToken = localStorage.getItem(this.SESSION_KEY);
      if (savedToken) {
        this.authToken.set(savedToken); // Khôi phục vào memory để ApiService dùng
      }

      // Bước 2: Gọi /auth/me để xác thực token còn hiệu lực không
      // ApiService sẽ dùng authToken signal để gửi Authorization header
      const response = await firstValueFrom(this.apiService.get<any>('auth/me'));
      if (response?.user) {
        this.currentUser.set(response.user);
        if (response.token) {
          this.authToken.set(response.token);
          localStorage.setItem(this.SESSION_KEY, response.token);
        }
        this.loadCompanies();
      } else {
        // Token không hợp lệ — xóa
        localStorage.removeItem(this.SESSION_KEY);
        this.authToken.set(null);
      }
    } catch (e) {
      // Session hết hạn — xóa token cũ
      localStorage.removeItem(this.SESSION_KEY);
      this.authToken.set(null);
      this.currentUser.set(null);
    } finally {
      this.isSessionRestored.set(true);
    }
  }

  // Thực hiện luồng Login Web3
  private async loginWithWeb3(walletAddress: string) {
    this.isLoading.set(true);
    try {
      // 1. Lấy challenge nonce từ API challenge
      const challenge = await firstValueFrom(
        this.apiService.get<any>('auth/challenge', undefined, { address: walletAddress })
      );

      // 2. Yêu cầu ví ký thông điệp challenge
      const signer = await this.web3Service.getSigner();
      const signature = await signer.signMessage(challenge.message);

      // 3. Gửi signature lên API login
      const response = await firstValueFrom(
        this.apiService.post<any>('auth/login', {
          address: walletAddress,
          message: challenge.message,
          signature: signature
        })
      );

      // 4. Lưu user + token vào memory và localStorage
      this.currentUser.set(response.user);
      if (response.token) {
        this.authToken.set(response.token);
        // localStorage persist qua cả tắt browser, token hết hạn server-side sau 8 tiếng
        localStorage.setItem(this.SESSION_KEY, response.token);
      }
      this.showToast('Đăng nhập ví Web3 thành công!', 'success');

      // Tải danh sách công ty
      await this.loadCompanies();
    } catch (error: any) {
      console.error('[Auth] Đăng nhập ví Web3 thất bại:', error);
      this.showToast(error.error?.message || 'Chữ ký không hợp lệ hoặc bị từ chối!', 'error');
      // Ngắt kết nối ví nếu login backend lỗi
      await this.disconnectWallet();
    } finally {
      this.isLoading.set(false);
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
    this.authToken.set(null);
    localStorage.removeItem(this.SESSION_KEY); // Xóa token khỏi localStorage
    localStorage.removeItem('ptt_selected_company_id'); // Xóa ID công ty đã chọn khỏi localStorage
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
    this.currentCompany.set(company);
    this.userPermissions.set([]);
    
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
