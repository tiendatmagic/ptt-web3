import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { firstValueFrom } from 'rxjs';
import { ethers } from 'ethers';

import { ModalService } from '@core/services/modal.service';
import { AddStaffModalComponent } from './modals/add-staff-modal.component';
import { RegisterCompanyModalComponent } from './modals/register-company-modal.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { TabGroupComponent } from '@shared/components/tab-group/tab-group.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ShortAddressPipe } from '@shared/pipes/short-address.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ButtonComponent, TabGroupComponent, IconComponent, ShortAddressPipe],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);
  private modalService = inject(ModalService);

  // Tab active
  public activeTab = signal<'overview' | 'staffs'>('overview');
  public tabOptions = computed(() => {
    const options = [
      { value: 'overview', label: 'Tổng quan', icon: 'pos' }
    ];
    if (this.stateService.hasPermission('staffs.view')) {
      options.push({ value: 'staffs', label: 'Nhân sự', icon: 'staffs' });
    }
    return options;
  });

  // Dữ liệu quản lý nhân viên
  public staffsList = signal<any[]>([]);
  public rolesList = signal<any[]>([]);
  
  // Dữ liệu đăng ký công ty mới
  public newCompany = {
    code: '',
    name: '',
    logo: '',
    valuation: 0,
    registry_address: '',
    governance_address: '',
    token_address: '',
    funding_address: '',
    marketplace_address: '',
    oracle_address: ''
  };

  public get greetingName(): string {
    const user = this.stateService.currentUser();
    if (!user) return 'Nhà đầu tư Web3';
    if (user.name && !user.name.startsWith('User_') && user.name.trim() !== '') {
      return user.name;
    }
    return user.wallet_address || this.stateService.address() || 'Nhà đầu tư Web3';
  }

  public hasRealName(): boolean {
    const user = this.stateService.currentUser();
    if (!user || !user.name) return false;
    return !user.name.startsWith('User_') && user.name.trim() !== '';
  }

  constructor() {}

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

  public getRoleDisplayName(roleName: string): string {
    const map: Record<string, string> = {
      'Chủ quán': 'Chủ HĐQT',
      'Owner': 'Chủ HĐQT',
      'Quản lý': 'Thành viên HĐQT',
      'Manager': 'Thành viên HĐQT',
      'Board Member': 'Thành viên HĐQT',
      'Thu ngân': 'Nhân viên',
      'Cashier': 'Nhân viên',
      'Kế toán': 'Kế toán',
      'Accountant': 'Kế toán'
    };
    return map[roleName] || roleName;
  }


  // Mở modal Đăng ký doanh nghiệp mới
  public openRegisterCompany() {
    const ref = this.modalService.open(RegisterCompanyModalComponent, {
      title: 'Đăng ký doanh nghiệp mới',
      size: 'lg'
    });
    ref.afterClosed$.subscribe(success => {
      if (success) {
        this.stateService.loadCompanies();
      }
    });
  }

  // Mở modal Thêm nhân viên
  public openAddStaff() {
    const ref = this.modalService.open(AddStaffModalComponent, {
      title: 'Thêm thành viên nội bộ',
      size: 'md',
      data: { roles: this.rolesList() }
    });
    ref.afterClosed$.subscribe(success => {
      if (success) {
        this.loadStaffsData();
      }
    });
  }

  // Vô hiệu hóa nhân viên
  public handleDeactivateStaff(staffId: number) {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    const confirmRef = this.modalService.confirm({
      title: 'Ngừng kích hoạt nhân sự',
      description: 'Bạn có chắc chắn muốn ngừng kích hoạt nhân sự này không?',
      confirmText: 'NGỪNG KÍCH HOẠT',
      cancelText: 'HỦY BỎ',
      confirmButtonClass: 'btn-danger'
    });

    confirmRef.afterClosed$.subscribe(async (confirmed) => {
      if (confirmed) {
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
    });
  }

  // Đăng ký công ty từ card chính
  public async handleRegisterCompany() {
    if (!this.newCompany.code || !this.newCompany.name) {
      this.stateService.showToast('Vui lòng điền đầy đủ tên và mã công ty', 'warning');
      return;
    }

    try {
      this.stateService.isLoading.set(true);
      await firstValueFrom(this.apiService.post<any>('companies/register', this.newCompany));
      this.stateService.showToast('Đăng ký doanh nghiệp thành công!', 'success');
      await this.stateService.loadCompanies();
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Có lỗi xảy ra!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }
}
