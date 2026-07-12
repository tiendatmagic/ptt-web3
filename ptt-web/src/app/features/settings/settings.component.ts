import { Component, OnInit, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ethers } from 'ethers';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ModalService } from '@core/services/modal.service';
import { EtherscanVerifyService } from '@core/services/etherscan-verify.service';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BoardGovernance, EquityToken, FinanceManager, Marketplace } from '../../core/constants/contracts';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CustomSelectComponent } from '@shared/components/custom-select/custom-select.component';

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
  private verifyService = inject(EtherscanVerifyService);

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
  public saveInfoLoading = signal<boolean>(false);

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

  public readonly contractList = [
    { name: 'Board Governance (HĐQT Đa chữ ký / Treasury)', key: 'governance_address', contractKey: 'BoardGovernance', icon: 'scale' },
    { name: 'Equity Token (Cổ phần Doanh nghiệp)', key: 'token_address', contractKey: 'EquityToken', icon: 'ethereum' },
    { name: 'Finance Manager (Gọi vốn & Cổ tức)', key: 'funding_address', contractKey: 'FinanceManager', icon: 'financials' },
    { name: 'Marketplace (Sàn Giao dịch Cổ phần)', key: 'marketplace_address', contractKey: 'Marketplace', icon: 'sync' },
  ];

  constructor() {
    effect(() => {
      const comp = this.stateService.currentCompany();
      if (comp) {
        this.editingContracts = {
          governance_address: comp.governance_address || '',
          token_address: comp.token_address || '',
          funding_address: comp.funding_address || '',
          marketplace_address: comp.marketplace_address || '',
        };
        this.companyName.set(comp.name || '');
        this.companyValuation.set(comp.valuation || 0);
        this.companyLogo.set(comp.logo || '');
        
        if (comp.wallet_address) {
          this.contractOwners.set([comp.wallet_address]);
          this.minSignatures.set(1);
        }

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
      }
    });
  }

  ngOnInit() {}

  public isContractLinked(key: string): boolean {
    const comp = this.stateService.currentCompany();
    if (!comp) return false;
    return !!(comp as any)[key];
  }

  public isAllContractsLinked(): boolean {
    const comp = this.stateService.currentCompany();
    if (!comp) return false;
    return !!(
      comp.governance_address &&
      comp.token_address &&
      comp.funding_address &&
      comp.marketplace_address
    );
  }

  // --- Auto Deploy ---
  public async handleDeployAll() {
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

    this.deployAllLoading.set(true);
    this.stateService.showToast('Bắt đầu deploy hệ thống 4 contracts. Vui lòng duyệt từng giao dịch trên Metamask...', 'warning');

    const chainId = this.stateService.chainId();

    try {
      // 1. Deploy BoardGovernance
      this.stateService.showToast('[1/4] Đang deploy Board Governance (HĐQT Multisig)...', 'warning');
      const govFactory = new ethers.ContractFactory(BoardGovernance.abi, BoardGovernance.bytecode, signer);
      const govContract = await govFactory.deploy(owners, this.minSignatures());
      await govContract.waitForDeployment();
      const govAddr = await govContract.getAddress();
      this.editingContracts['governance_address'] = govAddr;
      this.stateService.showToast('✓ Deploy Board Governance thành công: ' + govAddr, 'success');
      this.autoVerify(govAddr, 'BoardGovernance', BoardGovernance.sourceCode, chainId);

      // 2. Deploy EquityToken
      this.stateService.showToast('[2/4] Đang deploy Equity Token (Cổ phần)...', 'warning');
      const tokenFactory = new ethers.ContractFactory(EquityToken.abi, EquityToken.bytecode, signer);
      const tokenContract = await tokenFactory.deploy(comp.name, comp.code, govAddr);
      await tokenContract.waitForDeployment();
      const tokenAddr = await tokenContract.getAddress();
      this.editingContracts['token_address'] = tokenAddr;
      this.stateService.showToast('✓ Deploy Equity Token thành công: ' + tokenAddr, 'success');
      this.autoVerify(tokenAddr, 'EquityToken', EquityToken.sourceCode, chainId);

      // 3. Deploy FinanceManager
      this.stateService.showToast('[3/4] Đang deploy Finance Manager (Gọi vốn & Cổ tức)...', 'warning');
      const financeFactory = new ethers.ContractFactory(FinanceManager.abi, FinanceManager.bytecode, signer);
      const financeContract = await financeFactory.deploy(govAddr);
      await financeContract.waitForDeployment();
      const financeAddr = await financeContract.getAddress();
      this.editingContracts['funding_address'] = financeAddr;
      this.stateService.showToast('✓ Deploy Finance Manager thành công: ' + financeAddr, 'success');
      this.autoVerify(financeAddr, 'FinanceManager', FinanceManager.sourceCode, chainId);

      // 4. Deploy Marketplace
      this.stateService.showToast('[4/4] Đang deploy Marketplace (Sàn giao dịch)...', 'warning');
      const marketplaceFactory = new ethers.ContractFactory(Marketplace.abi, Marketplace.bytecode, signer);
      const marketplaceContract = await marketplaceFactory.deploy(govAddr, govAddr);
      await marketplaceContract.waitForDeployment();
      const marketplaceAddr = await marketplaceContract.getAddress();
      this.editingContracts['marketplace_address'] = marketplaceAddr;
      this.stateService.showToast('✓ Deploy Marketplace thành công: ' + marketplaceAddr, 'success');
      this.autoVerify(marketplaceAddr, 'Marketplace', Marketplace.sourceCode, chainId);

      this.stateService.showToast('Hoàn tất deploy 4 contracts! Vui lòng nhấn "Lưu cấu hình Smart Contracts" để hoàn tất liên kết vào hệ thống.', 'success');

    } catch (e: any) {
      console.error(e);
      this.stateService.showToast('Lỗi khi deploy: ' + (e.message || 'Unknown'), 'error');
    } finally {
      this.deployAllLoading.set(false);
    }
  }

  /** Tự động verify contract trên Explorer sau khi deploy (background, không block UI) */
  private autoVerify(address: string, contractName: string, sourceCode: string, chainId: number | null) {
    if (!chainId || !sourceCode) return;
    this.stateService.showToast(`🔍 Đang gửi yêu cầu verify ${contractName} lên Explorer...`, 'warning');

    this.verifyService.submitVerify({ contractAddress: address, contractName, sourceCode, chainId })
      .then(result => {
        if (result.success && result.guid) {
          this.stateService.showToast(`✓ Đã gửi verify ${contractName}. Đang chờ xác nhận...`, 'success');
          return this.verifyService.pollVerifyStatus(result.guid, chainId).then(status => {
            if (status.verified) {
              this.stateService.showToast(`✅ ${contractName} đã được verify thành công trên Explorer!`, 'success');
            } else {
              this.stateService.showToast(`⚠️ Verify ${contractName}: ${status.message}`, 'warning');
            }
          });
        }
        this.stateService.showToast(`⚠️ Gửi verify ${contractName} thất bại: ${result.message}`, 'warning');
        return Promise.resolve();
      })
      .catch(err => console.warn(`[Verify] ${contractName} error:`, err));
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
    const comp = this.stateService.currentCompany();
    if (!comp) return;
    this.saveContractsLoading.set(true);
    try {
      const payload = {
        ...this.editingContracts
      };
      await firstValueFrom(this.apiService.put<any>(`companies/${comp.id}/contracts`, payload));
      this.stateService.showToast('Cập nhật địa chỉ Smart Contracts thành công!', 'success');
      await this.stateService.loadCompanies();
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
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    if (!this.companyName().trim()) {
      this.stateService.showToast('Tên doanh nghiệp không được để trống!', 'warning');
      return;
    }

    this.saveInfoLoading.set(true);
    try {
      const payload = {
        name: this.companyName(),
        valuation: this.companyValuation(),
        logo: this.companyLogo(),
      };
      await firstValueFrom(this.apiService.put<any>(`companies/${comp.id}`, payload));
      this.stateService.showToast('Cập nhật thông tin doanh nghiệp thành công!', 'success');
      await this.stateService.loadCompanies();
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Cập nhật thông tin thất bại!', 'error');
    } finally {
      this.saveInfoLoading.set(false);
    }
  }

  // --- Xóa doanh nghiệp nháp ---
  public handleDeleteCompany() {
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
}
