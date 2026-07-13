import { Component, OnInit, inject, signal, effect } from '@angular/core';
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
import { CreateRoundProposalModalComponent } from './modals/create-round-proposal-modal.component';

// ABI rút gọn của FinanceManager để quản lý Gọi vốn & Cổ tức
const FINANCE_MANAGER_ABI = [
  "function buyShares(uint256 roundId, uint256 tokenAmount) external payable",
  "function rounds(uint256 roundId) external view returns (tuple(uint256 id, string name, address shareToken, address paymentToken, address treasury, uint256 price, uint256 maxSupply, uint256 soldAmount, uint256 startTime, uint256 endTime, uint256 minPurchase, uint256 maxPurchase, bool isWhitelistOnly, bool active, bool finalized, bool cancelled))",
  "function claimDividend(uint256 dividendId) external",
  "function finalizeFundingRound(uint256 roundId) external",
  "function cancelFundingRound(uint256 roundId) external",
  "function claimRefund(uint256 roundId) external",
  "function investorPurchases(uint256 roundId, address investor) external view returns (uint256)",
  "function investorPayments(uint256 roundId, address investor) external view returns (uint256)"
];

// ABI rút gọn của ERC20 để xử lý phê duyệt (approve)
const ERC20_ABI = [
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
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

  // Loading state
  public isPageLoading = signal(true);

  constructor() {
    effect(() => {
      const comp = this.stateService.currentCompany();
      if (comp) {
        this.loadFundingData();
      } else {
        this.roundsList.set([]);
        this.dividendsList.set([]);
        this.isPageLoading.set(false);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
  }

  public async loadFundingData() {
    const comp = this.stateService.currentCompany();
    if (!comp) {
      this.isPageLoading.set(false);
      return;
    }

    this.isPageLoading.set(true);
    try {
      // 1. Tải danh sách gọi vốn
      const rounds = await firstValueFrom(this.apiService.get<any[]>('funding', comp.id));
      this.roundsList.set(rounds || []);

      // 2. Tải danh sách cổ tức
      const divs = await firstValueFrom(this.apiService.get<any[]>('dividends', comp.id));
      this.dividendsList.set(divs || []);
    } catch (e) {
      console.error('Lỗi khi tải dữ liệu gọi vốn/cổ tức:', e);
    } finally {
      this.isPageLoading.set(false);
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
      const userAddress = await signer.getAddress();
      const financeContract = new Contract(comp.funding_address, FINANCE_MANAGER_ABI, signer);

      // 2. Đọc thông tin round từ contract để lấy giá price chính xác
      const roundInfo = await financeContract['rounds'](round.id);
      const price = roundInfo.price;
      const paymentToken = roundInfo.paymentToken;

      const tokenAmount = parseEther(this.purchaseAmount); // Số lượng cổ phần quy đổi sang Wei (18 decimals)
      const cost = (tokenAmount * BigInt(price)) / 1000000000000000000n;

      const isERC20 = paymentToken !== ethers.ZeroAddress;
      const gasOverrides = await this.stateService.getGasOverrides(signer);

      if (isERC20) {
        // FLOW THANH TOÁN BẰNG TOKEN ERC20
        const tokenContract = new Contract(paymentToken, ERC20_ABI, signer);
        const [tokenSymbol, tokenDecimals] = await Promise.all([
          tokenContract['symbol'](),
          tokenContract['decimals']()
        ]);

        const formattedCost = ethers.formatUnits(cost, tokenDecimals);
        this.stateService.showToast(`Kiểm tra quyền sử dụng ${tokenSymbol}...`, 'warning');

        // Kiểm tra allowance hiện tại
        const allowance = await tokenContract['allowance'](userAddress, comp.funding_address);
        if (BigInt(allowance) < cost) {
          this.stateService.showToast(`Vui lòng xác nhận phê duyệt (Approve) chi tiêu ${formattedCost} ${tokenSymbol}...`, 'warning');
          const approveTx = await tokenContract['approve'](comp.funding_address, cost, gasOverrides);
          await approveTx.wait();
          this.stateService.showToast('Đã phê duyệt thành công! Tiến hành giao dịch mua cổ phần...', 'warning');
        }

        this.stateService.showToast(`Đang gửi giao dịch mua cổ phần (${formattedCost} ${tokenSymbol})...`, 'warning');
        // Đối với ERC20, không gửi BNB kèm theo (value = 0)
        const tx = await financeContract['buyShares'](round.id, tokenAmount, {
          value: 0,
          ...gasOverrides
        });
        this.stateService.showToast('Giao dịch đang chờ xác nhận từ mạng lưới...', 'warning');
        await tx.wait();
      } else {
        // FLOW THANH TOÁN BẰNG BNB (NATIVE)
        const formattedCost = ethers.formatEther(cost);
        this.stateService.showToast(`Chi phí cần thanh toán: ${formattedCost} BNB. Đang gửi giao dịch...`, 'warning');
        
        const tx = await financeContract['buyShares'](round.id, tokenAmount, {
          value: cost,
          ...gasOverrides
        });
        this.stateService.showToast('Giao dịch đang chờ xác nhận từ mạng lưới...', 'warning');
        await tx.wait();
      }

      // 4. Tính toán số tiền đã huy động được (raised_amount) để đồng bộ về Backend
      // Lấy soldAmount thực tế sau giao dịch
      const updatedRoundInfo = await financeContract['rounds'](round.id);
      const soldAmount = updatedRoundInfo.soldAmount;
      const raisedWei = (BigInt(soldAmount) * BigInt(price)) / 1000000000000000000n;
      
      // Quy đổi raised amount theo đúng decimals của payment token
      let raisedEth = 0;
      if (isERC20) {
        const tokenContract = new Contract(paymentToken, ERC20_ABI, signer);
        const tokenDecimals = await tokenContract['decimals']();
        raisedEth = Number(ethers.formatUnits(raisedWei, tokenDecimals));
      } else {
        raisedEth = Number(ethers.formatEther(raisedWei));
      }

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

  // Đóng sớm và rút tiền về ví Quỹ của doanh nghiệp
  public async handleFinalizeRound(round: any) {
    if (!confirm(`Bạn có chắc chắn muốn kết thúc sớm vòng gọi vốn "${round.name}" và rút toàn bộ số tiền đã huy động được về ví quỹ doanh nghiệp?`)) {
      return;
    }

    const comp = this.stateService.currentCompany();
    if (!comp || !comp.funding_address) return;

    try {
      this.stateService.isLoading.set(true);
      this.stateService.showToast('Đang kết nối ví gửi giao dịch hoàn tất sớm...', 'warning');

      const signer = await this.stateService.getSigner();
      const financeContract = new Contract(comp.funding_address, FINANCE_MANAGER_ABI, signer);
      const gasOverrides = await this.stateService.getGasOverrides(signer);

      const tx = await financeContract['finalizeFundingRound'](round.id, gasOverrides);
      this.stateService.showToast('Giao dịch đang chờ xác nhận...', 'warning');
      await tx.wait();

      this.stateService.showToast('Đóng sớm vòng gọi vốn thành công! Đang đồng bộ trạng thái...', 'warning');

      // Đồng bộ Backend: đặt trạng thái thành COMPLETED
      // Lấy soldAmount từ contract để cập nhật raisedAmount chính xác
      const updatedRoundInfo = await financeContract['rounds'](round.id);
      const soldAmount = updatedRoundInfo.soldAmount;
      const price = updatedRoundInfo.price;
      const paymentToken = updatedRoundInfo.paymentToken;
      const raisedWei = (BigInt(soldAmount) * BigInt(price)) / 1000000000000000000n;

      let raisedEth = 0;
      if (paymentToken !== ethers.ZeroAddress) {
        const tokenContract = new Contract(paymentToken, ERC20_ABI, signer);
        const tokenDecimals = await tokenContract['decimals']();
        raisedEth = Number(ethers.formatUnits(raisedWei, tokenDecimals));
      } else {
        raisedEth = Number(ethers.formatEther(raisedWei));
      }

      await firstValueFrom(
        this.apiService.post<any>(`funding/${round.id}/sync`, {
          raised_amount: raisedEth,
          status: 'COMPLETED'
        }, comp.id)
      );

      this.stateService.showToast('Đã hoàn tất sớm và rút tiền thành công!', 'success');
      await this.loadFundingData();
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || 'Lỗi giao dịch hoàn tất sớm!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Hủy vòng gọi vốn và thu hồi cổ phần
  public async handleCancelRound(round: any) {
    if (!confirm(`CẢNH BÁO: Bạn có chắc chắn muốn HỦY vòng gọi vốn "${round.name}"? Hành động này sẽ cho phép toàn bộ nhà đầu tư rút lại tiền đã nạp và thu hồi cổ phần về quỹ doanh nghiệp.`)) {
      return;
    }

    const comp = this.stateService.currentCompany();
    if (!comp || !comp.funding_address) return;

    try {
      this.stateService.isLoading.set(true);
      this.stateService.showToast('Đang kết nối ví gửi giao dịch hủy vòng gọi vốn...', 'warning');

      const signer = await this.stateService.getSigner();
      const financeContract = new Contract(comp.funding_address, FINANCE_MANAGER_ABI, signer);
      const gasOverrides = await this.stateService.getGasOverrides(signer);

      const tx = await financeContract['cancelFundingRound'](round.id, gasOverrides);
      this.stateService.showToast('Giao dịch đang chờ xác nhận...', 'warning');
      await tx.wait();

      this.stateService.showToast('Đã hủy vòng gọi vốn trên Blockchain! Đang đồng bộ trạng thái...', 'warning');

      // Đồng bộ Backend: đặt trạng thái thành CANCELLED
      await firstValueFrom(
        this.apiService.post<any>(`funding/${round.id}/sync`, {
          raised_amount: round.raised_amount,
          status: 'CANCELLED'
        }, comp.id)
      );

      this.stateService.showToast('Đã hủy vòng gọi vốn thành công!', 'success');
      await this.loadFundingData();
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || 'Lỗi giao dịch hủy vòng gọi vốn!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Nhận lại tiền hoàn trả (Refund)
  public async handleClaimRefund(round: any) {
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.funding_address) return;

    try {
      this.stateService.isLoading.set(true);
      this.stateService.showToast('Đang kết nối ví kiểm tra thông tin đầu tư...', 'warning');

      const signer = await this.stateService.getSigner();
      const userAddress = await signer.getAddress();
      const financeContract = new Contract(comp.funding_address, FINANCE_MANAGER_ABI, signer);

      const shares = await financeContract['investorPurchases'](round.id, userAddress);
      const payment = await financeContract['investorPayments'](round.id, userAddress);

      if (BigInt(shares) === 0n || BigInt(payment) === 0n) {
        this.stateService.showToast('Bạn không có khoản đầu tư nào để hoàn trả trong vòng gọi vốn này!', 'error');
        return;
      }

      const updatedRoundInfo = await financeContract['rounds'](round.id);
      const shareToken = updatedRoundInfo.shareToken;
      const paymentToken = updatedRoundInfo.paymentToken;

      const gasOverrides = await this.stateService.getGasOverrides(signer);

      this.stateService.showToast('Vui lòng phê duyệt (Approve) trả lại token cổ phần cho contract...', 'warning');
      const shareTokenContract = new Contract(shareToken, ERC20_ABI, signer);
      
      const allowance = await shareTokenContract['allowance'](userAddress, comp.funding_address);
      if (BigInt(allowance) < BigInt(shares)) {
        const approveTx = await shareTokenContract['approve'](comp.funding_address, shares, gasOverrides);
        await approveTx.wait();
        this.stateService.showToast('Phê duyệt thành công! Tiến hành nhận lại tiền hoàn trả...', 'warning');
      }

      this.stateService.showToast('Đang gửi giao dịch rút tiền hoàn trả...', 'warning');
      const tx = await financeContract['claimRefund'](round.id, gasOverrides);
      this.stateService.showToast('Giao dịch đang chờ xác nhận...', 'warning');
      await tx.wait();

      this.stateService.showToast('Hoàn tiền thành công! Tiền thanh toán đã được chuyển về ví của bạn.', 'success');
      await this.loadFundingData();
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || 'Lỗi thực thi giao dịch nhận lại tiền hoàn trả!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Đăng ký vòng gọi vốn mới qua Modal đề xuất HĐQT
  public openCreateRoundModal() {
    const ref = this.modalService.open(CreateRoundProposalModalComponent, {
      title: 'Tạo đề xuất vòng gọi vốn mới',
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
