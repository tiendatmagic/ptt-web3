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

  // Cấu hình các payment tokens được hỗ trợ
  public supportedPaymentTokens = [
    { symbol: 'USDT', address: '0x337610d27c682E347C9cD60BD4b3b107c913E45f', decimals: 18 },
    { symbol: 'USDC', address: '0x645421226040516109Ed565B1b4a6ECd3159a2D5', decimals: 18 },
    { symbol: 'LINK', address: '0x84b9B910527Ad5C03A9Ca831909EE2157D0b7b72', decimals: 18 }
  ];
  public selectedPaymentToken = signal<any>(this.supportedPaymentTokens[0]);

  // Phân trang Lịch sử giao dịch (Trades History)
  public currentPageTrades = signal(1);
  public tradesPerPage = 5; // Hiển thị 5 giao dịch mỗi trang cho gọn

  public paginatedTrades = computed(() => {
    const start = (this.currentPageTrades() - 1) * this.tradesPerPage;
    const end = start + this.tradesPerPage;
    return this.tradesList().slice(start, end);
  });

  public totalPagesTrades = computed(() => {
    return Math.ceil(this.tradesList().length / this.tradesPerPage) || 1;
  });

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
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
  }

  public changePaymentToken(token: any) {
    this.selectedPaymentToken.set(token);
    this.loadMarketplaceData();
  }

  public async loadMarketplaceData() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      // 1. Tải sổ lệnh
      const book = await firstValueFrom(
        this.apiService.get<any>('marketplace/orderbook', comp.id, {
          payment_token_address: this.selectedPaymentToken().address
        })
      );
      this.buyOrders.set(book.buy || []);
      this.sellOrders.set(book.sell || []);

      // 2. Tải lịch sử giao dịch
      const trades = await firstValueFrom(
        this.apiService.get<any[]>('marketplace/trades', comp.id, {
          payment_token_address: this.selectedPaymentToken().address
        })
      );
      this.tradesList.set(trades || []);
      this.currentPageTrades.set(1); // Reset về trang 1
    } catch (e) {
      console.error('Lỗi khi tải dữ liệu thị trường:', e);
    }
  }

  public onTradesPageChange(page: number) {
    this.currentPageTrades.set(page);
  }

  // Đặt lệnh giao dịch mới
  public async handlePlaceOrder() {
    if (!this.orderForm.price || !this.orderForm.amount) {
      this.stateService.showToast('Vui lòng nhập đầy đủ giá và số lượng', 'warning');
      return;
    }

    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      this.stateService.isLoading.set(true);

      const price = parseFloat(this.orderForm.price);
      const amount = parseFloat(this.orderForm.amount);
      const token = this.selectedPaymentToken();

      // 1. Tạo thông điệp EIP-712 / personal_sign đặt lệnh
      const walletAddress = this.stateService.address();
      const message = `Place ${this.orderForm.side} Order for ${comp.name}\nPrice: ${price} ${token.symbol}\nAmount: ${amount} Shares\nPayment Token: ${token.address}`;

      // 2. Ký ví
      const signer = await this.stateService.getSigner();
      const signature = await signer.signMessage(message);

      // 3. Gửi lên Backend để xếp hàng và chạy Matcher Engine
      await firstValueFrom(this.apiService.post<any>('marketplace/orders', {
        side: this.orderForm.side,
        price: price,
        amount: amount,
        signature: signature,
        message: message,
        payment_token_address: token.address,
        payment_token_symbol: token.symbol
      }, comp.id));

      this.stateService.showToast('Đặt lệnh thành công! Hệ thống đang tự động khớp lệnh...', 'success');
      this.orderForm.price = '';
      this.orderForm.amount = '';

      await this.loadMarketplaceData();
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.error?.message || 'Lỗi đặt lệnh hoặc từ chối ký!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  public handleCancelOrder(orderId: number) {
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
        } catch (e: any) {
          this.stateService.showToast(e.error?.message || 'Có lỗi xảy ra!', 'error');
        } finally {
          this.stateService.isLoading.set(false);
        }
      }
    });
  }

  public async handleSettleTrade(trade: any) {
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.marketplace_address) return;

    try {
      this.stateService.isLoading.set(true);
      this.stateService.showToast('Đang khởi tạo giao dịch settlement on-chain...', 'warning');

      // 1. Lấy signer và khởi tạo contract Marketplace
      const signer = await this.stateService.getSigner();
      const marketContract = new Contract(comp.marketplace_address, Marketplace.abi, signer);

      // 2. Lấy chữ ký thực tế của buyer & seller đã được lưu ở Backend
      const buyerSig = trade.buyer_signature || "0x";
      const sellerSig = trade.seller_signature || "0x";

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
        buyerNonce: BigInt(trade.buy_order_id),
        sellerNonce: BigInt(trade.sell_order_id),
        buyerDeadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 365), // 1 năm
        sellerDeadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 365),
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
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || 'Lỗi giao dịch blockchain khi Settle!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }
}
