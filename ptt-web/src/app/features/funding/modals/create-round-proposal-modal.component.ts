import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ModalRef } from '@core/services/modal-ref';
import { firstValueFrom } from 'rxjs';
import { ethers } from 'ethers';
import { BoardGovernance, FinanceManager } from '../../../core/constants/contracts';

import { ButtonComponent } from '@shared/components/button/button.component';
import { CustomSelectComponent } from '../../../shared/components/custom-select/custom-select.component';

@Component({
  selector: 'app-create-round-proposal-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, CustomSelectComponent],
  templateUrl: './create-round-proposal-modal.component.html'
})
export class CreateRoundProposalModalComponent {
  public modalRef = inject(ModalRef);
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  public isLoading = signal(false);

  public paymentOptions = [
    { value: 'ERC20', label: 'USDT / USDC' },
    { value: 'BNB', label: 'BNB (Native)' }
  ];

  public newRound = {
    name: 'Vòng Seed',
    share_price: '0.1', // stablecoin mặc định giá 0.1
    max_supply: 100000,
    duration_days: 30,
    expiration_days: 7,
    paymentMethod: 'ERC20', // Mặc định là Stablecoin
    paymentTokenAddress: ''
  };

  onCancel() {
    this.modalRef.close();
  }

  async onSubmit() {
    if (!this.newRound.name || !this.newRound.share_price || !this.newRound.max_supply) return;
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.governance_address || !comp.funding_address || !comp.token_address) {
      this.stateService.showToast('Cấu hình Smart Contracts của doanh nghiệp chưa hoàn chỉnh!', 'error');
      return;
    }

    this.isLoading.set(true);
    try {
      const signer = await this.stateService.getSigner();
      const govContract = new ethers.Contract(comp.governance_address, BoardGovernance.abi, signer);

      const target = comp.funding_address;
      const value = '0';
      const financeInterface = new ethers.Interface(FinanceManager.abi);

      // Cấu hình tham số gọi vốn on-chain
      let paymentToken = ethers.ZeroAddress;
      if (this.newRound.paymentMethod === 'ERC20') {
        if (!this.newRound.paymentTokenAddress || !ethers.isAddress(this.newRound.paymentTokenAddress)) {
          this.stateService.showToast('Địa chỉ hợp đồng Token thanh toán không hợp lệ!', 'error');
          this.isLoading.set(false);
          return;
        }
        paymentToken = this.newRound.paymentTokenAddress;
      }

      // Giá trị share_price được quy đổi sang Wei (18 decimals)
      const priceWei = ethers.parseEther(this.newRound.share_price.toString());
      const maxSupplyWei = ethers.parseUnits(this.newRound.max_supply.toString(), 18);
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + this.newRound.duration_days * 86400;

      const params = {
        name: this.newRound.name,
        shareToken: comp.token_address,
        paymentToken: paymentToken,
        treasury: comp.governance_address,
        price: priceWei,
        maxSupply: maxSupplyWei,
        startTime: startTime,
        endTime: endTime,
        minPurchase: 0,
        maxPurchase: 0,
        isWhitelistOnly: false
      };

      const calldata = financeInterface.encodeFunctionData('createFundingRound', [params]);

      this.stateService.showToast('Vui lòng xác nhận giao dịch gửi đề xuất lên HĐQT qua MetaMask...', 'warning');
      const gasOverrides = await this.stateService.getGasOverrides(signer);
      
      const delaySeconds = 0;
      const durationSeconds = this.newRound.expiration_days * 86400;
      const proposalTitle = `Mở vòng gọi vốn: ${this.newRound.name}`;

      // 1. Gửi transaction tạo proposal lên blockchain
      const tx = await govContract['createProposal'](
        target,
        value,
        calldata,
        proposalTitle,
        delaySeconds,
        durationSeconds,
        gasOverrides
      );

      this.stateService.showToast('Giao dịch đang chờ xác nhận từ mạng lưới...', 'warning');
      await tx.wait();

      // Đọc proposalCount mới nhất làm onchain_id
      const proposalCount = await govContract['proposalCount']();
      const onchainId = Number(proposalCount);

      // 2. Đồng bộ tạo Proposal trên Backend DB
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + this.newRound.expiration_days);

      await firstValueFrom(this.apiService.post<any>('proposals', {
        title: proposalTitle,
        description: `Mở vòng gọi vốn ${this.newRound.name} thanh toán bằng ${this.newRound.paymentMethod}. Giá ${this.newRound.share_price} / Share, giới hạn chào bán ${this.newRound.max_supply} cổ phần.`,
        type: 'FUNDING_ROUND',
        params: {
          target,
          value,
          calldata,
          onchain_id: onchainId
        },
        expiration_date: expirationDate.toISOString()
      }, comp.id));

      // 3. Đồng bộ tạo Vòng gọi vốn tạm thời (DRAFT) trên Backend DB
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + this.newRound.duration_days);

      // Quy đổi mục tiêu gọi vốn = max_supply * price
      const targetAmountBnb = Number(this.newRound.max_supply) * parseFloat(this.newRound.share_price);

      await firstValueFrom(this.apiService.post<any>('funding', {
        name: this.newRound.name,
        share_price: parseFloat(this.newRound.share_price),
        target_amount: targetAmountBnb,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      }, comp.id));

      this.stateService.showToast('Đã đề xuất vòng gọi vốn thành công! Chờ HĐQT ký duyệt biểu quyết.', 'success');
      this.modalRef.close(true);
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || e.error?.message || 'Lỗi xảy ra trong quá trình đề xuất!', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
