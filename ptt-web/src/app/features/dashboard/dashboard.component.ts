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
import { DepositModalComponent } from './modals/deposit-modal.component';
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
      options.push({ value: 'staffs', label: 'Thành viên', icon: 'staffs' });
    }
    return options;
  });

  // Dữ liệu quản lý nhân viên
  public staffsList = signal<any[]>([]);
  public rolesList = signal<any[]>([]);

  // Dữ liệu số dư quỹ HĐQT và quỹ Finance
  public treasuryBnbBalance = signal<string>('0');
  public treasuryErc20Balances = signal<any[]>([]);
  public financeBnbBalance = signal<string>('0');
  public financeErc20Balances = signal<any[]>([]);
  
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

  constructor() {
    effect(() => {
      const comp = this.stateService.currentCompany();
      if (comp) {
        this.loadStaffsData();
        this.loadTreasuryBalances();
      } else {
        this.staffsList.set([]);
        this.treasuryBnbBalance.set('0');
        this.treasuryErc20Balances.set([]);
        this.financeBnbBalance.set('0');
        this.financeErc20Balances.set([]);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
  }

  public async loadStaffsData() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      if (this.stateService.hasPermission('staffs.view')) {

        // Nếu đã deploy governance_address → lấy thành viên từ on-chain là nguồn chân lý duy nhất
        if (comp.governance_address && comp.governance_address !== ethers.ZeroAddress) {
          try {
            const provider = this.stateService.getProvider();
            if (provider) {
              const govContract = new ethers.Contract(
                comp.governance_address,
                ['function getMembers() view returns (address[])'],
                provider
              );
              const members: string[] = await govContract['getMembers']();

              // Tải dữ liệu DB để làm giàu thông tin (tên, vai trò)
              let dbMap = new Map<string, any>();
              try {
                const staffs = await firstValueFrom(this.apiService.get<any[]>('staffs', comp.id));
                if (staffs) {
                  for (const s of staffs) {
                    const addr = s.wallet_address?.toLowerCase();
                    if (!addr) continue;
                    if (dbMap.has(addr)) {
                      const existing = dbMap.get(addr);
                      if (s.role_name && !existing.roles.includes(s.role_name)) {
                        existing.roles.push(s.role_name);
                      }
                    } else {
                      dbMap.set(addr, { ...s, roles: s.role_name ? [s.role_name] : [] });
                    }
                  }
                }
              } catch (_) {}

              // Chỉ hiển thị đúng danh sách hiện tại trên Smart Contract
              const merged = members.map((addr, idx) => {
                const key = addr.toLowerCase();
                const db = dbMap.get(key);
                const roles = db?.roles || [];
                roles.sort((a: string, b: string) => {
                  const getPriority = (r: string) => {
                    if (['Owner', 'Chủ quán'].includes(r)) return 3;
                    if (['Board Member', 'Quản lý', 'Manager'].includes(r)) return 2;
                    return 1;
                  };
                  return getPriority(b) - getPriority(a);
                });
                return {
                  id: idx + 1,
                  user_id: db?.user_id || null,
                  name: db?.name || '',
                  wallet_address: addr,
                  role_name: roles.length > 0 ? roles.join(', ') : 'Board Member',
                  status: 'ACTIVE', // Đang trên on-chain → chắc chắn đang hoạt động
                  is_onchain: true
                };
              });

              this.staffsList.set(merged);
              return;
            }
          } catch (contractErr) {
            console.warn('Lỗi khi đọc thành viên từ contract, dùng fallback DB:', contractErr);
          }
        }

        // Fallback: chưa deploy hoặc lỗi → lấy từ DB, chỉ hiển thị ACTIVE
        const staffs = await firstValueFrom(this.apiService.get<any[]>('staffs', comp.id));
        const roles = await firstValueFrom(this.apiService.get<any[]>('roles', comp.id));
        this.rolesList.set(roles || []);

        const uniqueStaffsMap = new Map<string, any>();
        if (staffs) {
          for (const s of staffs) {
            const addr = s.wallet_address?.toLowerCase();
            if (!addr || s.status !== 'ACTIVE') continue;
            if (uniqueStaffsMap.has(addr)) {
              const existing = uniqueStaffsMap.get(addr);
              if (s.role_name && !existing.roles.includes(s.role_name)) {
                existing.roles.push(s.role_name);
              }
            } else {
              uniqueStaffsMap.set(addr, { ...s, roles: s.role_name ? [s.role_name] : [] });
            }
          }
        }
        const deduplicatedStaffs = Array.from(uniqueStaffsMap.values()).map(s => ({
          ...s,
          role_name: s.roles.join(', ')
        }));
        this.staffsList.set(deduplicatedStaffs);
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
    if (!roleName) return '';
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
    return roleName.split(', ')
      .map(r => map[r.trim()] || r.trim())
      .filter((value, index, self) => self.indexOf(value) === index)
      .join(', ');
  }

  public getStaffDisplayName(staff: any): string {
    if (!staff || !staff.name) return '';
    const name = staff.name.trim();
    if (
      name.startsWith('Staff_') ||
      name.startsWith('User_') ||
      name.startsWith('User-') ||
      name === 'Test User' ||
      name === ''
    ) {
      return '';
    }
    return name;
  }

  public isBoardRole(roleName: string): boolean {
    if (!roleName) return false;
    const boardRoles = ['Owner', 'Chủ quán', 'Board Member', 'Quản lý', 'Manager'];
    return roleName.split(', ').some(r => boardRoles.includes(r.trim()));
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
    if (this.stateService.isLoading()) return;

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
    if (this.stateService.isLoading()) return;

    if (!this.newCompany.code || !this.newCompany.name) {
      this.stateService.showToast('Vui lòng điền đầy đủ tên và mã công ty', 'warning');
      return;
    }

    try {
      this.stateService.isLoading.set(true);
      await firstValueFrom(this.apiService.post<any>('companies/register', this.newCompany));
      this.stateService.showToast('Đã đăng ký doanh nghiệp thành công!', 'success');
      await this.stateService.loadCompanies();
    } catch (e: any) {
      this.stateService.showToast(e.error?.message || 'Có lỗi xảy ra!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Mở modal Nạp Quỹ
  public openDepositModal() {
    this.modalService.open(DepositModalComponent, {
      title: 'Nạp quỹ',
      size: 'md'
    });
  }

  public async loadTreasuryBalances() {
    const comp = this.stateService.currentCompany();
    if (!comp) {
      this.treasuryBnbBalance.set('0');
      this.treasuryErc20Balances.set([]);
      this.financeBnbBalance.set('0');
      this.financeErc20Balances.set([]);
      return;
    }

    const provider = this.stateService.getProvider();
    if (!provider) return;

    const savedTokens = comp.saved_tokens || [];
    const minErc20Abi = [
      'function balanceOf(address) view returns (uint256)'
    ];

    // 1. Tải số dư Quỹ HĐQT (Treasury)
    if (comp.governance_address && comp.governance_address !== ethers.ZeroAddress) {
      try {
        const bnbBal = await provider.getBalance(comp.governance_address);
        this.treasuryBnbBalance.set(parseFloat(ethers.formatEther(bnbBal)).toFixed(4));

        const erc20Balances = [];
        for (const token of savedTokens) {
          if (token.address && ethers.isAddress(token.address)) {
            try {
              const tokenContract = new ethers.Contract(token.address, minErc20Abi, provider);
              const balance = await tokenContract['balanceOf'](comp.governance_address);
              const formatted = parseFloat(ethers.formatUnits(balance, token.decimals)).toFixed(2);
              if (Number(formatted) > 0 || savedTokens.length === 1 || token.symbol === 'USDT') {
                erc20Balances.push({
                  symbol: token.symbol,
                  balance: formatted
                });
              }
            } catch (tokenErr) {
              console.warn('Lỗi khi tải số dư token của quỹ HĐQT:', token.symbol, tokenErr);
            }
          }
        }
        this.treasuryErc20Balances.set(erc20Balances);
      } catch (err) {
        console.warn('Không thể tải số dư quỹ HĐQT:', err);
      }
    } else {
      this.treasuryBnbBalance.set('0');
      this.treasuryErc20Balances.set([]);
    }

    // 2. Tải số dư Quỹ Cổ tức (Finance Manager)
    if (comp.funding_address && comp.funding_address !== ethers.ZeroAddress) {
      try {
        const bnbBal = await provider.getBalance(comp.funding_address);
        this.financeBnbBalance.set(parseFloat(ethers.formatEther(bnbBal)).toFixed(4));

        const erc20Balances = [];
        for (const token of savedTokens) {
          if (token.address && ethers.isAddress(token.address)) {
            try {
              const tokenContract = new ethers.Contract(token.address, minErc20Abi, provider);
              const balance = await tokenContract['balanceOf'](comp.funding_address);
              const formatted = parseFloat(ethers.formatUnits(balance, token.decimals)).toFixed(2);
              if (Number(formatted) > 0 || savedTokens.length === 1 || token.symbol === 'USDT') {
                erc20Balances.push({
                  symbol: token.symbol,
                  balance: formatted
                });
              }
            } catch (tokenErr) {
              console.warn('Lỗi khi tải số dư token của quỹ Finance:', token.symbol, tokenErr);
            }
          }
        }
        this.financeErc20Balances.set(erc20Balances);
      } catch (err) {
        console.warn('Không thể tải số dư quỹ Finance:', err);
      }
    } else {
      this.financeBnbBalance.set('0');
      this.financeErc20Balances.set([]);
    }
  }
}
