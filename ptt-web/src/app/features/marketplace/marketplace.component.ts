import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { firstValueFrom } from 'rxjs';
import { Contract, ethers } from 'ethers';
import { environment } from '@environments/environment';
import { ModalService } from '@core/services/modal.service';
import { TabGroupComponent, TabOption } from '@shared/components/tab-group/tab-group.component';
import { Marketplace } from '../../core/constants/contracts';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonComponent, PaginationComponent, TabGroupComponent],
  templateUrl: './marketplace.component.html'
})
export class MarketplaceComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);
  private modalService = inject(ModalService);

  // Sổ lệnh
  public buyOrders = signal<any[]>([]);
  public sellOrders = signal<any[]>([]);
  public tradesList = signal<any[]>([]);
  public myOrdersList = signal<any[]>([]);

  // Cấu hình các payment tokens được hỗ trợ
  public supportedPaymentTokens = [
    { symbol: 'USDT', address: '0xa0f2AfaACe4cB692Ea9FF666d2eF7AB054a35407', decimals: 18 },
    // { symbol: 'USDC', address: '0x645421226040516109Ed565B1b4a6ECd3159a2D5', decimals: 18 },
    // { symbol: 'LINK', address: '0x84b9B910527Ad5C03A9Ca831909EE2157D0b7b72', decimals: 18 }
  ];
  public selectedPaymentToken = signal<any>(this.supportedPaymentTokens[0]);

  // Phân trang Lịch sử giao dịch (Trades History) - Server-side
  public currentPageTrades = signal(1);
  public totalPagesTrades = signal(1);
  public totalItemsTrades = signal(0);
  public tradesPerPage = 5; // Hiển thị 5 giao dịch mỗi trang cho gọn

  // Phân trang & Lọc Lệnh của tôi (My Orders) - Server-side
  public currentPageMyOrders = signal(1);
  public totalPagesMyOrders = signal(1);
  public totalItemsMyOrders = signal(0);
  public myOrdersPerPage = 5;
  public myOrdersTab = signal<'ACTIVE' | 'HISTORY'>('ACTIVE');

  public myBalance = signal<string>('0');          // Số dư EquityToken
  public myPaymentTokenBalance = signal<string>('0'); // Số dư PaymentToken (USDT)

  // Form đặt lệnh
  public orderForm = {
    side: 'BUY' as 'BUY' | 'SELL',
    price: '',
    amount: ''
  };

  public orderSideOptions: TabOption[] = [
    { value: 'BUY', label: 'MUA' },
    { value: 'SELL', label: 'BÁN' }
  ];

  public setOrderSide(side: string) {
    this.orderForm.side = side as 'BUY' | 'SELL';
  }

  constructor() {
    effect(() => {
      const comp = this.stateService.currentCompany();
      if (comp) {
        this.loadMarketplaceData();
      } else {
        this.buyOrders.set([]);
        this.sellOrders.set([]);
        this.tradesList.set([]);
        this.myOrdersList.set([]);
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const comp = this.stateService.currentCompany();
      const address = this.stateService.address();
      const tab = this.myOrdersTab();
      const page = this.currentPageMyOrders();
      if (comp && address) {
        this.loadMyOrders();
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const comp = this.stateService.currentCompany();
      const page = this.currentPageTrades();
      if (comp) {
        this.loadTrades();
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const comp = this.stateService.currentCompany();
      const address = this.stateService.address();
      const token = this.selectedPaymentToken();
      if (comp && address) {
        this.loadBalances();
      } else {
        this.myBalance.set('0');
        this.myPaymentTokenBalance.set('0');
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
  }

  public changePaymentToken(token: any) {
    this.selectedPaymentToken.set(token);
    this.loadMarketplaceData();
    this.loadBalances();
  }

  public async loadMarketplaceData() {
    this.loadOrderBook();
    
    if (this.currentPageTrades() === 1) {
      this.loadTrades();
    } else {
      this.currentPageTrades.set(1);
    }

    if (this.currentPageMyOrders() === 1) {
      this.loadMyOrders();
    } else {
      this.currentPageMyOrders.set(1);
    }
  }

  public async loadOrderBook() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      const book = await firstValueFrom(
        this.apiService.get<any>('marketplace/orderbook', comp.id, {
          payment_token_address: this.selectedPaymentToken().address
        })
      );
      this.buyOrders.set(book.buy || []);
      this.sellOrders.set(book.sell || []);
    } catch (e) {
      console.error('Lỗi khi tải sổ lệnh:', e);
    }
  }

  public async loadTrades() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      const res = await firstValueFrom(
        this.apiService.get<any>('marketplace/trades', comp.id, {
          payment_token_address: this.selectedPaymentToken().address,
          page: this.currentPageTrades(),
          per_page: this.tradesPerPage
        })
      );
      this.tradesList.set(res.data || []);
      this.totalPagesTrades.set(res.last_page || 1);
      this.totalItemsTrades.set(res.total || 0);
    } catch (e) {
      console.error('Lỗi khi tải lịch sử giao dịch:', e);
    }
  }

  public async loadMyOrders() {
    const comp = this.stateService.currentCompany();
    const address = this.stateService.address();
    if (!comp || !address) {
      this.myOrdersList.set([]);
      return;
    }

    try {
      const res = await firstValueFrom(
        this.apiService.get<any>('marketplace/my-orders', comp.id, {
          payment_token_address: this.selectedPaymentToken().address,
          status: this.myOrdersTab(),
          page: this.currentPageMyOrders(),
          per_page: this.myOrdersPerPage
        })
      );
      this.myOrdersList.set(res.data || []);
      this.totalPagesMyOrders.set(res.last_page || 1);
      this.totalItemsMyOrders.set(res.total || 0);
    } catch (e) {
      console.error('Lỗi khi tải lệnh cá nhân:', e);
    }
  }

  public onTradesPageChange(page: number) {
    this.currentPageTrades.set(page);
  }

  public onMyOrdersPageChange(page: number) {
    this.currentPageMyOrders.set(page);
  }

  public changeMyOrdersTab(tab: 'ACTIVE' | 'HISTORY') {
    this.myOrdersTab.set(tab);
    this.currentPageMyOrders.set(1);
  }

  public async loadBalances() {
    const address = this.stateService.address();
    const comp = this.stateService.currentCompany();
    const token = this.selectedPaymentToken();
    if (!address || !comp) {
      this.myBalance.set('0');
      this.myPaymentTokenBalance.set('0');
      return;
    }

    try {
      const chain = this.stateService.POPULAR_CHAINS.find(c => Number(c.chainId) === Number(comp.chain_id));
      const rpcUrl = chain ? chain.rpcUrl : environment.defaultRpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 100 });
      const userAddress = address;

      const promises: Promise<any>[] = [];

      // 1. Tải số dư Payment Token (USDT...)
      let paymentBalPromise = Promise.resolve(0n);
      if (token && token.address) {
        const ERC20_ABI = ["function balanceOf(address owner) external view returns (uint256)"];
        const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
        paymentBalPromise = tokenContract['balanceOf'](userAddress);
      }
      
      // 2. Tải số dư Share Token (Cổ phần)
      let shareBalPromise = Promise.resolve([0n, 18]);
      if (comp.token_address && comp.token_address !== '—') {
        const EQUITY_TOKEN_ABI = [
          "function balanceOf(address owner) external view returns (uint256)",
          "function decimals() external view returns (uint8)"
        ];
        const shareTokenContract = new ethers.Contract(comp.token_address, EQUITY_TOKEN_ABI, provider);
        shareBalPromise = Promise.all([
          shareTokenContract['balanceOf'](userAddress),
          shareTokenContract['decimals']()
        ]);
      }

      const [payBal, shareInfo] = await Promise.all([paymentBalPromise, shareBalPromise]);
      
      if (token && token.address) {
        this.myPaymentTokenBalance.set(ethers.formatUnits(payBal, token.decimals));
      } else {
        this.myPaymentTokenBalance.set('0');
      }

      if (comp.token_address && comp.token_address !== '—') {
        const [bal, dec] = shareInfo as [bigint, number];
        this.myBalance.set(ethers.formatUnits(bal, dec));
      } else {
        this.myBalance.set('0');
      }
    } catch (e) {
      console.warn('Lỗi load số dư marketplace:', e);
    }
  }

  // Đặt lệnh giao dịch mới
  public async handlePlaceOrder() {
    if (this.stateService.isLoading()) return;

    if (!this.orderForm.price || !this.orderForm.amount) {
      this.stateService.showToast('Vui lòng nhập đầy đủ giá và số lượng', 'warning');
      return;
    }

    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      const price = parseFloat(this.orderForm.price);
      const amount = parseFloat(this.orderForm.amount);
      const token = this.selectedPaymentToken();

      // Kiểm tra số dư khả dụng trước khi đặt lệnh
      if (this.orderForm.side === 'SELL') {
        const shareBalance = parseFloat(this.myBalance() || '0');
        if (amount > shareBalance) {
          this.stateService.showToast(`Số dư cổ phần không đủ để thực hiện lệnh bán (Số dư hiện tại: ${this.formatNumber(shareBalance)} ${comp.token_symbol || 'PTT'})`, 'error');
          return;
        }
      } else if (this.orderForm.side === 'BUY') {
        const paymentBalance = parseFloat(this.myPaymentTokenBalance() || '0');
        const totalCost = price * amount;
        if (totalCost > paymentBalance) {
          this.stateService.showToast(`Số dư ${token.symbol} không đủ để thực hiện lệnh mua (Cần: ${this.formatNumber(totalCost)} ${token.symbol}, Số dư hiện tại: ${this.formatNumber(paymentBalance)} ${token.symbol})`, 'error');
          return;
        }
      }

      // 1. Tạo thông điệp hash đóng gói tham số đặt lệnh (để khớp xác thực Smart Contract)
      const walletAddress = this.stateService.address();
      if (!walletAddress) return;

      const nonce = BigInt(Date.now());
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 365); // 1 năm

      const tokenDecimals = token.decimals || 18;
      const priceWei = ethers.parseUnits(String(price), tokenDecimals);
      const amountWei = ethers.parseEther(String(amount));

      const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
        [walletAddress, comp.token_address, amountWei, priceWei, nonce, deadline]
      );

      this.stateService.isLoading.set(true);

      // 2. Ký ví thông điệp hash này
      const signer = await this.stateService.getSigner();
      const signature = await signer.signMessage(ethers.getBytes(messageHash));
      const signatureFull = `${signature}_${nonce.toString()}_${deadline.toString()}`;

      // 3. Gửi lên Backend để xếp hàng và chạy Matcher Engine
      await firstValueFrom(this.apiService.post<any>('marketplace/orders', {
        side: this.orderForm.side,
        price: price,
        amount: amount,
        signature: signatureFull,
        message: messageHash,
        payment_token_address: token.address,
        payment_token_symbol: token.symbol
      }, comp.id));

      this.stateService.showToast('Đặt lệnh thành công! Hệ thống đang tự động khớp lệnh...', 'success');
      this.orderForm.price = '';
      this.orderForm.amount = '';

      await this.loadMarketplaceData();
      await this.loadBalances();
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.error?.message || 'Lỗi đặt lệnh hoặc từ chối ký!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  public handleCancelOrder(orderId: number) {
    if (this.stateService.isLoading()) return;

    const comp = this.stateService.currentCompany();
    if (!comp) return;

    const confirmRef = this.modalService.confirm({
      title: 'Hủy lệnh giao dịch',
      description: 'Bạn có chắc chắn muốn hủy lệnh giao dịch này không?',
      confirmText: 'HỦY LỆNH',
      cancelText: 'QUAY LẠI',
      confirmButtonClass: 'btn-danger'
    });

    confirmRef.afterClosed$.subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          this.stateService.isLoading.set(true);
          await firstValueFrom(this.apiService.post<any>(`marketplace/orders/${orderId}/cancel`, {}, comp.id));
          this.stateService.showToast('Đã hủy lệnh thành công!', 'success');
          await this.loadMarketplaceData();
          await this.loadBalances();
        } catch (e: any) {
          this.stateService.showToast(e.error?.message || 'Có lỗi xảy ra!', 'error');
        } finally {
          this.stateService.isLoading.set(false);
        }
      }
    });
  }

  public async handleSettleTrade(trade: any) {
    if (this.stateService.isLoading()) return;

    const comp = this.stateService.currentCompany();
    if (!comp || !comp.marketplace_address) return;

    try {
      this.stateService.isLoading.set(true);
      this.stateService.showToast('Đang khởi tạo giao dịch settlement on-chain...', 'warning');

      // 1. Lấy signer và khởi tạo contract Marketplace
      const signer = await this.stateService.getSigner();
      const marketContract = new Contract(comp.marketplace_address, Marketplace.abi, signer);

      // 2. Lấy chữ ký thực tế, nonce và deadline của buyer & seller đã được lưu ở Backend
      const buyerSigFull = trade.buyer_signature || "";
      const sellerSigFull = trade.seller_signature || "";

      const buyerParts = buyerSigFull.split('_');
      const sellerParts = sellerSigFull.split('_');

      const buyerSig = buyerParts[0] || "0x";
      const buyerNonce = buyerParts[1] ? BigInt(buyerParts[1]) : 0n;
      const buyerDeadline = buyerParts[2] ? BigInt(buyerParts[2]) : 0n;

      const sellerSig = sellerParts[0] || "0x";
      const sellerNonce = sellerParts[1] ? BigInt(sellerParts[1]) : 0n;
      const sellerDeadline = sellerParts[2] ? BigInt(sellerParts[2]) : 0n;

      const token = this.selectedPaymentToken();
      const priceWei = ethers.parseUnits(String(trade.price), token.decimals); // Decimals của USDT/USDC (thường là 18 hoặc 6)
      const amountWei = ethers.parseEther(String(trade.amount)); // Cổ phần 18 decimals

      const gasOverrides = await this.stateService.getGasOverrides(signer);

      // Build parameters object (struct TradeParams) matching smart contract executeTrade
      const tradeParams = {
        token: comp.token_address,
        paymentToken: trade.payment_token_address || token.address,
        buyer: trade.buyer_address,
        seller: trade.seller_address,
        amount: amountWei,
        price: priceWei,
        buyerNonce: buyerNonce,
        sellerNonce: sellerNonce,
        buyerDeadline: buyerDeadline,
        sellerDeadline: sellerDeadline,
        buyerSig: buyerSig,
        sellerSig: sellerSig
      };

      // Gọi hàm executeTrade on-chain của hợp đồng Marketplace
      const tx = await marketContract['executeTrade'](tradeParams, gasOverrides);

      this.stateService.showToast('Giao dịch Settle đã gửi. Đang xác nhận...', 'warning');
      const receipt = await tx.wait();

      // 3. Cập nhật tx_hash lên Backend
      await firstValueFrom(this.apiService.post<any>('marketplace/trades/settle', {
        buy_order_id: trade.buy_order_id,
        sell_order_id: trade.sell_order_id,
        price: trade.price,
        amount: trade.amount,
        tx_hash: receipt.hash
      }, comp.id));

      this.stateService.showToast('Settle giao dịch on-chain thành công!', 'success');
      await this.loadMarketplaceData();
      await this.loadBalances();
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || 'Lỗi giao dịch blockchain khi Settle!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Format số lớn
  public formatNumber(n: string | number): string {
    return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 4 });
  }

  // Rút gọn địa chỉ ví
  public shortAddress(addr: string): string {
    if (!addr) return '';
    return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
  }
}
