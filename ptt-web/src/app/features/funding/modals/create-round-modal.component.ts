import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ModalRef } from '@core/services/modal-ref';
import { firstValueFrom } from 'rxjs';

import { ButtonComponent } from '@shared/components/button/button.component';

@Component({
  selector: 'app-create-round-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  template: `
    <div class="space-y-4">
      <div class="space-y-1">
        <label class="text-xs font-black text-slate-400 uppercase">Tên vòng gọi vốn</label>
        <input
          type="text"
          [(ngModel)]="newRound.name"
          placeholder="VD: Vòng gọi vốn Seed..."
          class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:border-violet-500 transition-all"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <label class="text-xs font-black text-slate-400 uppercase">Giá cổ phần (USD)</label>
          <input
            type="number"
            [(ngModel)]="newRound.share_price"
            placeholder="1.0"
            class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:border-violet-500 transition-all"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-black text-slate-400 uppercase">Mục tiêu gọi vốn (USD)</label>
          <input
            type="number"
            [(ngModel)]="newRound.target_amount"
            placeholder="100000"
            class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:border-violet-500 transition-all"
          />
        </div>
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
          [disabled]="!newRound.name || !newRound.share_price || !newRound.target_amount"
          [loading]="isLoading()"
        >
          Tạo vòng
        </button>
      </div>
    </div>
  `
})
export class CreateRoundModalComponent {
  public modalRef = inject(ModalRef);
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  public isLoading = signal(false);

  public newRound = {
    name: 'Series A',
    share_price: '1.0',
    target_amount: '100000',
    start_date: '',
    end_date: ''
  };

  onCancel() {
    this.modalRef.close();
  }

  async onSubmit() {
    if (!this.newRound.name || !this.newRound.share_price || !this.newRound.target_amount) return;
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    this.isLoading.set(true);
    try {
      const price = parseFloat(this.newRound.share_price);
      const target = parseFloat(this.newRound.target_amount);

      await firstValueFrom(this.apiService.post<any>('funding', {
        name: this.newRound.name,
        share_price: price,
        target_amount: target,
        start_date: this.newRound.start_date || null,
        end_date: this.newRound.end_date || null
      }, comp.id));

      this.stateService.showToast(
        'Tạo vòng gọi vốn thành công! Vòng gọi vốn sẽ được tự động kích hoạt sau khi được HĐQT phê duyệt.',
        'success'
      );
      this.modalRef.close(true);
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Có lỗi xảy ra!', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
