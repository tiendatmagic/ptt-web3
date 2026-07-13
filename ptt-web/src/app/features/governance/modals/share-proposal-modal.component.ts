import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalRef, MODAL_DATA } from '@core/services/modal-ref';
import { StateService } from '@core/services/state.service';
import { ButtonComponent } from '@shared/components/button/button.component';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-share-proposal-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, IconComponent],
  template: `
    <div class="space-y-5 flex flex-col items-center py-2 select-none">
      <p class="text-xs text-slate-400 dark:text-slate-500 text-center max-w-sm leading-relaxed">
        Sử dụng mã QR hoặc sao chép liên kết dưới đây để gửi cho các cổ đông, nhà đầu tư hoặc thành viên HĐQT khác tham gia biểu quyết và theo dõi đề xuất này.
      </p>

      <!-- KHU VỰC QR CODE -->
      <div class="p-3 bg-white border border-slate-200/60 dark:border-slate-800/80 rounded-2xl shadow-sm dark:bg-slate-900/60 flex items-center justify-center">
        <img
          [src]="qrCodeUrl"
          alt="Mã QR liên kết đề xuất"
          class="w-[170px] h-[170px] rounded-lg object-contain bg-white p-1"
          (load)="isQrLoading.set(false)"
        />
      </div>

      <!-- Ô LIÊN KẾT CHIA SẺ -->
      <div class="form-field w-full px-1">
        <label>Liên kết trực tiếp</label>
        <div class="flex gap-2 w-full">
          <input
            type="text"
            [value]="shareUrl"
            readonly
            class="form-input flex-1 !font-mono !text-xs select-all focus:border-violet-500"
          />
          <button
            app-button
            variant="primary"
            (click)="copyLink()"
            class="flex items-center gap-1.5 shrink-0"
          >
            <app-icon name="copy" class="w-4 h-4" />
            <span>Sao chép</span>
          </button>
        </div>
      </div>

      <!-- NÚT ĐÓNG (Góc phải đồng bộ) -->
      <div class="w-full pt-4 border-t border-slate-100 dark:border-slate-800/60 flex justify-end select-none">
        <button
          app-button
          variant="cancel"
          (click)="close()"
        >
          Đóng
        </button>
      </div>
    </div>
  `
})
export class ShareProposalModalComponent {
  public modalRef = inject(ModalRef);
  public stateService = inject(StateService);
  public modalData = inject(MODAL_DATA);

  public isQrLoading = signal(true);

  public get shareUrl(): string {
    const proposalId = this.modalData?.proposalId;
    return `${window.location.origin}${window.location.pathname}?proposalId=${proposalId}`;
  }

  public get qrCodeUrl(): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(this.shareUrl)}`;
  }

  copyLink() {
    navigator.clipboard.writeText(this.shareUrl)
      .then(() => {
        this.stateService.showToast('Đã sao chép liên kết đề xuất!', 'success');
      })
      .catch((err) => {
        console.error('Không thể sao chép liên kết:', err);
        this.stateService.showToast('Sao chép thất bại. Vui lòng copy thủ công trên thanh địa chỉ!', 'error');
      });
  }

  close() {
    this.modalRef.close();
  }
}
