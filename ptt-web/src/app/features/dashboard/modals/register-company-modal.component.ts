import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ModalRef } from '@core/services/modal-ref';
import { firstValueFrom } from 'rxjs';

import { ButtonComponent } from '@shared/components/button/button.component';

@Component({
  selector: 'app-register-company-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  template: `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1.5">
          <label class="text-xs font-black text-slate-400 uppercase tracking-wider block">Tên công ty</label>
          <input
            type="text"
            [(ngModel)]="newCompany.name"
            placeholder="Tên đầy đủ..."
            class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:border-violet-500 transition-all"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-black text-slate-400 uppercase tracking-wider block">Mã cổ phần</label>
          <input
            type="text"
            [(ngModel)]="newCompany.code"
            placeholder="VD: PTT"
            class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:border-violet-500 transition-all uppercase"
          />
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-black text-slate-400 uppercase tracking-wider block">Định giá công ty ($ USD)</label>
        <input
          type="number"
          [(ngModel)]="newCompany.valuation"
          class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:border-violet-500 transition-all"
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
          [disabled]="!newCompany.name || !newCompany.code"
          [loading]="isLoading()"
        >
          Đăng ký &amp; Liên kết
        </button>
      </div>
    </div>
  `
})
export class RegisterCompanyModalComponent {
  public modalRef = inject(ModalRef);
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  public isLoading = signal(false);

  public newCompany = {
    code: 'PTT',
    name: 'PTT Group Corporation',
    logo: '',
    valuation: 10000000,
    registry_address: '',
    governance_address: '',
    token_address: '',
    funding_address: '',
    marketplace_address: '',
    oracle_address: ''
  };

  onCancel() {
    this.modalRef.close();
  }

  async onSubmit() {
    if (!this.newCompany.name || !this.newCompany.code) return;

    this.isLoading.set(true);
    try {
      await firstValueFrom(this.apiService.post<any>('companies/register', this.newCompany));
      this.stateService.showToast('Đăng ký doanh nghiệp thành công!', 'success');
      this.modalRef.close(true);
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Đăng ký thất bại!', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
