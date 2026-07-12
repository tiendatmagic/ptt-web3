import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { firstValueFrom } from 'rxjs';
import { Contract, parseEther } from 'ethers';

import { ModalService } from '@core/services/modal.service';
import { CreateRoundModalComponent } from './modals/create-round-modal.component';

// ABI rút gọn của FundingManager để purchaseShares
const FUNDING_MANAGER_ABI = [
  "function purchaseShares() external payable",
  "function getRaisedAmount() public view returns (uint256)",
  "function isActive() public view returns (bool)"
];

// ABI rút gọn của DistributionManager để claimDividend
const DISTRIBUTION_MANAGER_ABI = [
  "function claimDividend(uint256 companyId, uint256 dividendId) external",
  "function getClaimableAmount(uint256 companyId, uint256 dividendId, address shareholder) public view returns (uint256)"
];

@Component({
  selector: 'app-funding',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonComponent],
  templateUrl: './funding.component.html'
})
export class FundingComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);
  private modalService = inject(ModalService);

  // Gọi vốn
  public roundsList = signal<any[]>([]);
  public purchaseAmount = '';

  // Cổ tức
  public dividendsList = signal<any[]>([]);

  ngOnInit() {
    this.loadFundingData();
  }

  public async loadFundingData() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      // 1. Tải danh sách gọi vốn
      const rounds = await firstValueFrom(this.apiService.get<any[]>('funding', comp.id));
      this.roundsList.set(rounds || []);

      // 2. Tải danh sách cổ tức
      const divs = await firstValueFrom(this.apiService.get<any[]>('dividends', comp.id));
      this.dividendsList.set(divs || []);
    } catch (e) {
      console.error('Lỗi khi tải dữ liệu gọi vốn/cổ tức:', e);
    }
  }

  // Mua cổ phần gọi vốn (Purchase Shares)
  public async handlePurchaseShares(round: any) {
    if (!this.purchaseAmount) {
      this.stateService.showToast('Vui lòng nhập số tiền muốn mua', 'warning');
      return;
    }

    const comp = this.stateService.currentCompany();
    if (!comp || !comp.funding_address) return;

    // Check KYC status
    if (this.stateService.currentUser()?.kyc_status !== 'APPROVED') {
      this.stateService.showToast('Tài khoản của bạn chưa vượt qua KYC của hệ thống!', 'error');
      return;
    }

    try {
      this.stateService.isLoading.set(true);
      this.stateService.showToast('Đang gửi giao dịch mua cổ phần lên blockchain...', 'warning');

      // 1. Lấy signer và khởi tạo contract FundingManager
      const signer = await this.stateService.getSigner();
      const fundingContract = new Contract(comp.funding_address, FUNDING_MANAGER_ABI, signer);

      const valueToSend = parseEther(this.purchaseAmount); // thanh toán bằng BNB
      const gasOverrides = await this.stateService.getGasOverrides(signer);

      // 2. Gọi hàm purchaseShares on-chain
      const tx = await fundingContract['purchaseShares']({
        value: valueToSend,
        ...gasOverrides
      });

      this.stateService.showToast('Giao dịch đang chờ xác nhận...', 'warning');
      await tx.wait();

      // 3. Đồng bộ lại raised amount từ contract
      const raisedWei = await fundingContract['getRaisedAmount']();
      const raisedEth = Number(raisedWei) / 1e18; // convert back to standard decimal

      // 4. Cập nhật Backend
      await firstValueFrom(
        this.apiService.post<any>(`funding/${round.id}/sync`, {
          raised_amount: raisedEth,
          status: 'ACTIVE'
        }, comp.id)
      );

      this.stateService.showToast('Mua cổ phần thành công! Cổ phần đã được tự động mint về ví của bạn.', 'success');
      this.purchaseAmount = '';
      await this.loadFundingData();
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || 'Lỗi giao dịch hoặc từ chối thanh toán!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Đăng ký vòng gọi vốn mới qua ModalService
  public openCreateRoundModal() {
    const ref = this.modalService.open(CreateRoundModalComponent, {
      title: 'Tạo vòng gọi vốn mới',
      size: 'md'
    });
    ref.afterClosed$.subscribe(success => {
      if (success) {
        this.loadFundingData();
      }
    });
  }

  // Rút cổ tức (Claim Dividend)
  public async handleClaimDividend(dividend: any) {
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.funding_address) return;

    try {
      this.stateService.isLoading.set(true);
      this.stateService.showToast('Đang gửi yêu cầu claim cổ tức lên blockchain...', 'warning');

      // 1. Lấy signer và khởi tạo contract DistributionManager (nằm trong FinanceManager)
      const signer = await this.stateService.getSigner();
      const distContract = new Contract(comp.funding_address, DISTRIBUTION_MANAGER_ABI, signer);

      const gasOverrides = await this.stateService.getGasOverrides(signer);

      // 2. Gọi hàm claimDividend on-chain
      const tx = await distContract['claimDividend'](comp.id, dividend.id, gasOverrides);

      this.stateService.showToast('Giao dịch claim đang chờ xác nhận...', 'warning');
      await tx.wait();

      this.stateService.showToast('Nhận cổ tức thành công! BNB/Stablecoin đã được chuyển trực tiếp vào ví của bạn.', 'success');
      await this.loadFundingData();
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || 'Lỗi claim hoặc bạn không có quyền nhận cổ tức (không có số dư tại block snapshot)!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }
}
