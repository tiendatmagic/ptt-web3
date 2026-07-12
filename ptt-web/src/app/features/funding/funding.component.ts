import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { firstValueFrom } from 'rxjs';
import { Contract, parseEther, ethers } from 'ethers';

import { ModalService } from '@core/services/modal.service';

// ABI rút gọn của FinanceManager để quản lý Gọi vốn & Cổ tức
const FINANCE_MANAGER_ABI = [
  "function buyShares(uint256 roundId, uint256 tokenAmount) external payable",
  "function rounds(uint256 roundId) external view returns (tuple(uint256 id, string name, address shareToken, address paymentToken, address treasury, uint256 price, uint256 maxSupply, uint256 soldAmount, uint256 startTime, uint256 endTime, uint256 minPurchase, uint256 maxPurchase, bool isWhitelistOnly, bool active))",
  "function claimDividend(uint256 dividendId) external"
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
  private router = inject(Router);

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
    if (!this.purchaseAmount || Number(this.purchaseAmount) <= 0) {
      this.stateService.showToast('Vui lòng nhập số lượng cổ phần muốn mua', 'warning');
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
      this.stateService.showToast('Đang kết nối ví và kiểm tra thông tin vòng gọi vốn...', 'warning');

      // 1. Lấy signer và khởi tạo contract FinanceManager
      const signer = await this.stateService.getSigner();
      const financeContract = new Contract(comp.funding_address, FINANCE_MANAGER_ABI, signer);

      // 2. Đọc thông tin round từ contract để lấy giá price chính xác
      const roundInfo = await financeContract['rounds'](round.id);
      const price = roundInfo.price; // Giá cổ phần bằng Wei (ví dụ: 0.001 BNB)

      const tokenAmount = parseEther(this.purchaseAmount); // Số lượng cổ phần quy đổi sang Wei (18 decimals)
      const cost = (tokenAmount * BigInt(price)) / 1000000000000000000n;   // Chi phí BNB = (amount * price) / 10^18

      this.stateService.showToast(`Chi phí cần thanh toán: ${ethers.formatEther(cost)} BNB. Đang gửi giao dịch...`, 'warning');
      const gasOverrides = await this.stateService.getGasOverrides(signer);

      // 3. Gọi hàm buyShares on-chain
      const tx = await financeContract['buyShares'](round.id, tokenAmount, {
        value: cost,
        ...gasOverrides
      });

      this.stateService.showToast('Giao dịch đang chờ xác nhận từ mạng lưới...', 'warning');
      await tx.wait();

      // 4. Tính toán số tiền đã huy động được (raised_amount) để đồng bộ về Backend
      // Lấy soldAmount thực tế sau giao dịch
      const updatedRoundInfo = await financeContract['rounds'](round.id);
      const soldAmount = updatedRoundInfo.soldAmount;
      const raisedWei = (BigInt(soldAmount) * BigInt(price)) / 1000000000000000000n;
      const raisedEth = Number(ethers.formatEther(raisedWei));

      // 5. Cập nhật Backend
      await firstValueFrom(
        this.apiService.post<any>(`funding/${round.id}/sync`, {
          raised_amount: raisedEth,
          status: 'ACTIVE'
        }, comp.id)
      );

      this.stateService.showToast('Mua cổ phần thành công! Cổ phần đã được phân phối trực tiếp về ví của bạn.', 'success');
      this.purchaseAmount = '';
      await this.loadFundingData();
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || 'Lỗi giao dịch hoặc từ chối thanh toán!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Tạo đề xuất gọi vốn mới chuyển sang Governance
  public openCreateRoundModal() {
    this.stateService.showToast('Vui lòng tạo đề xuất FUNDING_ROUND tại trang Hội đồng Quản trị để mở vòng gọi vốn mới.', 'warning');
    this.router.navigate(['/governance']);
  }

  // Rút cổ tức (Claim Dividend)
  public async handleClaimDividend(dividend: any) {
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.funding_address) return;

    try {
      this.stateService.isLoading.set(true);
      this.stateService.showToast('Đang gửi yêu cầu claim cổ tức lên blockchain...', 'warning');

      // 1. Lấy signer và khởi tạo contract FinanceManager
      const signer = await this.stateService.getSigner();
      const financeContract = new Contract(comp.funding_address, FINANCE_MANAGER_ABI, signer);

      const gasOverrides = await this.stateService.getGasOverrides(signer);

      // 2. Gọi hàm claimDividend on-chain
      const tx = await financeContract['claimDividend'](dividend.id, gasOverrides);

      this.stateService.showToast('Giao dịch claim đang chờ xác nhận từ mạng lưới...', 'warning');
      await tx.wait();

      this.stateService.showToast('Nhận cổ tức thành công! BNB đã được chuyển trực tiếp vào ví của bạn.', 'success');
      await this.loadFundingData();
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || 'Lỗi claim hoặc bạn không có quyền nhận cổ tức (không có số dư tại block snapshot)!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }
}
