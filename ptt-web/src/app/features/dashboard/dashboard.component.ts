import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { LogoComponent } from '@shared/components/logo/logo.component';
import { firstValueFrom } from 'rxjs';
import { ethers } from 'ethers';

import { ModalService } from '@core/services/modal.service';
import { AddStaffModalComponent } from './modals/add-staff-modal.component';
import { RegisterCompanyModalComponent } from './modals/register-company-modal.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonComponent, LogoComponent],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);
  private modalService = inject(ModalService);

  // Tab active
  public activeTab = signal<'overview' | 'staffs' | 'settings'>('overview');

  // Dữ liệu quản lý nhân viên
  public staffsList = signal<any[]>([]);
  public rolesList = signal<any[]>([]);
  
  // Dữ liệu đăng ký công ty mới
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

  // ── Settings: Deploy & Verify ──────────────────────────────────
  // BSC API Key lưu client-side (localStorage), không gửi lên server
  public bscApiKey = signal<string>('');
  public deployLoading = signal<Record<string, boolean>>({});
  public verifyLoading = signal<Record<string, boolean>>({});
  public verifyStatus = signal<Record<string, string>>({});

  // Danh sách owner cho contracts (có thể thêm/xóa)
  public contractOwners = signal<string[]>([]);
  public newOwnerAddr = '';

  // Load BSC API key từ localStorage khi init
  public loadBscApiKey() {
    const saved = localStorage.getItem('ptt_bscscan_api_key');
    if (saved) this.bscApiKey.set(saved);
  }

  public saveBscApiKey(key: string) {
    localStorage.setItem('ptt_bscscan_api_key', key);
    this.bscApiKey.set(key);
    this.stateService.showToast('API Key đã được lưu (chỉ trên trình duyệt này).', 'success');
  }

  public clearBscApiKey() {
    localStorage.removeItem('ptt_bscscan_api_key');
    this.bscApiKey.set('');
    this.stateService.showToast('Đã xóa API Key.', 'success');
  }

  public addOwner() {
    if (!this.newOwnerAddr || !ethers.isAddress(this.newOwnerAddr)) {
      this.stateService.showToast('Địa chỉ ví không hợp lệ!', 'warning');
      return;
    }
    if (this.contractOwners().includes(this.newOwnerAddr)) {
      this.stateService.showToast('Địa chỉ này đã có trong danh sách!', 'warning');
      return;
    }
    this.contractOwners.update(list => [...list, this.newOwnerAddr]);
    this.newOwnerAddr = '';
  }

  public removeOwner(addr: string) {
    this.contractOwners.update(list => list.filter(a => a !== addr));
  }

  // Deploy contract gọi Backend API (backend dùng private key deployer)
  public async handleDeploy(contractKey: string) {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    this.deployLoading.update(s => ({ ...s, [contractKey]: true }));
    try {
      await firstValueFrom(
        this.apiService.post<any>(`companies/${comp.id}/contracts/deploy`, {
          contract_key: contractKey,
          owners: this.contractOwners()
        })
      );
      this.stateService.showToast(`Deploy ${contractKey} thành công!`, 'success');
      await this.stateService.loadCompanies();
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Deploy thất bại!', 'error');
    } finally {
      this.deployLoading.update(s => ({ ...s, [contractKey]: false }));
    }
  }

  // Verify contract trực tiếp qua BscScan API (từ browser, key không gửi server)
  public async handleVerify(contractKey: string, contractAddress: string, contractName: string) {
    const apiKey = this.bscApiKey();
    if (!apiKey) {
      this.stateService.showToast('Vui lòng nhập BscScan API Key trước!', 'warning');
      return;
    }
    if (!contractAddress || contractAddress === '—') {
      this.stateService.showToast('Contract chưa được deploy!', 'warning');
      return;
    }

    this.verifyLoading.update(s => ({ ...s, [contractKey]: true }));
    this.verifyStatus.update(s => ({ ...s, [contractKey]: 'checking' }));

    try {
      // Kiểm tra verification status trực tiếp từ BscScan Testnet API
      const url = `https://api-testnet.bscscan.com/api?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === '1' && data.result[0]?.SourceCode) {
        this.verifyStatus.update(s => ({ ...s, [contractKey]: 'verified' }));
        this.stateService.showToast(`${contractName} đã được verify trên BscScan!`, 'success');
      } else {
        // Chưa verify — gọi endpoint submit flatten source code
        const submitRes = await firstValueFrom(
          this.apiService.post<any>('contracts/verify', {
            contract_key: contractKey,
            contract_address: contractAddress,
            bscscan_api_key: apiKey   // backend chỉ dùng 1 lần, không lưu
          })
        );
        this.verifyStatus.update(s => ({ ...s, [contractKey]: 'submitted' }));
        this.stateService.showToast(`Đã submit verify cho ${contractName}. GUID: ${submitRes.guid}`, 'success');
      }
    } catch (e: any) {
      this.verifyStatus.update(s => ({ ...s, [contractKey]: 'error' }));
      this.stateService.showToast('Lỗi khi verify: ' + (e.message || 'Unknown'), 'error');
    } finally {
      this.verifyLoading.update(s => ({ ...s, [contractKey]: false }));
    }
  }

  // Thay đổi tab
  public setTab(tab: 'overview' | 'staffs' | 'settings') {
    this.activeTab.set(tab);
    if (tab === 'staffs') {
      this.loadStaffsData();
    }
    if (tab === 'settings') {
      this.loadBscApiKey();
      // Load owners từ company hiện tại
      const comp = this.stateService.currentCompany();
      if (comp?.wallet_address) {
        this.contractOwners.set([comp.wallet_address]);
      }
    }
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
