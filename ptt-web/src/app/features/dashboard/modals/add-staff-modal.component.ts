import { Component, Inject, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ModalRef, MODAL_DATA } from '@core/services/modal-ref';
import { firstValueFrom } from 'rxjs';

import { ButtonComponent } from '@shared/components/button/button.component';
import { CustomSelectComponent } from '../../../shared/components/custom-select/custom-select.component';

@Component({
  selector: 'app-add-staff-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, CustomSelectComponent],
  template: `
    <div class="space-y-4">
      <div class="form-field">
        <label>Địa chỉ ví (Wallet Address)</label>
        <input
          type="text"
          [(ngModel)]="newStaffWallet"
          placeholder="0x..."
          class="form-input focus:border-violet-500 font-mono text-xs"
        />
      </div>

      <div class="form-field">
        <label>Vai trò</label>
        <app-custom-select
          [options]="roleOptions()"
          valueKey="id"
          labelKey="name"
          [(value)]="newStaffRoleId"
          placeholder="Chọn vai trò..."
          triggerClass="w-full form-input !h-[42px] !bg-slate-50 !border-slate-200/40 dark:!bg-slate-900 dark:!border-slate-800 text-sm"
        />
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

  // Convert roles list to options compatible with custom-select
  public roleOptions = computed(() => {
    return (this.data.roles || []).map(role => ({
      id: role.id.toString(), // custom-select làm việc tốt nhất với string values
      name: this.getRoleDisplayName(role.name)
    }));
  });

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
