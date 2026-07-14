import { Component, OnInit, inject, signal, effect, computed } from '@angular/core';
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
import { EquityToken } from '../../core/constants/contracts';

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
    { value: 'BATCH_MANAGE', label: 'Duyệt hàng loạt' },
    { value: 'ONCHAIN_LISTS', label: 'Danh sách On-chain' }
  ];
  public selectedUser = signal<any | null>(null);
  public rejectionReason = '';

  // Danh sách on-chain whitelist & blacklist
  public onchainWhitelist = signal<string[]>([]);
  public onchainBlacklist = signal<string[]>([]);
  public whitelistTotal = signal<number>(0);
  public blacklistTotal = signal<number>(0);
  public whitelistPage = signal<number>(1);
  public blacklistPage = signal<number>(1);
  public readonly pageSize = 10;

  public totalWhitelistPages = computed(() => Math.ceil(this.whitelistTotal() / this.pageSize));
  public totalBlacklistPages = computed(() => Math.ceil(this.blacklistTotal() / this.pageSize));

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
        this.loadOnchainLists();
      } else {
        this.kycList.set([]);
        this.selectedUser.set(null);
        this.onchainWhitelist.set([]);
        this.onchainBlacklist.set([]);
        this.whitelistTotal.set(0);
        this.blacklistTotal.set(0);
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

  public async loadOnchainLists() {
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.token_address || comp.token_address === '—') return;

    try {
      const provider = new ethers.JsonRpcProvider('https://bsc-testnet-rpc.publicnode.com');
      const tokenContract = new Contract(comp.token_address, EquityToken.abi, provider);

      // 1. Load Whitelist Page
      const wlOffset = (this.whitelistPage() - 1) * this.pageSize;
      const [wlResult, wlTotal] = await tokenContract['getWhitelistedAddresses'](wlOffset, this.pageSize);
      this.onchainWhitelist.set(wlResult || []);
      this.whitelistTotal.set(Number(wlTotal));

      // 2. Load Blacklist Page
      const blOffset = (this.blacklistPage() - 1) * this.pageSize;
      const [blResult, blTotal] = await tokenContract['getBlacklistedAddresses'](blOffset, this.pageSize);
      this.onchainBlacklist.set(blResult || []);
      this.blacklistTotal.set(Number(blTotal));
    } catch (e) {
      console.error('Lỗi load danh sách onchain whitelist/blacklist:', e);
    }
  }

  public onWlPageChange(page: number) {
    this.whitelistPage.set(page);
    this.loadOnchainLists();
  }

  public onBlPageChange(page: number) {
    this.blacklistPage.set(page);
    this.loadOnchainLists();
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

      // Bước 1: Cập nhật trạng thái KYC trên DB backend
      const res = await firstValueFrom(this.apiService.post<any>(`users/kyc/${userId}/approve`, {}, comp.id));
      const walletAddress: string = res?.user?.wallet_address;

      // Bước 2: Tự động Whitelist on-chain nếu contract đã deploy và ví tồn tại
      if (comp.token_address && walletAddress && ethers.isAddress(walletAddress)) {
        this.stateService.showToast('Đang gửi giao dịch Whitelist on-chain qua MetaMask...', 'warning');
        try {
          const signer = await this.stateService.getSigner();
          const tokenContract = new Contract(comp.token_address, [
            'function setWhitelisted(address account, bool status) external'
          ], signer);
          const gasOverrides = await this.stateService.getGasOverrides(signer);
          const tx = await tokenContract['setWhitelisted'](walletAddress, true, gasOverrides);
          await tx.wait();
          this.stateService.showToast('Duyệt KYC & Whitelist on-chain thành công!', 'success');
        } catch (onChainErr: any) {
          // Không rollback DB nếu on-chain lỗi, chỉ cảnh báo
          const rejected = onChainErr?.message?.includes('user rejected') || onChainErr?.message?.includes('rejected action');
          if (rejected) {
            this.stateService.showToast('KYC đã duyệt trên DB. Giao dịch Whitelist bị từ chối trên MetaMask — vui lòng Whitelist thủ công.', 'warning');
          } else {
            this.stateService.showToast('KYC đã duyệt trên DB nhưng Whitelist on-chain thất bại. Vui lòng Whitelist thủ công qua tab "Duyệt hàng loạt".', 'warning');
          }
        }
      } else {
        // Contract chưa deploy hoặc ví trống → chỉ cập nhật DB
        this.stateService.showToast('Duyệt KYC thành công! (Smart Contract chưa deploy hoặc ví trống — Whitelist on-chain cần thực hiện thủ công).', 'success');
      }

      this.selectedUser.set(null);
      await this.loadKycList();
      await this.loadOnchainLists();
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

      // Bước 1: Cập nhật trạng thái KYC trên DB backend
      const res = await firstValueFrom(this.apiService.post<any>(`users/kyc/${userId}/reject`, {
        reason: this.rejectionReason
      }, comp.id));
      const walletAddress: string = res?.user?.wallet_address;

      // Bước 2: Tự động Remove Whitelist on-chain nếu contract đã deploy và ví tồn tại
      if (comp.token_address && walletAddress && ethers.isAddress(walletAddress)) {
        try {
          const signer = await this.stateService.getSigner();
          const tokenContract = new Contract(comp.token_address, [
            'function setWhitelisted(address account, bool status) external'
          ], signer);
          const gasOverrides = await this.stateService.getGasOverrides(signer);
          const tx = await tokenContract['setWhitelisted'](walletAddress, false, gasOverrides);
          await tx.wait();
          this.stateService.showToast('Từ chối KYC & Xóa Whitelist on-chain thành công!', 'success');
        } catch (onChainErr: any) {
          // Không rollback DB nếu on-chain lỗi
          this.stateService.showToast('KYC đã từ chối trên DB. Xóa Whitelist on-chain thất bại — vui lòng xóa thủ công nếu cần.', 'warning');
        }
      } else {
        this.stateService.showToast('Đã từ chối KYC!', 'success');
      }

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

      // On-chain đã thành công — đây là nguồn sự thật (source of truth)
      // Tiếp tục đồng bộ DB nhưng không để lỗi DB ảnh hưởng kết quả chính
      this.stateService.showToast('Giao dịch Blockchain thành công! Đang đồng bộ về Database...', 'warning');

      // 2. Đồng bộ backend (non-critical: DB chỉ là cache, on-chain mới là thật)
      try {
        await firstValueFrom(
          this.apiService.post<any>('users/kyc/batch-sync', {
            addresses: uniqueAddresses,
            action: actionType
          }, comp.id)
        );
        this.stateService.showToast(`Đã cập nhật và đồng bộ hàng loạt thành công cho ${uniqueAddresses.length} địa chỉ ví!`, 'success');
      } catch (dbErr: any) {
        // On-chain đã confirm → người dùng KHÔNG cần làm lại, chỉ cần thông báo DB lệch
        console.warn('DB sync thất bại sau khi on-chain thành công:', dbErr);
        this.stateService.showToast(
          `On-chain thành công cho ${uniqueAddresses.length} ví! DB đồng bộ thất bại (không ảnh hưởng giao dịch). Danh sách sẽ cập nhật từ blockchain.`,
          'warning'
        );
      }

      this.batchAddressesInput.set('');
      await this.loadOnchainLists(); // Luôn reload từ on-chain để UI hiển thị đúng
    } catch (e: any) {
      // Lỗi ở đây = on-chain thất bại (MetaMask từ chối hoặc contract revert)
      console.error(e);
      const rejected = e?.message?.includes('user rejected') || e?.message?.includes('rejected action');
      if (rejected) {
        this.stateService.showToast('Giao dịch bị từ chối trên MetaMask. Không có thay đổi nào được thực hiện.', 'warning');
      } else {
        this.stateService.showToast(e.message || 'Lỗi giao dịch on-chain! Không có thay đổi nào được thực hiện.', 'error');
      }
    } finally {
      this.isBatchExecuting.set(false);
      this.stateService.isLoading.set(false);
    }
  }
}
