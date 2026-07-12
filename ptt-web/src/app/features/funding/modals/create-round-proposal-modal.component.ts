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
  template: `
    <div class="space-y-4">
      <div class="form-field">
        <label>Tên vòng gọi vốn</label>
        <input
          type="text"
          [(ngModel)]="newRound.name"
          placeholder="VD: Vòng gọi vốn Seed..."
          class="form-input focus:border-violet-500"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="form-field">
          <label>Đồng tiền thanh toán</label>
          <app-custom-select
            [options]="paymentOptions"
            valueKey="value"
            labelKey="label"
            [(value)]="newRound.paymentMethod"
            placeholder="Chọn đồng tiền..."
            triggerClass="w-full form-input !h-[42px] !bg-slate-50 !border-slate-200/40 dark:!bg-slate-950/40 dark:!border-slate-800/40 text-sm"
          />
        </div>
        <div class="form-field">
          <label>Giá cổ phần</label>
          <input
            type="text"
            [(ngModel)]="newRound.share_price"
            placeholder="0.1"
            class="form-input focus:border-violet-500"
          />
        </div>
      </div>

      <!-- Hiển thị ô nhập địa chỉ contract stablecoin nếu chọn ERC20 -->
      @if (newRound.paymentMethod === 'ERC20') {
        <div class="form-field bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-900/20">
          <label>Địa chỉ hợp đồng Token (ERC20 Address)</label>
          <input
            type="text"
            [(ngModel)]="newRound.paymentTokenAddress"
            placeholder="0x..."
            class="form-input !bg-white dark:!bg-slate-900 dark:!border-slate-800 focus:border-violet-500 font-mono text-xs"
          />
          <p class="text-[10px] text-slate-400 mt-1">* Vui lòng nhập đúng địa chỉ Contract của Token stablecoin trên mạng lưới (ví dụ: USDT/USDC testnet).</p>
        </div>
      }

      <div class="grid grid-cols-2 gap-4">
        <div class="form-field">
          <label>Số lượng chào bán</label>
          <input
            type="number"
            [(ngModel)]="newRound.max_supply"
            placeholder="100000"
            class="form-input focus:border-violet-500"
          />
        </div>
        <div class="form-field">
          <label>Thời gian bán (Ngày)</label>
          <input
            type="number"
            [(ngModel)]="newRound.duration_days"
            placeholder="30"
            class="form-input focus:border-violet-500"
          />
        </div>
      </div>

      <div class="form-field">
        <label>Hạn biểu quyết (Ngày)</label>
        <input
          type="number"
          [(ngModel)]="newRound.expiration_days"
          placeholder="7"
          class="form-input focus:border-violet-500"
        />
      </div>

      <div class="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-100 dark:border-slate-900/10 text-xs text-slate-500 dark:text-slate-400">
        * Hệ thống sẽ tự động tạo một Đề xuất (Proposal) biểu quyết trên HĐQT. Sau khi đề xuất được các thành viên duyệt và thực thi on-chain, vòng gọi vốn này mới chính thức được mở trên blockchain.
      </div>

      <div class="pt-4 border-t border-slate-100 dark:border-slate-800/60 flex justify-end gap-3 select-none">
        <button
          app-button
          variant="cancel"
          (click)="onCancel()"
        >
          Hủy bỏ
        </button>
        <button
          app-button
          variant="primary"
          (click)="onSubmit()"
          [disabled]="!newRound.name || !newRound.share_price || !newRound.max_supply"
          [loading]="isLoading()"
        >
          Đề xuất mở vòng gọi vốn
        </button>
      </div>
    </div>
  `
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
