import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ethers } from 'ethers';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ButtonComponent } from '@shared/components/button/button.component';
import { CONTRACTS_DATA } from '../../core/constants/contracts-data';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, IconComponent],
  templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  // --- BSC API Key ---
  public bscApiKey = signal<string>('');

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

  // --- Loading states ---
  public saveContractsLoading = signal(false);
  public deployAllLoading = signal(false);
  public verifyLoading = signal<Record<string, boolean>>({});
  public verifyStatus = signal<Record<string, string>>({});

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
        }
      }
    });
  }

  ngOnInit() {
    const saved = localStorage.getItem('ptt_bscscan_api_key');
    if (saved) this.bscApiKey.set(saved);
  }

  // --- Auto Deploy ---
  public async handleDeployAll() {
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

    try {
      // 1. Deploy BoardGovernance
      this.stateService.showToast('[1/4] Đang deploy Board Governance (HĐQT Multisig)...', 'warning');
      const govFactory = new ethers.ContractFactory(
        CONTRACTS_DATA['BoardGovernance'].abi,
        CONTRACTS_DATA['BoardGovernance'].bytecode,
        signer
      );
      // threshold ban đầu mặc định là 1 để dễ thao tác ban đầu
      const govContract = await govFactory.deploy(owners, 1);
      await govContract.waitForDeployment();
      const govAddr = await govContract.getAddress();
      this.editingContracts['governance_address'] = govAddr;
      this.stateService.showToast('✓ Deploy Board Governance thành công: ' + govAddr, 'success');

      // 2. Deploy EquityToken
      this.stateService.showToast('[2/4] Đang deploy Equity Token (Cổ phần)...', 'warning');
      const tokenFactory = new ethers.ContractFactory(
        CONTRACTS_DATA['EquityToken'].abi,
        CONTRACTS_DATA['EquityToken'].bytecode,
        signer
      );
      const tokenContract = await tokenFactory.deploy(comp.name, comp.code, govAddr);
      await tokenContract.waitForDeployment();
      const tokenAddr = await tokenContract.getAddress();
      this.editingContracts['token_address'] = tokenAddr;
      this.stateService.showToast('✓ Deploy Equity Token thành công: ' + tokenAddr, 'success');

      // 3. Deploy FinanceManager
      this.stateService.showToast('[3/4] Đang deploy Finance Manager (Gọi vốn & Cổ tức)...', 'warning');
      const financeFactory = new ethers.ContractFactory(
        CONTRACTS_DATA['FinanceManager'].abi,
        CONTRACTS_DATA['FinanceManager'].bytecode,
        signer
      );
      const financeContract = await financeFactory.deploy(govAddr);
      await financeContract.waitForDeployment();
      const financeAddr = await financeContract.getAddress();
      this.editingContracts['funding_address'] = financeAddr;
      this.stateService.showToast('✓ Deploy Finance Manager thành công: ' + financeAddr, 'success');

      // 4. Deploy Marketplace
      this.stateService.showToast('[4/4] Đang deploy Marketplace (Sàn giao dịch)...', 'warning');
      const marketplaceFactory = new ethers.ContractFactory(
        CONTRACTS_DATA['Marketplace'].abi,
        CONTRACTS_DATA['Marketplace'].bytecode,
        signer
      );
      const marketplaceContract = await marketplaceFactory.deploy(govAddr, govAddr);
      await marketplaceContract.waitForDeployment();
      const marketplaceAddr = await marketplaceContract.getAddress();
      this.editingContracts['marketplace_address'] = marketplaceAddr;
      this.stateService.showToast('✓ Deploy Marketplace thành công: ' + marketplaceAddr, 'success');

      this.stateService.showToast('Hoàn tất deploy 4 contracts! Vui lòng nhấn "Lưu cấu hình Smart Contracts" để hoàn tất liên kết vào hệ thống.', 'success');

    } catch (e: any) {
      console.error(e);
      this.stateService.showToast('Lỗi khi deploy: ' + (e.message || 'Unknown'), 'error');
    } finally {
      this.deployAllLoading.set(false);
    }
  }

  // --- BSC API Key ---
  public saveBscApiKey(key: string) {
    localStorage.setItem('ptt_bscscan_api_key', key);
    this.bscApiKey.set(key);
    this.stateService.showToast('API Key đã được lưu (chỉ trên trình duyệt này).', 'success');
  }

  public clearBscApiKey() {
    localStorage.removeItem('ptt_bscscan_api_key');
    this.bscApiKey.set('');
    this.stateService.showToast('Đã xóa API Key.', 'success');
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
    this.contractOwners.update(list => list.filter(a => a !== addr));
  }

  // --- Save contracts ---
  public async handleSaveContracts() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;
    this.saveContractsLoading.set(true);
    try {
      // Tự động ánh xạ treasury và distribution về cùng địa chỉ
      const payload = {
        ...this.editingContracts,
        treasury_address: this.editingContracts['governance_address'],
        distribution_address: this.editingContracts['funding_address'],
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

  // --- Verify source code ---
  public async handleVerify(contractKey: string, contractAddress: string, contractName: string) {
    const apiKey = this.bscApiKey();
    if (!apiKey) {
      this.stateService.showToast('Vui lòng nhập BscScan API Key trước!', 'warning');
      return;
    }
    if (!contractAddress) {
      this.stateService.showToast('Contract chưa có địa chỉ!', 'warning');
      return;
    }
    this.verifyLoading.update(s => ({ ...s, [contractKey]: true }));
    this.verifyStatus.update(s => ({ ...s, [contractKey]: 'checking' }));
    try {
      const url = `https://api-testnet.bscscan.com/api?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === '1' && data.result[0]?.SourceCode) {
        this.verifyStatus.update(s => ({ ...s, [contractKey]: 'verified' }));
        this.stateService.showToast(`${contractName} đã được verify trên BscScan!`, 'success');
      } else {
        const submitRes = await firstValueFrom(
          this.apiService.post<any>('contracts/verify', {
            contract_key: contractKey,
            contract_address: contractAddress,
            bscscan_api_key: apiKey
          })
        );
        this.verifyStatus.update(s => ({ ...s, [contractKey]: 'submitted' }));
        this.stateService.showToast(`Đã submit verify cho ${contractName}. GUID: ${submitRes.guid}`, 'success');
      }
    } catch (e: any) {
      this.verifyStatus.update(s => ({ ...s, [contractKey]: 'error' }));
      this.stateService.showToast('Lỗi khi verify: ' + (e.message || 'Unknown'), 'error');
    } finally {
      this.verifyLoading.update(s => ({ ...s, [contractKey]: false }));
    }
  }
}
