import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { firstValueFrom, filter } from 'rxjs';
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
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)"
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
  public myPaymentTokenBalance = signal<string>('0');
  public myPaymentTokenSymbol = signal<string>('BNB');

  // Cổ tức
  public dividendsList = signal<any[]>([]);

  // Loading state
  public isPageLoading = signal(true);

  constructor() {
    effect(() => {
      const comp = this.stateService.currentCompany();
      const addr = this.stateService.address(); // Lắng nghe cả thay đổi ví để tự load lại số dư
      if (comp) {
        this.loadFundingData();
      } else {
        this.roundsList.set([]);
        this.dividendsList.set([]);
        this.myPaymentTokenBalance.set('0');
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

      // 3. Tải số dư token thanh toán
      await this.loadPaymentTokenBalance();
    } catch (e) {
      console.error('Lỗi khi tải dữ liệu gọi vốn/cổ tức:', e);
    } finally {
      this.isPageLoading.set(false);
    }
  }

  // Tải số dư token thanh toán (USDT/BNB) của ví đang kết nối
  public async loadPaymentTokenBalance() {
    const comp = this.stateService.currentCompany();
    if (!comp || !this.stateService.isConnected() || !this.stateService.address()) {
      this.myPaymentTokenBalance.set('0');
      return;
    }

    try {
      const activeRound = this.roundsList().find(r => r.status === 'ACTIVE');
      if (!activeRound) return;

      const provider = new ethers.JsonRpcProvider('https://bsc-testnet-rpc.publicnode.com');
      const userAddress = this.stateService.address();
      if (!userAddress) return;

      const paymentToken = activeRound.payment_token_address;
      const isERC20 = paymentToken && paymentToken !== ethers.ZeroAddress;

      if (isERC20) {
        const tokenContract = new Contract(paymentToken, ERC20_ABI, provider);
        const [bal, dec, sym] = await Promise.all([
          tokenContract['balanceOf'](userAddress),
          tokenContract['decimals'](),
          tokenContract['symbol']()
        ]);
        this.myPaymentTokenBalance.set(ethers.formatUnits(bal, dec));
        this.myPaymentTokenSymbol.set(sym);
      } else {
        const bal = await provider.getBalance(userAddress);
        this.myPaymentTokenBalance.set(ethers.formatEther(bal));
        this.myPaymentTokenSymbol.set('BNB');
      }
    } catch (err) {
      console.warn('[Funding] Không thể tải số dư payment token:', err);
    }
  }

  // Mua cổ phần gọi vốn (Purchase Shares)
  public async handlePurchaseShares(round: any) {
    if (this.stateService.isLoading()) return;

    if (!this.purchaseAmount || Number(this.purchaseAmount) <= 0) {
      this.stateService.showToast('Vui lòng nhập số lượng cổ phần muốn mua', 'warning');
      return;
    }

    const comp = this.stateService.currentCompany();
    if (!comp || !comp.funding_address) return;

    try {
      this.stateService.isLoading.set(true);

      // Refresh thông tin user để lấy kyc_status mới nhất từ server
      await this.stateService.refreshCurrentUser();

      // Check KYC status
      if (this.stateService.currentUser()?.kyc_status !== 'APPROVED') {
        this.stateService.showToast('Tài khoản của bạn chưa vượt qua KYC của hệ thống!', 'error');
        this.stateService.isLoading.set(false);
        return;
      }

      this.stateService.showToast('Đang kết nối ví và kiểm tra thông tin vòng gọi vốn...', 'warning');

      // 1. Lấy signer và khởi tạo contract FinanceManager
      const signer = await this.stateService.getSigner();
      const userAddress = await signer.getAddress();
      const financeContract = new Contract(comp.funding_address, FINANCE_MANAGER_ABI, signer);

      // 2. Đọc thông tin round từ contract để lấy giá price chính xác
      const onchainRoundId = round.onchain_round_id;
      const roundInfo = await financeContract['rounds'](onchainRoundId);
      const price = roundInfo.price;
      const paymentToken = roundInfo.paymentToken;

      const tokenAmount = parseEther(String(this.purchaseAmount)); // Số lượng cổ phần quy đổi sang Wei (18 decimals) — String() đảm bảo type an toàn với ethers v6
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
        const tx = await financeContract['buyShares'](onchainRoundId, tokenAmount, {
          value: 0,
          ...gasOverrides
        });
        this.stateService.showToast('Giao dịch đang chờ xác nhận từ mạng lưới...', 'warning');
        await tx.wait();
      } else {
        // FLOW THANH TOÁN BẰNG BNB (NATIVE)
        const formattedCost = ethers.formatEther(cost);
        this.stateService.showToast(`Chi phí cần thanh toán: ${formattedCost} BNB. Đang gửi giao dịch...`, 'warning');
        
        const tx = await financeContract['buyShares'](onchainRoundId, tokenAmount, {
          value: cost,
          ...gasOverrides
        });
        this.stateService.showToast('Giao dịch đang chờ xác nhận từ mạng lưới...', 'warning');
        await tx.wait();
      }

      // 4. Tính toán số tiền đã huy động được (raised_amount) để đồng bộ về Backend
      // Lấy soldAmount thực tế sau giao dịch
      const updatedRoundInfo = await financeContract['rounds'](onchainRoundId);
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
      const friendlyMsg = this.parseContractError(e);
      this.stateService.showToast(friendlyMsg, 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Đóng sớm và rút tiền về ví Quỹ của doanh nghiệp
  public async handleFinalizeRound(round: any) {
    if (this.stateService.isLoading()) return;

    const confirmed = await firstValueFrom(
      this.modalService.confirm({
        title: 'Xác nhận đóng & rút tiền sớm',
        description: `Bạn có chắc chắn muốn kết thúc sớm vòng gọi vốn "${round.name}" và rút toàn bộ số tiền đã huy động được về ví quỹ doanh nghiệp?`,
        confirmText: 'Đóng & Rút tiền',
        cancelText: 'Hủy bỏ',
        confirmButtonClass: 'btn-primary',
        size: 'sm'
      }).afterClosed$
    );
    if (!confirmed) return;

    const comp = this.stateService.currentCompany();
    if (!comp || !comp.funding_address) return;

    try {
      this.stateService.isLoading.set(true);
      this.stateService.showToast('Đang kết nối ví gửi giao dịch hoàn tất sớm...', 'warning');

      const signer = await this.stateService.getSigner();
      const financeContract = new Contract(comp.funding_address, FINANCE_MANAGER_ABI, signer);
      const gasOverrides = await this.stateService.getGasOverrides(signer);

      const tx = await financeContract['finalizeFundingRound'](round.onchain_round_id, gasOverrides);
      this.stateService.showToast('Giao dịch đang chờ xác nhận...', 'warning');
      await tx.wait();

      this.stateService.showToast('Đóng sớm vòng gọi vốn thành công! Đang đồng bộ trạng thái...', 'warning');

      // Đồng bộ Backend: đặt trạng thái thành COMPLETED
      // Lấy soldAmount từ contract để cập nhật raisedAmount chính xác
      const updatedRoundInfo = await financeContract['rounds'](round.onchain_round_id);
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
      const friendlyMsg = this.parseContractError(e);
      this.stateService.showToast(friendlyMsg, 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Hủy vòng gọi vốn và thu hồi cổ phần
  public async handleCancelRound(round: any) {
    if (this.stateService.isLoading()) return;

    const confirmed = await firstValueFrom(
      this.modalService.confirm({
        title: 'Xác nhận hủy vòng gọi vốn',
        description: `CẢNH BÁO: Bạn có chắc chắn muốn HỦY vòng gọi vốn "${round.name}"? Hành động này sẽ cho phép toàn bộ nhà đầu tư rút lại tiền đã nạp và thu hồi cổ phần về quỹ doanh nghiệp.`,
        confirmText: 'Hủy vòng gọi vốn',
        cancelText: 'Quay lại',
        confirmButtonClass: 'btn-danger',
        size: 'sm'
      }).afterClosed$
    );
    if (!confirmed) return;

    const comp = this.stateService.currentCompany();
    if (!comp || !comp.funding_address) return;

    try {
      this.stateService.isLoading.set(true);
      this.stateService.showToast('Đang kết nối ví gửi giao dịch hủy vòng gọi vốn...', 'warning');

      const signer = await this.stateService.getSigner();
      const financeContract = new Contract(comp.funding_address, FINANCE_MANAGER_ABI, signer);
      const gasOverrides = await this.stateService.getGasOverrides(signer);

      const tx = await financeContract['cancelFundingRound'](round.onchain_round_id, gasOverrides);
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
      const friendlyMsg = this.parseContractError(e);
      this.stateService.showToast(friendlyMsg, 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Nhận lại tiền hoàn trả (Refund)
  public async handleClaimRefund(round: any) {
    if (this.stateService.isLoading()) return;

    const comp = this.stateService.currentCompany();
    if (!comp || !comp.funding_address) return;

    try {
      this.stateService.isLoading.set(true);
      this.stateService.showToast('Đang kết nối ví kiểm tra thông tin đầu tư...', 'warning');

      const signer = await this.stateService.getSigner();
      const userAddress = await signer.getAddress();
      const financeContract = new Contract(comp.funding_address, FINANCE_MANAGER_ABI, signer);

      const shares = await financeContract['investorPurchases'](round.onchain_round_id, userAddress);
      const payment = await financeContract['investorPayments'](round.onchain_round_id, userAddress);

      if (BigInt(shares) === 0n || BigInt(payment) === 0n) {
        this.stateService.showToast('Bạn không có khoản đầu tư nào để hoàn trả trong vòng gọi vốn này!', 'error');
        return;
      }

      const updatedRoundInfo = await financeContract['rounds'](round.onchain_round_id);
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
      const tx = await financeContract['claimRefund'](round.onchain_round_id, gasOverrides);
      this.stateService.showToast('Giao dịch đang chờ xác nhận...', 'warning');
      await tx.wait();

      this.stateService.showToast('Hoàn tiền thành công! Tiền thanh toán đã được chuyển về ví của bạn.', 'success');
      await this.loadFundingData();
    } catch (e: any) {
      console.error(e);
      const friendlyMsg = this.parseContractError(e);
      this.stateService.showToast(friendlyMsg, 'error');
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
      const friendlyMsg = this.parseContractError(e);
      this.stateService.showToast(friendlyMsg, 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Giải mã lỗi Smart Contract thân thiện với người dùng
  private parseContractError(e: any): string {
    console.log('Parsing contract error:', e);
    let data = '';

    // Trích xuất revert data hex từ các thuộc tính lỗi phổ biến của ethers / metamask
    if (e.data && typeof e.data === 'string') {
      data = e.data;
    } else if (e.error?.data && typeof e.error.data === 'string') {
      data = e.error.data;
    } else if (e.error?.data?.data && typeof e.error.data.data === 'string') {
      data = e.error.data.data;
    } else if (typeof e.message === 'string') {
      const match = e.message.match(/0x[a-fA-F0-9]{8,}/);
      if (match) {
        data = match[0];
      }
    }

    if (data && data.startsWith('0x')) {
      const selector = data.slice(0, 10).toLowerCase();

      // Trường hợp require(string) -> selector 0x08c379a0
      if (selector === '0x08c379a0') {
        try {
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + data.slice(10));
          const reason = decoded[0];
          if (reason === 'Sender is not whitelisted') {
            return 'Lỗi: Smart Contract Gọi vốn chưa được Whitelist trên EquityToken!';
          }
          if (reason === 'Receiver is not whitelisted') {
            return 'Lỗi: Ví của bạn chưa được Whitelist trên Smart Contract Cổ phần (EquityToken)!';
          }
          if (reason === 'Sender is blacklisted') {
            return 'Lỗi: Ví gửi đang nằm trong danh sách hạn chế (Blacklist)!';
          }
          if (reason === 'Receiver is blacklisted') {
            return 'Lỗi: Ví nhận đang nằm trong danh sách hạn chế (Blacklist)!';
          }
          return `Yêu cầu bị từ chối từ Contract: ${reason}`;
        } catch (err) {
          // ignore
        }
      }

      // Danh sách mã lỗi custom từ FinanceManager & EquityToken & OpenZeppelin
      const ERROR_MAP: { [key: string]: string } = {
        '0x98f76d0e': 'Bạn không có quyền thực hiện hành động này (Yêu cầu thành viên HĐQT).',
        '0x266f3685': 'Vòng gọi vốn không tồn tại trên Smart Contract.',
        '0x00bfc921': 'Giá cổ phần không hợp lệ.',
        '0xca07b5fb': 'Địa chỉ Smart Contract cấu hình không hợp lệ.',
        '0x6f7eac26': 'Thời gian bắt đầu/kết thúc vòng gọi vốn không hợp lệ.',
        '0x175aca88': 'Cấu hình giá hoặc tổng cung không hợp lệ.',
        '0x3df07da5': 'Vòng gọi vốn chưa được kích hoạt hoặc đã đóng.',
        '0xc84f87a0': 'Vòng gọi vốn đã kết thúc hoặc bị hủy.',
        '0x8e9c6e1c': 'Vòng gọi vốn chưa đến thời gian bắt đầu.',
        '0x6b5fd31b': 'Vòng gọi vốn đã quá thời gian kết thúc.',
        '0xc30436e9': 'Số lượng mua vượt quá số lượng cổ phần còn lại trong vòng này.',
        '0x72e7012e': 'Smart Contract không đủ số lượng token cổ phần để phân phối. Vui lòng liên hệ doanh nghiệp nạp thêm token vào contract.',
        '0x3392b3a0': 'Địa chỉ ví của bạn không nằm trong Whitelist riêng của vòng này.',
        '0x1854e357': 'Địa chỉ ví của bạn hoặc ví Smart Contract Gọi vốn chưa được Whitelist trên Smart Contract Cổ phần (EquityToken). Vui lòng thông báo HĐQT Whitelist.',
        '0x1ee09783': 'Số lượng mua tối thiểu chưa đạt giới hạn cho phép.',
        '0x3882ab80': 'Số lượng mua vượt quá giới hạn tối đa cho phép của mỗi ví.',
        '0xbf64110f': 'Tài khoản của bạn không đủ số dư BNB để thanh toán.',
        '0x90b8ec18': 'Giao dịch chuyển tiền thất bại.',
        '0xaf7aec56': 'Vòng gọi vốn thanh toán bằng ERC20, không nhận BNB.',
        '0xfe382aa7': 'Số dư token thanh toán (USDT/USDC...) của bạn không đủ để thực hiện giao dịch.',
        '0xfb8f41b2': 'Quyền chi tiêu token (Allowance) không đủ. Vui lòng Approve lại.',
        '0xe450d38c': 'Số dư tài khoản không đủ để thực hiện giao dịch.',
        '0xd93c0665': 'Hợp đồng hiện đang tạm dừng giao dịch.',
        '0x118cdaa7': 'Tài khoản không được ủy quyền thực hiện hành động này.',
        '0x60ffcb5e': 'Bạn không sở hữu cổ phần tại thời điểm snapshot đợt chia cổ tức này.',
        '0x6fa6d0a5': 'Doanh nghiệp chưa hoàn thành mục tiêu gọi vốn hoặc chưa quá hạn, không thể rút tiền.',
        '0x646cf558': 'Bạn đã nhận cổ tức đợt này rồi.',
      };

      if (ERROR_MAP[selector]) {
        return `Lỗi Smart Contract: ${ERROR_MAP[selector]}`;
      }
    }

    // Lỗi từ chối từ Metamask
    if (e.message && (e.message.includes('user rejected action') || e.message.includes('user rejected transaction'))) {
      return 'Giao dịch đã bị từ chối từ ví MetaMask/AppKit.';
    }

    return e.reason || e.message || 'Lỗi thực thi giao dịch trên Blockchain!';
  }
}
