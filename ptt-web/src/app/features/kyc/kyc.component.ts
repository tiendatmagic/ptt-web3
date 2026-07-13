import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { TabGroupComponent } from '@shared/components/tab-group/tab-group.component';
import { CustomSelectComponent } from '@shared/components/custom-select/custom-select.component';
import { firstValueFrom } from 'rxjs';
import { Contract, ethers } from 'ethers';

@Component({
  selector: 'app-kyc',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonComponent, TabGroupComponent, CustomSelectComponent],
  templateUrl: './kyc.component.html'
})
export class KycComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  public kycList = signal<any[]>([]);
  public activeFilter = signal<string>('PENDING');
  public filterOptions = [
    { value: 'PENDING', label: 'Chờ duyệt' },
    { value: 'APPROVED', label: 'Đã duyệt' },
    { value: 'REJECTED', label: 'Từ chối' },
    { value: 'BATCH_MANAGE', label: 'Duyệt hàng loạt' }
  ];
  public selectedUser = signal<any | null>(null);
  public rejectionReason = '';

  // Whitelist/Blacklist hàng loạt
  public batchAddressesInput = signal<string>('');
  public batchAction = signal<string>('whitelist');
  public isBatchExecuting = signal<boolean>(false);
  public batchActionOptions = [
    { value: 'whitelist', label: 'Thêm vào Whitelist (Duyệt KYC)' },
    { value: 'remove_whitelist', label: 'Xóa khỏi Whitelist' },
    { value: 'blacklist', label: 'Thêm vào Blacklist' },
    { value: 'remove_blacklist', label: 'Xóa khỏi Blacklist' }
  ];

  constructor() {
    effect(() => {
      const comp = this.stateService.currentCompany();
      if (comp) {
        this.loadKycList();
      } else {
        this.kycList.set([]);
        this.selectedUser.set(null);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
  }

  public async loadKycList() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    if (this.activeFilter() === 'BATCH_MANAGE') {
      return; // Không tải danh sách nếu đang ở tab quản lý hàng loạt
    }

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
    this.selectedUser.set(null);
    this.loadKycList();
  }

  public async handleApproveKyc(userId: number) {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      this.stateService.isLoading.set(true);
      await firstValueFrom(this.apiService.post<any>(`users/kyc/${userId}/approve`, {}, comp.id));
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
      await firstValueFrom(this.apiService.post<any>(`users/kyc/${userId}/reject`, {
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

  // Thực thi Whitelist/Blacklist hàng loạt
  public async handleBatchAction() {
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.token_address) {
      this.stateService.showToast('Không tìm thấy thông tin Smart Contract Cổ phần (EquityToken) để whitelist!', 'error');
      return;
    }

    const rawInput = this.batchAddressesInput();
    if (!rawInput.trim()) {
      this.stateService.showToast('Vui lòng nhập danh sách địa chỉ ví', 'warning');
      return;
    }

    // Tách các ví theo xuống dòng, dấu phẩy, khoảng trắng
    const splitAddresses = rawInput.split(/[\n,\s]+/).map(a => a.trim()).filter(a => a.length > 0);
    if (splitAddresses.length === 0) {
      this.stateService.showToast('Không tìm thấy địa chỉ ví nào trong danh sách', 'warning');
      return;
    }

    // Kiểm tra định dạng ví
    const invalidAddresses = splitAddresses.filter(a => !ethers.isAddress(a));
    if (invalidAddresses.length > 0) {
      this.stateService.showToast(`Phát hiện địa chỉ ví không hợp lệ: ${invalidAddresses[0]}`, 'error');
      return;
    }

    // Loại bỏ trùng lặp và chuẩn hóa
    const uniqueAddresses = Array.from(new Set(splitAddresses.map(a => ethers.getAddress(a))));

    try {
      this.isBatchExecuting.set(true);
      this.stateService.isLoading.set(true);
      this.stateService.showToast('Đang kết nối ví và gửi giao dịch cập nhật hàng loạt lên Blockchain...', 'warning');

      // 1. Lấy signer và khởi tạo contract
      const signer = await this.stateService.getSigner();
      const equityTokenAbi = [
        "function setWhitelistedBatch(address[] calldata accounts, bool status) external",
        "function setBlacklistedBatch(address[] calldata accounts, bool status) external"
      ];
      const tokenContract = new Contract(comp.token_address, equityTokenAbi, signer);
      const gasOverrides = await this.stateService.getGasOverrides(signer);

      const actionType = this.batchAction();
      let tx: any;

      if (actionType === 'whitelist') {
        tx = await tokenContract['setWhitelistedBatch'](uniqueAddresses, true, gasOverrides);
      } else if (actionType === 'remove_whitelist') {
        tx = await tokenContract['setWhitelistedBatch'](uniqueAddresses, false, gasOverrides);
      } else if (actionType === 'blacklist') {
        tx = await tokenContract['setBlacklistedBatch'](uniqueAddresses, true, gasOverrides);
      } else if (actionType === 'remove_blacklist') {
        tx = await tokenContract['setBlacklistedBatch'](uniqueAddresses, false, gasOverrides);
      }

      this.stateService.showToast('Giao dịch batch đang chờ xác nhận từ mạng lưới...', 'warning');
      await tx.wait();

      this.stateService.showToast('Giao dịch Blockchain thành công! Đang đồng bộ về Database...', 'warning');

      // 2. Đồng bộ backend
      await firstValueFrom(
        this.apiService.post<any>('users/kyc/batch-sync', {
          addresses: uniqueAddresses,
          action: actionType
        }, comp.id)
      );

      this.stateService.showToast(`Đã cập nhật và đồng bộ hàng loạt thành công cho ${uniqueAddresses.length} địa chỉ ví!`, 'success');
      this.batchAddressesInput.set('');
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || 'Lỗi xử lý giao dịch hoặc đồng bộ database!', 'error');
    } finally {
      this.isBatchExecuting.set(false);
      this.stateService.isLoading.set(false);
    }
  }
}
