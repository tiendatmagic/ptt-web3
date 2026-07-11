import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { LogoComponent } from '@shared/components/logo/logo.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonComponent, LogoComponent],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  // Tab active
  public activeTab = signal<'overview' | 'staffs'>('overview');

  // Dữ liệu quản lý nhân viên
  public staffsList = signal<any[]>([]);
  public rolesList = signal<any[]>([]);
  public showAddStaffModal = signal<boolean>(false);
  
  public newStaffWallet = '';
  public newStaffRoleId = '';

  // Dữ liệu đăng ký công ty mới
  public showRegisterModal = signal<boolean>(false);
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

  ngOnInit() {
    // Tự động load dữ liệu khi công ty hiện tại thay đổi
    this.loadStaffsData();
  }

  public async loadStaffsData() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      if (this.stateService.hasPermission('staffs.view')) {
        const staffs = await firstValueFrom(this.apiService.get<any[]>('staffs', comp.id));
        this.staffsList.set(staffs || []);
        
        const roles = await firstValueFrom(this.apiService.get<any[]>('roles', comp.id));
        this.rolesList.set(roles || []);
      }
    } catch (e) {
      console.error('Lỗi khi tải thông tin nhân viên:', e);
    }
  }

  // Thay đổi tab
  public setTab(tab: 'overview' | 'staffs') {
    this.activeTab.set(tab);
    if (tab === 'staffs') {
      this.loadStaffsData();
    }
  }

  // Đăng ký công ty mới
  public async handleRegisterCompany() {
    if (!this.newCompany.code || !this.newCompany.name) {
      this.stateService.showToast('Vui lòng điền đầy đủ tên và mã công ty', 'warning');
      return;
    }

    try {
      this.stateService.isLoading.set(true);
      await firstValueFrom(this.apiService.post<any>('companies/register', this.newCompany));
      this.stateService.showToast('Đăng ký doanh nghiệp và liên kết Blockchain thành công!', 'success');
      this.showRegisterModal.set(false);
      
      // Load lại danh sách
      await this.stateService.loadCompanies();
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Có lỗi xảy ra khi đăng ký!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Thêm nhân viên mới
  public async handleAddStaff() {
    if (!this.newStaffWallet || !this.newStaffRoleId) {
      this.stateService.showToast('Vui lòng nhập địa chỉ ví và chọn vai trò', 'warning');
      return;
    }

    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      this.stateService.isLoading.set(true);
      await firstValueFrom(this.apiService.post<any>('staffs', {
        wallet_address: this.newStaffWallet,
        role_id: Number(this.newStaffRoleId)
      }, comp.id));

      this.stateService.showToast('Đã thêm nhân viên thành công!', 'success');
      this.showAddStaffModal.set(false);
      this.newStaffWallet = '';
      this.newStaffRoleId = '';

      // Tải lại danh sách
      await this.loadStaffsData();
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Có lỗi xảy ra!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Vô hiệu hóa nhân viên
  public async handleDeactivateStaff(staffId: number) {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    if (!confirm('Bạn có chắc chắn muốn ngừng kích hoạt nhân sự này không?')) return;

    try {
      this.stateService.isLoading.set(true);
      await firstValueFrom(this.apiService.delete<any>(`staffs/${staffId}`, comp.id));
      this.stateService.showToast('Đã ngừng kích hoạt nhân viên!', 'success');
      
      // Tải lại danh sách
      await this.loadStaffsData();
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Có lỗi xảy ra!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }
}
