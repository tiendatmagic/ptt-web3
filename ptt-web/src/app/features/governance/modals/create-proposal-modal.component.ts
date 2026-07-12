import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ModalRef } from '@core/services/modal-ref';
import { firstValueFrom } from 'rxjs';
import { ethers } from 'ethers';
import { BoardGovernance, EquityToken, FinanceManager } from '../../../core/constants/contracts';

import { ButtonComponent } from '@shared/components/button/button.component';
import { CustomSelectComponent } from '../../../shared/components/custom-select/custom-select.component';

@Component({
  selector: 'app-create-proposal-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, CustomSelectComponent],
  templateUrl: './create-proposal-modal.component.html'
})
export class CreateProposalModalComponent {
  public modalRef = inject(ModalRef);
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  public isLoading = signal(false);

  public proposalTypes = [
    { value: 'MINT', label: 'MINT (Phát hành cổ phần)' },
    { value: 'BURN', label: 'BURN (Hủy cổ phần)' },
    { value: 'WITHDRAW', label: 'WITHDRAW (Rút quỹ BNB)' },
    { value: 'FUNDING_ROUND', label: 'FUNDING_ROUND (Mở gọi vốn)' },
    { value: 'ADD_MEMBER', label: 'ADD_MEMBER (Thêm HĐQT)' },
    { value: 'REMOVE_MEMBER', label: 'REMOVE_MEMBER (Xóa HĐQT)' },
    { value: 'CHANGE_THRESHOLD', label: 'CHANGE_THRESHOLD (Đổi Threshold)' },
    { value: 'PAUSE_TOKEN', label: 'PAUSE_TOKEN (Khóa chuyển nhượng)' },
    { value: 'UNPAUSE_TOKEN', label: 'UNPAUSE_TOKEN (Mở khóa chuyển nhượng)' }
  ];

  public newProposal = {
    title: '',
    description: '',
    type: 'MINT',
    target: '',
    value: '0',
    mintParams: {
      to: '',
      amount: 0
    },
    burnParams: {
      from: '',
      amount: 0
    },
    fundingRoundParams: {
      name: 'Vòng gọi vốn',
      share_price: '0.001',
      max_supply: 100000,
      duration_days: 30
    },
    memberParams: {
      address: ''
    },
    thresholdParams: {
      newThreshold: 1
    },
    expiration_days: 7
  };

  onCancel() {
    this.modalRef.close();
  }

  async onSubmit() {
    if (!this.newProposal.title) return;
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.governance_address || !comp.token_address) {
      this.stateService.showToast('Không tìm thấy cấu hình Smart Contracts của công ty!', 'error');
      return;
    }

