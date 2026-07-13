import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { firstValueFrom } from 'rxjs';
import { Contract } from 'ethers';
import { ModalService } from '@core/services/modal.service';
import { TabGroupComponent, TabOption } from '@shared/components/tab-group/tab-group.component';

// ABI rút gọn của Marketplace contract phục vụ settleTrade
const MARKETPLACE_ABI = [
  "function settleTrade(uint256 buyOrderId, uint256 sellOrderId, uint256 price, uint256 amount, bytes memory buyerSig, bytes memory sellerSig) external",
  "function cancelOrder(uint256 orderId) external"
];

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

  ngOnInit() {
    this.loadMarketplaceData();
  }

  public async loadMarketplaceData() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      // 1. Tải sổ lệnh
      const book = await firstValueFrom(this.apiService.get<any>('marketplace/orderbook', comp.id));
      this.buyOrders.set(book.buy || []);
      this.sellOrders.set(book.sell || []);

      // 2. Tải lịch sử giao dịch
      const trades = await firstValueFrom(this.apiService.get<any[]>('marketplace/trades', comp.id));
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

      // 1. Tạo thông điệp EIP-712 / personal_sign đặt lệnh
      const walletAddress = this.stateService.address();
      const message = `Place ${this.orderForm.side} Order for ${comp.name}\nPrice: ${price} USD\nAmount: ${amount} Shares`;

      // 2. Ký ví
      const signer = await this.stateService.getSigner();
      const signature = await signer.signMessage(message);

      // 3. Gửi lên Backend để xếp hàng và chạy Matcher Engine
      await firstValueFrom(this.apiService.post<any>('marketplace/orders', {
        side: this.orderForm.side,
        price: price,
        amount: amount,
        signature: signature,
        message: message
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

  // Thực thi Settlement On-chain (Settle Trade)
  public async handleSettleTrade(trade: any) {
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.marketplace_address) return;

    try {
      this.stateService.isLoading.set(true);
      this.stateService.showToast('Đang khởi tạo giao dịch settlement on-chain...', 'warning');

      // 1. Lấy signer và khởi tạo contract Marketplace
      const signer = await this.stateService.getSigner();
      const marketContract = new Contract(comp.marketplace_address, MARKETPLACE_ABI, signer);

      // 2. Mock signatures hoặc lấy signatures của buyer/seller từ DB
      // Vì trên testnet, để đơn giản và mượt mà trong việc hoàn tất test:
      // Contract Marketplace.sol yêu cầu verify chữ ký EIP-712 của buyer và seller.
      // Chúng ta có thể lấy chúng từ các order tương ứng đã được lưu trữ chữ ký ở Backend!
      // Ở đây ta sẽ mock hoặc giả định chữ ký đã được Backend verify và pass vào qua api.
      // Để thực tế, ta truyền các chữ ký thật mà buyer/seller đã ký khi đặt lệnh:
      const buyerSig = trade.buyer_signature || "0x"; 
      const sellerSig = trade.seller_signature || "0x";

      const priceWei = BigInt(Math.round(trade.price * 1e18)); // chuyển sang wei nếu dùng stablecoin decimal 18
      const amountWei = BigInt(Math.round(trade.amount * 1e18)); // decimal token cổ phần 18

      const gasOverrides = await this.stateService.getGasOverrides(signer);

      // Gọi hàm settleTrade on-chain
      const tx = await marketContract['settleTrade'](
        trade.buy_order_id,
        trade.sell_order_id,
        priceWei,
        amountWei,
        buyerSig,
        sellerSig,
        gasOverrides
      );

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
