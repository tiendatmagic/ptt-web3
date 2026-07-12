import { Component, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ModalRef, MODAL_DATA } from '@core/services/modal-ref';
import { firstValueFrom } from 'rxjs';

import { ButtonComponent } from '@shared/components/button/button.component';

@Component({
  selector: 'app-add-staff-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  template: `
    <div class="space-y-4">
      <div class="space-y-1.5">
        <label class="text-xs font-black text-slate-400 uppercase tracking-wider block">Địa chỉ ví (Wallet Address)</label>
        <input
          type="text"
          [(ngModel)]="newStaffWallet"
          placeholder="0x..."
          class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-mono text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
        />
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-black text-slate-400 uppercase tracking-wider block">Vai trò</label>
        <select
          [(ngModel)]="newStaffRoleId"
          class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
        >
          <option value="" disabled selected>Chọn vai trò...</option>
          @for (role of data.roles; track role.id) {
            <option [value]="role.id">{{ getRoleDisplayName(role.name) }}</option>
          }
        </select>
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
          [disabled]="!newStaffWallet || !newStaffRoleId"
          [loading]="isLoading()"
        >
          Thêm thành viên
        </button>
      </div>
    </div>
  `
})
export class AddStaffModalComponent {
  public modalRef = inject(ModalRef);
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  public newStaffWallet = '';
  public newStaffRoleId = '';
  public isLoading = signal(false);

  constructor(@Inject(MODAL_DATA) public data: { roles: any[] }) {}

  public getRoleDisplayName(name: string): string {
    const map: Record<string, string> = {
      'Owner': 'Chủ HĐQT',
      'Board Member': 'Thành viên HĐQT',
      'Chủ quán': 'Chủ HĐQT',
      'Quản lý': 'Thành viên HĐQT',
      'Manager': 'Thành viên HĐQT',
      'Thu ngân': 'Nhân viên',
      'Cashier': 'Nhân viên',
      'Kế toán': 'Kế toán',
      'Accountant': 'Kế toán'
    };
    return map[name] || name;
  }

  onCancel() {
    this.modalRef.close();
  }

  async onSubmit() {
    if (!this.newStaffWallet || !this.newStaffRoleId) return;
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    this.isLoading.set(true);
    try {
      await firstValueFrom(this.apiService.post<any>('staffs', {
        wallet_address: this.newStaffWallet,
        role_id: Number(this.newStaffRoleId)
      }, comp.id));

      this.stateService.showToast('Đã thêm nhân viên thành công!', 'success');
      this.modalRef.close(true); // Close and signal success
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Có lỗi xảy ra!', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
