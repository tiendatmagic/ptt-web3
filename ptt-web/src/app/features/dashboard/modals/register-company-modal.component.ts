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

      <div class="space-y-1.5">
        <label class="text-xs font-black text-slate-400 uppercase tracking-wider block">Registry Address</label>
        <input
          type="text"
          [(ngModel)]="newCompany.registry_address"
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
    registry_address: '0xb7b937410377F054258Bea7F319618C504088aA4',
    governance_address: '0x1e9566aA637437783A7975CA83106C11dD6ceB43',
    token_address: '0x94F60B66256311A234277f4062dA7E96eA9c201F',
    treasury_address: '0xcB4A894C7B9C4fb7b761e51144b8A4A2b8a1bb35',
    funding_address: '0xF990F64C6c5fe91F2B154679Fa60eFebaDD8c4aA',
    distribution_address: '0x5C02BA4A164646a62a2F32922d3724B417a9F6DA',
    marketplace_address: '0x3Eb99DD69C321AC54a450023EaEFbDb5644CEf3c',
    oracle_address: '0x9251a65fd04922277EF3408846e3322Cc6358a5b'
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
