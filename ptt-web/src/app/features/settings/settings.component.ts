import { Component, OnInit, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ethers } from 'ethers';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ModalService } from '@core/services/modal.service';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BoardGovernance, EquityToken, FinanceManager, Marketplace } from '../../core/constants/contracts';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CustomSelectComponent } from '@shared/components/custom-select/custom-select.component';
import { DeployModalComponent } from './deploy-modal.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, IconComponent, CustomSelectComponent],
  templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);
  private router = inject(Router);
  private modalService = inject(ModalService);

  // --- Contract owners ---
  public contractOwners = signal<string[]>([]);
  public newOwnerAddr = '';

  // --- Contract addresses ---
  public editingContracts: Record<string, string> = {
    governance_address: '',
    token_address: '',
    funding_address: '',
    marketplace_address: '',
  };

  // --- Company info ---
  public companyName = signal<string>('');
  public companyValuation = signal<number>(0);
  public companyLogo = signal<string>('');
  public tokenName = signal<string>('');
  public tokenSymbol = signal<string>('');
  public saveInfoLoading = signal<boolean>(false);

  // --- Saved Tokens ---
  public savedTokens = signal<any[]>([]);
  public newTokenAddr = '';
  public newTokenSymbol = '';
  public newTokenName = '';
  public newTokenDecimals = 18;
  public isValidatingNewToken = signal<boolean>(false);
  public newTokenValidationError = signal<string>('');
  public saveTokensLoading = signal<boolean>(false);

  // --- Threshold state ---
  public minSignatures = signal<number>(1);
  public thresholdOptions = computed(() => {
    const ownersCount = this.contractOwners().length;
    const options = [];
    for (let i = 1; i <= ownersCount; i++) {
      options.push({
        value: i,
        label: `${i} chữ ký / ${ownersCount} Owners`
      });
    }
    return options;
  });

  // --- Loading states ---
  public saveContractsLoading = signal(false);
  public deployAllLoading = signal(false);
  
  // --- Deletion state ---
  public isDeletable = signal<boolean>(false);
  public deleteLoading = signal<boolean>(false);

  private lastCompanyId: number | null = null;

  public readonly contractList = [
    { name: 'Board Governance (HĐQT Đa chữ ký / Treasury)', key: 'governance_address', contractKey: 'BoardGovernance', icon: 'scale' },
    { name: 'Finance Manager (Gọi vốn & Cổ tức)', key: 'funding_address', contractKey: 'FinanceManager', icon: 'financials' },
    { name: 'Marketplace (Sàn Giao dịch Cổ phần)', key: 'marketplace_address', contractKey: 'Marketplace', icon: 'sync' },
    { name: 'Equity Token (Cổ phần Doanh nghiệp)', key: 'token_address', contractKey: 'EquityToken', icon: 'ethereum' },
  ];

  constructor() {
    effect(() => {
      const comp = this.stateService.currentCompany();
      const userAddr = this.stateService.address();
      if (comp) {
        const companyChanged = this.lastCompanyId !== comp.id;
        this.lastCompanyId = comp.id;

        // Đồng bộ địa chỉ hợp đồng từ state, chỉ giữ lại giá trị Ethereum hợp lệ
        const toAddr = (v: string | null | undefined) =>
          v && ethers.isAddress(v) ? v : '';
        this.editingContracts = {
          governance_address: toAddr(comp.governance_address),
          token_address: toAddr(comp.token_address),
          funding_address: toAddr(comp.funding_address),
          marketplace_address: toAddr(comp.marketplace_address),
        };
        this.savedTokens.set(comp.saved_tokens || []);

        if (companyChanged) {
          this.companyName.set(comp.name || '');
          this.companyValuation.set(comp.valuation || 0);
          this.companyLogo.set(comp.logo || '');
          // Nếu token_name chỉ là code (do logic cũ tự set) → dùng tên doanh nghiệp làm mặc định
          const rawTokenName = comp.token_name || '';
          this.tokenName.set(rawTokenName && rawTokenName !== comp.code ? rawTokenName : (comp.name || ''));
          this.tokenSymbol.set(comp.token_symbol || comp.code || '');
          
          const hasContracts = !!(
            comp.governance_address ||
            comp.token_address ||
            comp.funding_address ||
            comp.marketplace_address
          );

          // Luôn đảm bảo ví đang kết nối có trong list owners khi mới chọn doanh nghiệp
          const defaultAddr = userAddr || comp.wallet_address || '';
          this.contractOwners.set(defaultAddr ? [defaultAddr] : []);
          this.minSignatures.set(1);

          // Check if deletable: all contract addresses must be null or empty
          const isLinked = !!(
            comp.governance_address ||
            comp.token_address ||
            comp.funding_address ||
            comp.marketplace_address ||
            comp.oracle_address ||
            comp.registry_address
          );
          this.isDeletable.set(!isLinked);
        } else {
          // Cùng doanh nghiệp nhưng ví kết nối thay đổi hoặc kết nối muộn hơn
          // → nếu list đang rỗng, thêm sẵn ví hiện tại
          if (this.contractOwners().length === 0 && userAddr) {
            this.contractOwners.set([userAddr]);
            this.minSignatures.set(1);
          }
        }
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {}

  public isContractLinked(key: string): boolean {
    const comp = this.stateService.currentCompany();
    if (!comp) return false;
    const val = (comp as any)[key];
    return !!(val && ethers.isAddress(val));
  }

  public isAllContractsLinked(): boolean {
    const comp = this.stateService.currentCompany();
    if (!comp) return false;
    return !!(
      comp.governance_address && ethers.isAddress(comp.governance_address) &&
      comp.token_address && ethers.isAddress(comp.token_address) &&
      comp.funding_address && ethers.isAddress(comp.funding_address) &&
      comp.marketplace_address && ethers.isAddress(comp.marketplace_address)
    );
  }

  // --- Auto Deploy ---
  public async handleDeployAll() {
    if (this.deployAllLoading() || this.stateService.isLoading()) return;

    if (this.isAllContractsLinked()) {
      this.stateService.showToast('Hệ thống Smart Contracts đã được triển khai đầy đủ. Không thể deploy lại!', 'warning');
      return;
    }

    const signer = await this.stateService.getSigner();
    if (!signer) {
      this.stateService.showToast('Vui lòng kết nối ví Metamask trước!', 'warning');
      return;
    }

    const owners = this.contractOwners();
    if (owners.length === 0) {
      this.stateService.showToast('Vui lòng thêm ít nhất một ví quản trị (Owner)!', 'warning');
      return;
    }

    const comp = this.stateService.currentCompany();
    if (!comp) {
      this.stateService.showToast('Không tìm thấy thông tin công ty hiện tại!', 'error');
      return;
    }

    if (!this.tokenName() || !this.tokenName().trim()) {
      this.stateService.showToast('Tên Token Cổ phần không được để trống! Vui lòng lưu thông tin trong tab Cài đặt trước.', 'warning');
      return;
    }

    if (!this.tokenSymbol() || !this.tokenSymbol().trim()) {
      this.stateService.showToast('Ký hiệu Token không được để trống! Vui lòng lưu thông tin trong tab Cài đặt trước.', 'warning');
      return;
    }

    const modalRef = this.modalService.open(DeployModalComponent, {
      title: 'Triển khai Hệ thống Smart Contracts',
      size: 'lg',
      closeOnBackdropClick: false,
      showHeader: false,
      data: {
        owners,
        minSignatures: this.minSignatures(),
        tokenName: this.tokenName(),
        tokenSymbol: this.tokenSymbol(),
        company: comp
      }
    });

    modalRef.afterClosed$.subscribe(async (result) => {
      if (result && result.success && result.addresses) {
        const updatedAddresses = result.addresses;
        this.editingContracts = {
          governance_address: updatedAddresses.governance_address || '',
          token_address: updatedAddresses.token_address || '',
          funding_address: updatedAddresses.funding_address || '',
          marketplace_address: updatedAddresses.marketplace_address || '',
        };

        const updated = {
          ...comp,
          ...updatedAddresses
        };
        this.stateService.currentCompany.set(updated);
        
        const currentList = this.stateService.companiesList();
        const updatedList = currentList.map(c => c.id === comp.id ? updated : c);
        this.stateService.companiesList.set(updatedList);

        this.stateService.showToast('🎉 Triển khai và lưu cấu hình hệ thống Smart Contracts thành công!', 'success');
      }
    });
  }

  // --- Owners ---
  public addOwner() {
    if (!this.newOwnerAddr || !ethers.isAddress(this.newOwnerAddr)) {
      this.stateService.showToast('Địa chỉ ví không hợp lệ!', 'warning');
      return;
    }
    if (this.contractOwners().includes(this.newOwnerAddr)) {
      this.stateService.showToast('Địa chỉ này đã có trong danh sách!', 'warning');
      return;
    }
    this.contractOwners.update(list => [...list, this.newOwnerAddr]);
    this.newOwnerAddr = '';
  }

  public removeOwner(addr: string) {
    this.contractOwners.update(list => {
      const newList = list.filter(a => a !== addr);
      if (this.minSignatures() > newList.length) {
        this.minSignatures.set(Math.max(1, newList.length));
      }
      return newList;
    });
  }

  // --- Save contracts ---
  public async handleSaveContracts() {
    if (this.saveContractsLoading()) return;

    const comp = this.stateService.currentCompany();
    if (!comp) return;
    this.saveContractsLoading.set(true);
    try {
      // Validate: chỉ cho phép địa chỉ Ethereum hợp lệ (0x...) hoặc rỗng
      const sanitized: Record<string, string> = {};
      for (const [k, v] of Object.entries(this.editingContracts)) {
        const trimmed = (v as string).trim();
        sanitized[k] = (trimmed && ethers.isAddress(trimmed)) ? trimmed : '';
      }
      const payload = {
        ...sanitized,
        chain_id: this.stateService.chainId()
      };
      const res = await firstValueFrom(this.apiService.put<any>(`companies/${comp.id}/contracts`, payload));
      this.stateService.showToast('Cập nhật địa chỉ Smart Contracts thành công!', 'success');
      if (res && res.company) {
        const updated = { ...comp, ...res.company };
        this.stateService.currentCompany.set(updated);
        
        const currentList = this.stateService.companiesList();
        const updatedList = currentList.map(c => c.id === comp.id ? updated : c);
        this.stateService.companiesList.set(updatedList);
      }
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Cập nhật địa chỉ thất bại!', 'error');
    } finally {
      this.saveContractsLoading.set(false);
    }
  }

  // --- Download config ---
  public handleDownloadConfig() {
    const comp = this.stateService.currentCompany();
    if (!comp) {
      this.stateService.showToast('Không tìm thấy thông tin doanh nghiệp hiện tại!', 'error');
      return;
    }

    const network = this.stateService.networkName() || 'Unknown Network';
    const chainId = this.stateService.chainId() || 'Unknown Chain ID';

    const configText = `CẤU HÌNH SMART CONTRACTS - ${comp.name.toUpperCase()} (ID: ${comp.id}, CODE: ${comp.code.toUpperCase()})
--------------------------------------------------
Mạng lưới triển khai: ${network} (Chain ID: ${chainId})
Ngày tải xuống: ${new Date().toLocaleString('vi-VN')}

ĐỊA CHỈ CÁC HỢP ĐỒNG CỐT LÕI:
1. Board Governance (HĐQT Đa chữ ký & Treasury):
   ${this.editingContracts['governance_address'] || 'Chưa liên kết'}

2. Equity Token (Cổ phần Doanh nghiệp):
   ${this.editingContracts['token_address'] || 'Chưa liên kết'}

3. Finance Manager (Gọi vốn & Cổ tức):
   ${this.editingContracts['funding_address'] || 'Chưa liên kết'}

4. Marketplace (Sàn giao dịch Cổ phần):
   ${this.editingContracts['marketplace_address'] || 'Chưa liên kết'}

--------------------------------------------------
* Lưu ý: Tài liệu này chứa thông tin cấu hình on-chain của doanh nghiệp.
Hãy lưu trữ cẩn thận và không chia sẻ khóa bảo mật (Private Key) của ví.
`;

    const blob = new Blob([configText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${comp.code.toUpperCase()}_contracts_config.txt`;
    link.click();
    URL.revokeObjectURL(url);
    this.stateService.showToast('Đã tải xuống cấu hình thành công!', 'success');
  }

  // --- Save Company info ---
  public async handleSaveCompanyInfo() {
    if (this.saveInfoLoading()) return;

    const comp = this.stateService.currentCompany();
    if (!comp) return;

    if (!this.companyName().trim()) {
      this.stateService.showToast('Tên doanh nghiệp không được để trống!', 'warning');
      return;
    }

    if (!this.tokenName() || !this.tokenName().trim()) {
      this.stateService.showToast('Tên Token Cổ phần không được để trống!', 'warning');
      return;
    }

    if (!this.tokenSymbol() || !this.tokenSymbol().trim()) {
      this.stateService.showToast('Ký hiệu Token không được để trống!', 'warning');
      return;
    }

    this.saveInfoLoading.set(true);
    try {
      const payload = {
        name: this.companyName(),
        valuation: this.companyValuation(),
        logo: this.companyLogo(),
        token_name: this.tokenName(),
        token_symbol: this.tokenSymbol(),
      };
      const res = await firstValueFrom(this.apiService.put<any>(`companies/${comp.id}`, payload));
      this.stateService.showToast('Cập nhật thông tin doanh nghiệp thành công!', 'success');
      if (res && res.company) {
        const updated = { ...comp, ...res.company };
        this.stateService.currentCompany.set(updated);
        
        const currentList = this.stateService.companiesList();
        const updatedList = currentList.map(c => c.id === comp.id ? updated : c);
        this.stateService.companiesList.set(updatedList);
      }
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Cập nhật thông tin thất bại!', 'error');
    } finally {
      this.saveInfoLoading.set(false);
    }
  }

  // --- Xóa doanh nghiệp nháp ---
  public handleDeleteCompany() {
    if (this.deleteLoading()) return;

    const comp = this.stateService.currentCompany();
    if (!comp) return;

    const confirmRef = this.modalService.confirm({
      title: 'Xóa doanh nghiệp nháp',
      description: `Bạn có chắc chắn muốn xóa doanh nghiệp "${comp.name}" không?`,
      descriptionHtml: '<div class="text-xs text-red-500 font-bold mt-2">THAO TÁC NÀY KHÔNG THỂ HOÀN TÁC! Tất cả thông tin doanh nghiệp, vai trò và thành viên sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu.</div>',
      confirmText: 'XÓA DOANH NGHIỆP',
      cancelText: 'HỦY BỎ',
      confirmButtonClass: 'btn-danger'
    });

    confirmRef.afterClosed$.subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          this.deleteLoading.set(true);
          this.stateService.isLoading.set(true);
          
          await firstValueFrom(this.apiService.delete<any>(`companies/${comp.id}`));
          
          this.stateService.showToast('Đã xóa doanh nghiệp nháp thành công!', 'success');
          
          // 1. Tải lại danh sách doanh nghiệp
          await this.stateService.loadCompanies();
          
          // 2. Tự động chọn lại doanh nghiệp đầu tiên nếu có
          const list = this.stateService.companiesList();
          if (list.length > 0) {
            this.stateService.selectCompany(list[0]);
          }
          
          // 3. Chuyển hướng về Dashboard
          this.router.navigate(['/dashboard']);
        } catch (e: any) {
          this.stateService.showToast(e.error?.message || 'Không thể xóa doanh nghiệp!', 'error');
        } finally {
          this.deleteLoading.set(false);
          this.stateService.isLoading.set(false);
        }
      }
    });
  }

  // Tự động load thông tin ERC20 khi nhập địa chỉ trong Settings
  async onNewTokenAddressChange(addr: string) {
    this.newTokenAddr = addr.trim();
    const cleanAddr = this.newTokenAddr;

    if (!cleanAddr) {
      this.newTokenSymbol = '';
      this.newTokenName = '';
      this.newTokenDecimals = 18;
      this.newTokenValidationError.set('');
      return;
    }

    if (!ethers.isAddress(cleanAddr)) {
      this.newTokenSymbol = '';
      this.newTokenName = '';
      this.newTokenDecimals = 18;
      this.newTokenValidationError.set('Địa chỉ ví không đúng định dạng 0x...!');
      return;
    }

    this.isValidatingNewToken.set(true);
    this.newTokenValidationError.set('');

    try {
      const provider = this.stateService.getProvider();
      if (!provider) {
        this.newTokenValidationError.set('Ví chưa kết nối, không thể tải thông tin!');
        this.isValidatingNewToken.set(false);
        return;
      }

      const minErc20Abi = [
        'function symbol() view returns (string)',
        'function name() view returns (string)',
        'function decimals() view returns (uint8)'
      ];

      const contract = new ethers.Contract(cleanAddr, minErc20Abi, provider);

      const [symbol, name, decimals] = await Promise.all([
        contract['symbol'](),
        contract['name'](),
        contract['decimals']()
      ]);

      this.newTokenSymbol = symbol;
      this.newTokenName = name;
      this.newTokenDecimals = Number(decimals);
    } catch (e: any) {
      console.error('Lỗi khi đọc token ERC20:', e);
      this.newTokenValidationError.set('Địa chỉ không phải Token ERC20 hợp lệ trên blockchain!');
    } finally {
      this.isValidatingNewToken.set(false);
    }
  }

  async addSavedToken() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    if (!this.newTokenAddr || !ethers.isAddress(this.newTokenAddr)) {
      this.stateService.showToast('Địa chỉ contract Token không hợp lệ!', 'warning');
      return;
    }

    if (!this.newTokenSymbol) {
      this.stateService.showToast('Ký hiệu token không được trống!', 'warning');
      return;
    }

    // Kiểm tra xem đã tồn tại chưa
    const exists = this.savedTokens().some(t => t.address.toLowerCase() === this.newTokenAddr.toLowerCase());
    if (exists) {
      this.stateService.showToast('Token này đã tồn tại trong danh sách đã lưu!', 'warning');
      return;
    }

    const newTokens = [
      ...this.savedTokens(),
      {
        address: this.newTokenAddr,
        symbol: this.newTokenSymbol,
        name: this.newTokenName || this.newTokenSymbol,
        decimals: this.newTokenDecimals
      }
    ];

    await this.updateSavedTokensApi(newTokens);

    // Clear form
    this.newTokenAddr = '';
    this.newTokenSymbol = '';
    this.newTokenName = '';
    this.newTokenDecimals = 18;
  }

  async removeSavedToken(tokenAddress: string) {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    const newTokens = this.savedTokens().filter(t => t.address.toLowerCase() !== tokenAddress.toLowerCase());
    await this.updateSavedTokensApi(newTokens);
  }

  private async updateSavedTokensApi(tokens: any[]) {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      this.saveTokensLoading.set(true);
      const response = await firstValueFrom(
        this.apiService.put<any>(`companies/${comp.id}/saved-tokens`, { saved_tokens: tokens })
      );
      
      this.stateService.showToast('Cập nhật danh sách Token ERC20 thành công!', 'success');
      
      // Cập nhật lại state local
      this.savedTokens.set(response.company.saved_tokens || []);
      
      // Đồng bộ lại stateService.currentCompany để cập nhật phản ứng ở các trang khác
      comp.saved_tokens = response.company.saved_tokens;
      this.stateService.currentCompany.set({ ...comp });
      
      // Cập nhật lại list company trong list
      const currentList = this.stateService.companiesList();
      const idx = currentList.findIndex(c => c.id === comp.id);
      if (idx !== -1) {
        currentList[idx].saved_tokens = response.company.saved_tokens;
        this.stateService.companiesList.set([...currentList]);
      }
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Không thể lưu danh sách token!', 'error');
    } finally {
      this.saveTokensLoading.set(false);
    }
  }
}
