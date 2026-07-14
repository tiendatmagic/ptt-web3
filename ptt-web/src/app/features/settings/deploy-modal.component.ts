import { Component, Inject, OnInit, Optional, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ethers } from 'ethers';
import { firstValueFrom } from 'rxjs';
import { MODAL_DATA, ModalRef } from '@core/services/modal-ref';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ButtonComponent } from '@shared/components/button/button.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CustomSliderComponent } from '@shared/components/custom-slider/custom-slider.component';
import { BoardGovernance, EquityToken, FinanceManager, Marketplace } from '@core/constants/contracts';

interface DeployModalData {
  owners: string[];
  minSignatures: number;
  tokenName: string;
  tokenSymbol: string;
  company: any;
}

@Component({
  selector: 'app-deploy-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, IconComponent, CustomSliderComponent],
  templateUrl: './deploy-modal.component.html',
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class DeployModalComponent implements OnInit {
  // Trạng thái modal: 'confirm' (xác nhận) | 'deploying' (đang chạy) | 'success' (thành công) | 'error' (lỗi)
  public status = signal<'confirm' | 'deploying' | 'success' | 'error'>('confirm');
  
  public currentStep = signal<number>(0);
  public statusText = signal<string>('Đang chuẩn bị triển khai...');
  public errorMessage = signal<string>('');

  // Lưu địa chỉ các contract đã deploy
  public deployedAddresses = {
    governance_address: '',
    funding_address: '',
    marketplace_address: '',
    token_address: ''
  };

  // Danh sách các bước hiển thị log
  public logs = signal<Array<{ name: string; status: 'pending' | 'running' | 'success' | 'error'; address?: string }>>([
    { name: 'Board Governance (HĐQT Đa chữ ký)', status: 'pending' },
    { name: 'Finance Manager (Gọi vốn & Cổ tức)', status: 'pending' },
    { name: 'Marketplace (Sàn Giao dịch)', status: 'pending' },
    { name: 'Equity Token (Cổ phần Doanh nghiệp)', status: 'pending' }
  ]);

  constructor(
    public stateService: StateService,
    private apiService: ApiService,
    @Optional() private modalRef: ModalRef<any>,
    @Optional() @Inject(MODAL_DATA) public data: DeployModalData
  ) {}

  ngOnInit(): void {
    if (!this.data) {
      this.errorMessage.set('Không có dữ liệu cấu hình deploy!');
      this.status.set('error');
    }
  }

  public onCancel(): void {
    if (this.status() === 'deploying') return;
    this.modalRef.close(false);
  }

  public async startDeploy(): Promise<void> {
    this.status.set('deploying');
    this.currentStep.set(0);
    this.statusText.set('Đang kết nối ví và kiểm tra mạng lưới...');

    const signer = await this.stateService.getSigner();
    if (!signer) {
      this.handleError('Không thể lấy signer từ ví Metamask. Vui lòng kết nối ví và thử lại!');
      return;
    }

    try {
      // BƯỚC 1: Deploy BoardGovernance
      this.updateLog(0, 'running');
      this.currentStep.set(1);
      this.statusText.set('[1/4] Đang deploy Board Governance. Vui lòng duyệt giao dịch trên Metamask...');
      
      const govFactory = new ethers.ContractFactory(BoardGovernance.abi, BoardGovernance.bytecode, signer);
      const govContract = await govFactory.deploy(this.data.owners, this.data.minSignatures);
      await govContract.waitForDeployment();
      const govAddr = await govContract.getAddress();
      
      this.deployedAddresses.governance_address = govAddr;
      this.updateLog(0, 'success', govAddr);

      // BƯỚC 2: Deploy FinanceManager
      this.updateLog(1, 'running');
      this.currentStep.set(2);
      this.statusText.set('[2/4] Đang deploy Finance Manager. Vui lòng duyệt giao dịch trên Metamask...');
      
      const financeFactory = new ethers.ContractFactory(FinanceManager.abi, FinanceManager.bytecode, signer);
      const financeContract = await financeFactory.deploy(govAddr);
      await financeContract.waitForDeployment();
      const financeAddr = await financeContract.getAddress();
      
      this.deployedAddresses.funding_address = financeAddr;
      this.updateLog(1, 'success', financeAddr);

      // BƯỚC 3: Deploy Marketplace
      this.updateLog(2, 'running');
      this.currentStep.set(3);
      this.statusText.set('[3/4] Đang deploy Marketplace. Vui lòng duyệt giao dịch trên Metamask...');
      
      const marketplaceFactory = new ethers.ContractFactory(Marketplace.abi, Marketplace.bytecode, signer);
      const marketplaceContract = await marketplaceFactory.deploy(govAddr, govAddr);
      await marketplaceContract.waitForDeployment();
      const marketplaceAddr = await marketplaceContract.getAddress();
      
      this.deployedAddresses.marketplace_address = marketplaceAddr;
      this.updateLog(2, 'success', marketplaceAddr);

      // BƯỚC 4: Deploy Equity Token
      this.updateLog(3, 'running');
      this.currentStep.set(4);
      this.statusText.set('[4/4] Đang deploy Equity Token. Vui lòng duyệt giao dịch trên Metamask...');
      
      const deployerAddr = await signer.getAddress();
      const tokenFactory = new ethers.ContractFactory(EquityToken.abi, EquityToken.bytecode, signer);
      const tokenContract = await tokenFactory.deploy(
        this.data.tokenName.trim(),
        this.data.tokenSymbol.trim(),
        govAddr,
        [financeAddr, marketplaceAddr, deployerAddr]
      );
      await tokenContract.waitForDeployment();
      const tokenAddr = await tokenContract.getAddress();
      
      this.deployedAddresses.token_address = tokenAddr;
      this.updateLog(3, 'success', tokenAddr);

      // BƯỚC 5: Lưu cấu hình lên máy chủ
      this.statusText.set('Đang đồng bộ địa chỉ Smart Contracts lên hệ thống...');
      await this.saveContractsToBackend();

      this.status.set('success');
    } catch (error: any) {
      console.error(error);
      // Đánh dấu bước hiện tại bị lỗi
      const stepIdx = Math.min(3, Math.max(0, this.currentStep() - 1));
      this.updateLog(stepIdx, 'error');
      
      let msg = error.message || 'Unknown error occurred';
      if (msg.includes('user rejected action') || msg.includes('rejected')) {
        msg = 'Giao dịch bị từ chối bởi người dùng trên MetaMask.';
      }
      this.handleError(msg);
    }
  }

  private updateLog(index: number, status: 'pending' | 'running' | 'success' | 'error', address?: string) {
    this.logs.update(list => {
      const newList = [...list];
      newList[index] = { ...newList[index], status, address };
      return newList;
    });
  }

  private handleError(message: string) {
    this.errorMessage.set(message);
    this.status.set('error');
  }

  private async saveContractsToBackend(): Promise<void> {
    const payload = {
      ...this.deployedAddresses,
      chain_id: this.stateService.chainId()
    };
    const res = await firstValueFrom(
      this.apiService.put<any>(`companies/${this.data.company.id}/contracts`, payload)
    );
    if (res && res.company) {
      // Đồng bộ StateService ngay lập tức để giao diện phía sau cập nhật địa chỉ
      const updated = { ...this.data.company, ...res.company };
      this.stateService.currentCompany.set(updated);
      
      const currentList = this.stateService.companiesList();
      const updatedList = currentList.map(c => c.id === this.data.company.id ? updated : c);
      this.stateService.companiesList.set(updatedList);

      this.deployedAddresses = {
        governance_address: res.company.governance_address || '',
        funding_address: res.company.funding_address || '',
        marketplace_address: res.company.marketplace_address || '',
        token_address: res.company.token_address || ''
      };
    } else {
      throw new Error('Lưu cấu hình thất bại. Phản hồi từ máy chủ không hợp lệ.');
    }
  }

  public closeSuccess(): void {
    // Trả về kết quả thành công và dữ liệu mới nhất
    this.modalRef.close({ success: true, addresses: this.deployedAddresses });
  }
}
