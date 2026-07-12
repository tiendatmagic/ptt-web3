import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ModalRef } from '@core/services/modal-ref';
import { firstValueFrom } from 'rxjs';
import { ethers } from 'ethers';
import { BoardGovernance, EquityToken } from '../../../core/constants/contracts';

import { ButtonComponent } from '@shared/components/button/button.component';

@Component({
  selector: 'app-create-proposal-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  template: `
    <div class="space-y-4">
      <div class="space-y-1">
        <label class="text-xs font-black text-slate-400 uppercase">Tiêu đề đề xuất</label>
        <input
          type="text"
          [(ngModel)]="newProposal.title"
          placeholder="VD: Mint 1,000,000 PTT cho cổ đông mới..."
          class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:border-violet-500 transition-all"
        />
      </div>

      <div class="space-y-1">
        <label class="text-xs font-black text-slate-400 uppercase">Mô tả</label>
        <textarea
          [(ngModel)]="newProposal.description"
          rows="2"
          placeholder="Mô tả mục đích và phân tích tài chính của quyết định này..."
          class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:border-violet-500 transition-all"
        ></textarea>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <label class="text-xs font-black text-slate-400 uppercase">Loại đề xuất</label>
          <select
            [(ngModel)]="newProposal.type"
            class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:border-violet-500 transition-all"
          >
            <option value="MINT">MINT (Phát hành cổ phần)</option>
            <option value="BURN">BURN (Hủy cổ phần)</option>
            <option value="WITHDRAW">WITHDRAW (Rút quỹ BNB)</option>
            <option value="ADD_MEMBER">ADD_MEMBER (Thêm HĐQT)</option>
            <option value="REMOVE_MEMBER">REMOVE_MEMBER (Xóa HĐQT)</option>
            <option value="CHANGE_THRESHOLD">CHANGE_THRESHOLD (Đổi Threshold)</option>
            <option value="PAUSE_TOKEN">PAUSE_TOKEN (Khóa chuyển nhượng)</option>
            <option value="UNPAUSE_TOKEN">UNPAUSE_TOKEN (Mở khóa chuyển nhượng)</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-xs font-black text-slate-400 uppercase">Hạn biểu quyết (Ngày)</label>
          <input
            type="number"
            [(ngModel)]="newProposal.expiration_days"
            class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:border-violet-500 transition-all"
          />
        </div>
      </div>

      <!-- TRƯỜNG NHẬP DỮ LIỆU ĐỘNG TÙY THEO LOẠI PROPOSAL -->
      
      <!-- 1. MINT CO PHAN -->
      @if (newProposal.type === 'MINT') {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-900/20">
          <div class="space-y-1">
            <label class="text-xs font-black text-slate-400 uppercase">Địa chỉ ví nhận</label>
            <input
              type="text"
              [(ngModel)]="newProposal.mintParams.to"
              placeholder="0x..."
              class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-xs outline-none focus:border-violet-500 transition-all"
            />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-black text-slate-400 uppercase">Số lượng cổ phần</label>
            <input
              type="number"
              [(ngModel)]="newProposal.mintParams.amount"
              placeholder="VD: 50000"
              class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-semibold outline-none focus:border-violet-500 transition-all"
            />
          </div>
        </div>
      }

      <!-- 2. BURN CO PHAN -->
      @if (newProposal.type === 'BURN') {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-900/20">
          <div class="space-y-1">
            <label class="text-xs font-black text-slate-400 uppercase">Địa chỉ ví bị hủy</label>
            <input
              type="text"
              [(ngModel)]="newProposal.burnParams.from"
              placeholder="0x..."
              class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-xs outline-none focus:border-violet-500 transition-all"
            />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-black text-slate-400 uppercase">Số lượng cổ phần</label>
            <input
              type="number"
              [(ngModel)]="newProposal.burnParams.amount"
              placeholder="VD: 50000"
              class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-semibold outline-none focus:border-violet-500 transition-all"
            />
          </div>
        </div>
      }

      <!-- 3. WITHDRAW BNB -->
      @if (newProposal.type === 'WITHDRAW') {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-900/20">
          <div class="space-y-1">
            <label class="text-xs font-black text-slate-400 uppercase">Địa chỉ ví thụ hưởng</label>
            <input
              type="text"
              [(ngModel)]="newProposal.target"
              placeholder="0x..."
              class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-xs outline-none focus:border-violet-500 transition-all"
            />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-black text-slate-400 uppercase">Số lượng BNB</label>
            <input
              type="text"
              [(ngModel)]="newProposal.value"
              placeholder="VD: 0.5"
              class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-semibold outline-none focus:border-violet-500 transition-all"
            />
          </div>
        </div>
      }

      <!-- 4. ADD / REMOVE MEMBER HĐQT -->
      @if (newProposal.type === 'ADD_MEMBER' || newProposal.type === 'REMOVE_MEMBER') {
        <div class="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-900/20 space-y-1">
          <label class="text-xs font-black text-slate-400 uppercase">Địa chỉ ví thành viên HĐQT</label>
          <input
            type="text"
            [(ngModel)]="newProposal.memberParams.address"
            placeholder="0x..."
            class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-xs outline-none focus:border-violet-500 transition-all"
          />
        </div>
      }

      <!-- 5. CHANGE THRESHOLD -->
      @if (newProposal.type === 'CHANGE_THRESHOLD') {
        <div class="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-900/20 space-y-1">
          <label class="text-xs font-black text-slate-400 uppercase">Số chữ ký tối thiểu mới</label>
          <input
            type="number"
            [(ngModel)]="newProposal.thresholdParams.newThreshold"
            placeholder="VD: 2"
            class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-semibold outline-none focus:border-violet-500 transition-all"
          />
        </div>
      }

      <!-- 6. PAUSE / UNPAUSE TOKEN -->
      @if (newProposal.type === 'PAUSE_TOKEN' || newProposal.type === 'UNPAUSE_TOKEN') {
        <div class="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-100 dark:border-slate-900/10 text-xs text-slate-500 dark:text-slate-400">
          * Đề xuất này sẽ gửi yêu cầu khóa hoặc mở khóa chức năng chuyển nhượng giao dịch của Cổ phần. Không cần tham số đầu vào.
        </div>
      }

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
          [disabled]="!newProposal.title"
          [loading]="isLoading()"
        >
          Tạo và Gửi On-chain
        </button>
      </div>
    </div>
  `
})
export class CreateProposalModalComponent {
  public modalRef = inject(ModalRef);
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  public isLoading = signal(false);

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
        value = ethers.parseEther(this.newProposal.value).toString();
        calldata = '0x';
      } else if (this.newProposal.type === 'MINT') {
        target = comp.token_address;
        const tokenInterface = new ethers.Interface(EquityToken.abi);
        calldata = tokenInterface.encodeFunctionData('mint', [
          this.newProposal.mintParams.to,
          ethers.parseUnits(this.newProposal.mintParams.amount.toString(), 18)
        ]);
      } else if (this.newProposal.type === 'BURN') {
        target = comp.token_address;
        const tokenInterface = new ethers.Interface(EquityToken.abi);
        calldata = tokenInterface.encodeFunctionData('burn', [
          this.newProposal.burnParams.from,
          ethers.parseUnits(this.newProposal.burnParams.amount.toString(), 18)
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
        calldata = govInterface.encodeFunctionData('addMember', [this.newProposal.memberParams.address]);
      } else if (this.newProposal.type === 'REMOVE_MEMBER') {
        target = comp.governance_address;
        const govInterface = new ethers.Interface(BoardGovernance.abi);
        calldata = govInterface.encodeFunctionData('removeMember', [this.newProposal.memberParams.address]);
      } else if (this.newProposal.type === 'CHANGE_THRESHOLD') {
        target = comp.governance_address;
        const govInterface = new ethers.Interface(BoardGovernance.abi);
        calldata = govInterface.encodeFunctionData('changeThreshold', [this.newProposal.thresholdParams.newThreshold]);
      }

      // Xác thực dữ liệu
      if (!target || !ethers.isAddress(target)) {
        this.stateService.showToast('Địa chỉ ví đích (Target) không hợp lệ!', 'error');
        this.isLoading.set(false);
        return;
      }

      this.stateService.showToast('Vui lòng xác nhận giao dịch tạo đề xuất trên ví MetaMask...', 'warning');
      const gasOverrides = await this.stateService.getGasOverrides(signer);
      
      const delaySeconds = 0; // Cho phép thực thi ngay sau khi đủ chữ ký
      const durationSeconds = this.newProposal.expiration_days * 86400; // giây

      // Gọi transaction createProposal on-chain
      const tx = await govContract['createProposal'](
        target,
        value,
        calldata,
        this.newProposal.title,
        delaySeconds,
        durationSeconds,
        gasOverrides
      );

      this.stateService.showToast('Giao dịch đã gửi. Đang chờ xác nhận từ mạng lưới...', 'warning');
      await tx.wait();

      // Lấy onchain_id bằng cách đọc proposalCount hiện tại
      const proposalCount = await govContract['proposalCount']();
      const onchainId = Number(proposalCount);

      // Lưu thông tin đồng bộ về database Backend
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

      this.stateService.showToast('Đã tạo đề xuất on-chain và ghi nhận đồng bộ thành công!', 'success');
      this.modalRef.close(true);
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || e.error?.message || 'Lỗi xảy ra trong quá trình giao dịch!', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