    this.isLoading.set(true);
    try {
      const signer = await this.stateService.getSigner();
      const govContract = new ethers.Contract(comp.governance_address, BoardGovernance.abi, signer);

      let target = '';
      let value = '0';
      let calldata = '0x';

      // 1. Phân loại và encode calldata tương ứng
      if (this.newProposal.type === 'WITHDRAW') {
        target = this.newProposal.target;
        value = ethers.parseEther(this.newProposal.value.toString()).toString();
        // Rút BNB đơn giản gửi trực tiếp tới địa chỉ target với value BNB
      } else if (this.newProposal.type === 'MINT') {
        target = comp.token_address;
        const tokenInterface = new ethers.Interface(EquityToken.abi);
        const amountWei = ethers.parseUnits(this.newProposal.mintParams.amount.toString(), 18);
        calldata = tokenInterface.encodeFunctionData('mint', [
          this.newProposal.mintParams.to,
          amountWei
        ]);
      } else if (this.newProposal.type === 'BURN') {
        target = comp.token_address;
        const tokenInterface = new ethers.Interface(EquityToken.abi);
        const amountWei = ethers.parseUnits(this.newProposal.burnParams.amount.toString(), 18);
        calldata = tokenInterface.encodeFunctionData('burnFrom', [
          this.newProposal.burnParams.from,
          amountWei
        ]);
      } else if (this.newProposal.type === 'PAUSE_TOKEN') {
        target = comp.token_address;
        const tokenInterface = new ethers.Interface(EquityToken.abi);
        calldata = tokenInterface.encodeFunctionData('pause', []);
      } else if (this.newProposal.type === 'UNPAUSE_TOKEN') {
        target = comp.token_address;
        const tokenInterface = new ethers.Interface(EquityToken.abi);
        calldata = tokenInterface.encodeFunctionData('unpause', []);
      } else if (this.newProposal.type === 'ADD_MEMBER') {
        target = comp.governance_address;
        const govInterface = new ethers.Interface(BoardGovernance.abi);
        calldata = govInterface.encodeFunctionData('addMember', [
          this.newProposal.memberParams.address
        ]);
      } else if (this.newProposal.type === 'REMOVE_MEMBER') {
        target = comp.governance_address;
        const govInterface = new ethers.Interface(BoardGovernance.abi);
        calldata = govInterface.encodeFunctionData('removeMember', [
          this.newProposal.memberParams.address
        ]);
      } else if (this.newProposal.type === 'CHANGE_THRESHOLD') {
        target = comp.governance_address;
        const govInterface = new ethers.Interface(BoardGovernance.abi);
        calldata = govInterface.encodeFunctionData('changeThreshold', [
          this.newProposal.thresholdParams.newThreshold
        ]);
      } else if (this.newProposal.type === 'FUNDING_ROUND') {
        if (!comp.funding_address) {
          this.stateService.showToast('Không tìm thấy địa chỉ FinanceManager của công ty!', 'error');
          this.isLoading.set(false);
          return;
        }
        target = comp.funding_address;
        const financeInterface = new ethers.Interface(FinanceManager.abi);

        // Quy đổi giá và max supply sang Wei
        const priceWei = ethers.parseEther(this.newProposal.fundingRoundParams.share_price.toString());
        const maxSupplyWei = ethers.parseUnits(this.newProposal.fundingRoundParams.max_supply.toString(), 18);
        const startTime = Math.floor(Date.now() / 1000);
        const endTime = startTime + this.newProposal.fundingRoundParams.duration_days * 86400;

        const params = {
          name: this.newProposal.fundingRoundParams.name,
          shareToken: comp.token_address,
          paymentToken: ethers.ZeroAddress, // mặc định BNB
          treasury: comp.governance_address, // Quỹ rút về két sắt HĐQT
          price: priceWei,
          maxSupply: maxSupplyWei,
          startTime: startTime,
          endTime: endTime,
          minPurchase: 0,
          maxPurchase: 0,
          isWhitelistOnly: false
        };

        calldata = financeInterface.encodeFunctionData('createFundingRound', [params]);
      }

      this.stateService.showToast('Đang gửi đề xuất HĐQT lên blockchain...', 'warning');
      const gasOverrides = await this.stateService.getGasOverrides(signer);
      
      const delaySeconds = 0;
      const durationSeconds = this.newProposal.expiration_days * 86400;

      // 2. Gọi contract createProposal
      const tx = await govContract['createProposal'](
        target,
        value,
        calldata,
        this.newProposal.title,
        delaySeconds,
        durationSeconds,
        gasOverrides
      );

      this.stateService.showToast('Giao dịch đang chờ xác nhận từ blockchain...', 'warning');
      await tx.wait();

      // Đọc proposalCount mới nhất làm onchain_id
      const proposalCount = await govContract['proposalCount']();
      const onchainId = Number(proposalCount);

      // 3. Đồng bộ hóa với Backend DB
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + this.newProposal.expiration_days);

      await firstValueFrom(this.apiService.post<any>('proposals', {
        title: this.newProposal.title,
        description: this.newProposal.description,
        type: this.newProposal.type,
        params: {
          target,
          value,
          calldata,
          onchain_id: onchainId
        },
        expiration_date: expirationDate.toISOString()
      }, comp.id));

      this.stateService.showToast('Tạo đề xuất thành công và đã đồng bộ lên hệ thống!', 'success');
      this.modalRef.close(true);
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || e.error?.message || 'Có lỗi xảy ra khi tạo đề xuất!', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
