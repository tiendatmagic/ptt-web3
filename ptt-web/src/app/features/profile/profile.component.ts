import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';
import { ButtonComponent } from '@shared/components/button/button.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, IconComponent],
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);

  // Form signals/properties
  public name = signal<string>('');
  public phone = signal<string>('');
  public email = signal<string>('');
  public address = signal<string>('');
  public isLoading = signal<boolean>(false);

  constructor() {
    // Tự động load dữ liệu khi currentUser thay đổi
    effect(() => {
      const user = this.stateService.currentUser();
      if (user) {
        this.name.set(user.name || '');
        this.phone.set(user.phone || '');
        this.email.set(user.email || '');
        this.address.set(user.address || '');
      }
    });
  }

  ngOnInit(): void {
    const user = this.stateService.currentUser();
    if (user) {
      this.name.set(user.name || '');
      this.phone.set(user.phone || '');
      this.email.set(user.email || '');
      this.address.set(user.address || '');
    }
  }

  public copyWalletAddress(): void {
    const wallet = this.stateService.address();
    if (wallet) {
      navigator.clipboard.writeText(wallet);
      this.toastService.showToast('Đã sao chép địa chỉ ví!', 'success');
    }
  }

  public async handleSaveProfile(): Promise<void> {
    if (!this.stateService.isConnected()) {
      this.toastService.showToast('Vui lòng kết nối ví trước!', 'error');
      return;
    }

    const nameVal = this.name().trim();
    const phoneVal = this.phone().trim();
    const emailVal = this.email().trim();
    const addressVal = this.address().trim();

    if (!nameVal) {
      this.toastService.showToast('Họ và tên là bắt buộc!', 'warning');
      return;
    }

    if (!phoneVal) {
      this.toastService.showToast('Số điện thoại là bắt buộc!', 'warning');
      return;
    }

    this.isLoading.set(true);

    try {
      const response = await firstValueFrom(
        this.apiService.post<{ message: string; user: any }>('users/profile', {
          name: nameVal,
          phone: phoneVal,
          email: emailVal ? emailVal : null,
          address: addressVal ? addressVal : null
        })
      );

      if (response && response.user) {
        // Cập nhật lại thông tin user trong state
        this.stateService.currentUser.set(response.user);
        this.toastService.showToast('Cập nhật trang cá nhân thành công!', 'success');
      } else {
        this.toastService.showToast('Không nhận được phản hồi hợp lệ từ máy chủ!', 'error');
      }
    } catch (error: any) {
      console.error(error);
      const errMsg = error.error?.message || 'Có lỗi xảy ra khi lưu thông tin!';
      this.toastService.showToast(errMsg, 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
