import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '@core/services/state.service';
import { ModalRef } from '@core/services/modal-ref';
import { ButtonComponent } from '@shared/components/button/button.component';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-deposit-modal',
  standalone: true,
  imports: [CommonModule, ButtonComponent, IconComponent],
  template: `
    <div class="space-y-5 text-center flex flex-col items-center">
      <div class="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center text-violet-600">
        <app-icon name="bank" class="w-6 h-6" />
      </div>

      <div class="space-y-1">
        <h3 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
          Nạp Quỹ Doanh Nghiệp (Treasury)
        </h3>
        <p class="text-xs text-slate-400 max-w-[280px] mx-auto">
          Quét mã QR hoặc sao chép địa chỉ ví HĐQT để nạp tài sản (BNB, USDT, USDC...) vào quỹ công ty.
        </p>
      </div>

      <!-- QR Code -->
      <div class="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center">
        <img 
          [src]="qrCodeUrl()" 
          alt="QR Code" 
          class="w-[180px] h-[180px] block" 
        />
      </div>

      <!-- Monospace Address & Copy -->
      <div class="w-full bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/40 flex items-center justify-between gap-3 min-w-0">
        <span class="font-mono text-xs text-slate-700 dark:text-slate-300 truncate select-all text-left flex-1">
          {{ address() }}
        </span>
        <button
          (click)="copyAddress()"
          class="shrink-0 flex items-center justify-center p-2 rounded-lg bg-white dark:bg-slate-950 text-slate-400 hover:text-violet-500 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 shadow-sm active:scale-95 transition-all duration-150"
          title="Sao chép địa chỉ"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
        </button>
      </div>

      <!-- Warnings/Tips -->
      <div class="w-full text-left bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/20 p-3 rounded-xl flex gap-3 text-xs text-amber-700 dark:text-amber-400">
        <app-icon name="lock" class="w-4 h-4 shrink-0 mt-0.5" />
        <div class="space-y-1 leading-normal">
          <p class="font-black">Lưu ý quan trọng:</p>
          <ul class="list-disc pl-4 space-y-0.5">
            <li>Chỉ gửi các tài sản được hệ thống hỗ trợ (BNB, USDT, USDC) qua đúng mạng lưới blockchain của công ty.</li>
            <li>Tài sản nạp vào sẽ thuộc quyền quản lý chung của HĐQT và chỉ có thể rút ra thông qua **Đề xuất biểu quyết đa chữ ký (Multisig)**.</li>
          </ul>
        </div>
      </div>

      <!-- Action Button -->
      <div class="w-full pt-4 border-t border-slate-100 dark:border-slate-800/60 select-none">
        <button
          app-button
          variant="cancel"
          (click)="onClose()"
          class="w-full"
        >
          Đóng
        </button>
      </div>
    </div>
  `
})
export class DepositModalComponent {
  public modalRef = inject(ModalRef);
  public stateService = inject(StateService);

  public address(): string {
    const comp = this.stateService.currentCompany();
    return comp?.governance_address || '';
  }

  public qrCodeUrl(): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${this.address()}`;
  }

  copyAddress() {
    this.stateService.copyToClipboard(this.address(), 'Đã sao chép địa chỉ ví quỹ!');
  }

  onClose() {
    this.modalRef.close();
  }
}
