import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ModalRef } from '@core/services/modal-ref';
import { firstValueFrom } from 'rxjs';

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
          placeholder="VD: Rút quỹ Treasury chi tiêu vận hành..."
          class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:border-violet-500 transition-all"
        />
      </div>

      <div class="space-y-1">
        <label class="text-xs font-black text-slate-400 uppercase">Mô tả</label>
        <textarea
          [(ngModel)]="newProposal.description"
          rows="3"
          placeholder="Mô tả mục đích và phân tích tài chính..."
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
            <option value="WITHDRAW">WITHDRAW (Rút quỹ)</option>
            <option value="MINT">MINT (Phát hành thêm)</option>
            <option value="CONFIG">CONFIG (Cấu hình hệ thống)</option>
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

      <div class="space-y-1">
        <label class="text-xs font-black text-slate-400 uppercase">Địa chỉ ví thụ hưởng (Target)</label>
        <input
          type="text"
          [(ngModel)]="newProposal.params.target"
          placeholder="0x..."
          class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-mono text-xs outline-none focus:border-violet-500 transition-all"
        />
      </div>

      <div class="space-y-1">
        <label class="text-xs font-black text-slate-400 uppercase">Số lượng BNB rút (Value in WEI)</label>
        <input
          type="text"
          [(ngModel)]="newProposal.params.value"
          class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-mono text-xs outline-none focus:border-violet-500 transition-all"
        />
      </div>

      <div class="pt-4 border-t border-slate-100 dark:border-slate-800/60 flex justify-end gap-3">
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
          Tạo đề xuất
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
    type: 'WITHDRAW',
    params: {
      target: '',
      value: '0',
      calldata: '0x'
    },
    expiration_days: 7
  };

  onCancel() {
    this.modalRef.close();
  }

  async onSubmit() {
    if (!this.newProposal.title) return;
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    this.isLoading.set(true);
    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + this.newProposal.expiration_days);

      await firstValueFrom(this.apiService.post<any>('proposals', {
        title: this.newProposal.title,
        description: this.newProposal.description,
        type: this.newProposal.type,
        params: this.newProposal.params,
        expiration_date: expirationDate.toISOString()
      }, comp.id));

      this.stateService.showToast('Tạo đề xuất thành công!', 'success');
      this.modalRef.close(true);
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Có lỗi xảy ra!', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
