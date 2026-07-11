import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-kyc',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonComponent],
  templateUrl: './kyc.component.html'
})
export class KycComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  public kycList = signal<any[]>([]);
  public activeFilter = signal<string>('PENDING');
  public selectedUser = signal<any | null>(null);
  public rejectionReason = '';

  ngOnInit() {
    this.loadKycList();
  }

  public async loadKycList() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      const users = await firstValueFrom(
        this.apiService.get<any[]>('users/kyc', comp.id, { status: this.activeFilter() })
      );
      this.kycList.set(users || []);
    } catch (e) {
      console.error('Lỗi tải danh sách KYC:', e);
    }
  }

  public setFilter(status: string) {
    this.activeFilter.set(status);
    this.loadKycList();
  }

  public async handleApproveKyc(userId: number) {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      this.stateService.isLoading.set(true);
      await firstValueFrom(this.apiService.post<any>(`users/${userId}/kyc/approve`, {}, comp.id));
      this.stateService.showToast('Duyệt KYC thành công! Địa chỉ ví đã được Whitelist lên Blockchain.', 'success');
      this.selectedUser.set(null);
      await this.loadKycList();
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Lỗi xử lý duyệt KYC!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  public async handleRejectKyc(userId: number) {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    if (!this.rejectionReason) {
      this.stateService.showToast('Vui lòng nhập lý do từ chối', 'warning');
      return;
    }

    try {
      this.stateService.isLoading.set(true);
      await firstValueFrom(this.apiService.post<any>(`users/${userId}/kyc/reject`, {
        reason: this.rejectionReason
      }, comp.id));
      this.stateService.showToast('Đã từ chối KYC!', 'success');
      this.selectedUser.set(null);
      this.rejectionReason = '';
      await this.loadKycList();
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Lỗi xử lý từ chối KYC!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }
}
