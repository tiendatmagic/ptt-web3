import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { firstValueFrom } from 'rxjs';
import { ethers } from 'ethers';

import { TabGroupComponent } from '@shared/components/tab-group/tab-group.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { IconComponent } from '@shared/components/icon/icon.component';

// Minimal ABIs — chỉ những function cần thiết cho investor
const EQUITY_TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

// ABI khớp chính xác với FinanceManager contract
const FUNDING_MANAGER_ABI = [
  'function roundCount() view returns (uint256)',
  'function rounds(uint256 roundId) view returns (uint256 id, string name, address shareToken, address paymentToken, address treasury, uint256 price, uint256 maxSupply, uint256 soldAmount, uint256 startTime, uint256 endTime, uint256 minPurchase, uint256 maxPurchase, bool isWhitelistOnly, bool active)',
  'function buyShares(uint256 roundId, uint256 tokenAmount) external payable'
];

// ABI rút gọn của ERC20 để xử lý phê duyệt (approve)
const ERC20_ABI = [
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const DISTRIBUTION_MANAGER_ABI = [
  'function claimableDividend(address investor) view returns (uint256)',
  'function claimDividend()'
];

const MARKETPLACE_ABI = [
  'function placeOrder(bool isBuy, uint256 pricePerShare, uint256 amount)',
  'function cancelOrder(uint256 orderId)',
  'function settleTrade(tuple(address seller, address buyer, uint256 pricePerShare, uint256 amount, uint256 deadline, bytes sellerSig, bytes buyerSig) trade)'
];

@Component({
  selector: 'app-invest',
  standalone: true,
  imports: [CommonModule, FormsModule, TabGroupComponent, ButtonComponent, IconComponent],
  templateUrl: './invest.component.html'
})
export class InvestComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  // Tabs
  public activeTab = signal<'funding' | 'trade' | 'dividends' | 'portfolio'>('funding');
  public tabOptions = [
    { value: 'funding', label: 'Mua cổ phần', icon: 'pos' },
    { value: 'trade', label: 'Giao dịch P2P', icon: 'blockchain' },
    { value: 'dividends', label: 'Cổ tức', icon: 'financials' },
    { value: 'portfolio', label: 'Portfolio', icon: 'staffs' }
  ];

  // Dữ liệu công ty (từ Public API, không cần auth)
  public companiesList = signal<any[]>([]);
  public selectedCompany = signal<any | null>(null);

  // On-chain data
  public myBalance = signal<string>('0');         // EquityToken balance
  public totalSupply = signal<string>('0');        // Tổng cung
  public claimableDiv = signal<string>('0');       // Cổ tức có thể claim

  // Funding round
  public activeFundingRound = signal<any | null>(null);
  public buyAmount = signal<number>(1);
  public buyLoading = signal(false);

  // Marketplace
  public orderSide = signal<'BUY' | 'SELL'>('BUY');
  public orderPrice = signal<string>('');
  public orderAmount = signal<number>(1);
  public orderLoading = signal(false);
  public orderBook = signal<{ bids: any[], asks: any[] }>({ bids: [], asks: [] });

  // Dividends
  public dividendLoading = signal(false);

  // Computed: đã kết nối ví chưa
  public isConnected = computed(() => this.stateService.isConnected());
  public walletAddress = computed(() => this.stateService.address());

  public setActiveTab(tab: string) {
    this.activeTab.set(tab as 'funding' | 'trade' | 'dividends' | 'portfolio');
  }

  public setOrderSide(side: string) {
    this.orderSide.set(side as 'BUY' | 'SELL');
  }

  async ngOnInit() {
    await this.loadCompanies();
  }

  // Load danh sách công ty (public API, không cần auth)
  async loadCompanies() {
    try {
      const list = await firstValueFrom(this.apiService.get<any[]>('companies'));
      this.companiesList.set(list || []);
      if (list && list.length > 0) {
        await this.selectCompany(list[0]);
      }
    } catch (e) {
      console.error('Failed to load companies:', e);
    }
  }

  async selectCompany(company: any) {
    this.selectedCompany.set(company);
    await Promise.all([
      this.loadOnChainData(company),
      this.loadOrderBook(company)
    ]);
  }

  // Đọc data trực tiếp từ Smart Contracts (không cần backend auth)
  async loadOnChainData(company: any) {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);

      // EquityToken balance + total supply
      if (company.token_address && company.token_address !== '—') {
        const token = new ethers.Contract(company.token_address, EQUITY_TOKEN_ABI, provider);
        const [supply, decimals] = await Promise.all([
          token['totalSupply'](),
          token['decimals']()
        ]);
        this.totalSupply.set(ethers.formatUnits(supply, decimals));

        if (this.walletAddress()) {
          const balance = await token['balanceOf'](this.walletAddress());
          this.myBalance.set(ethers.formatUnits(balance, decimals));
        }
      }

      // Claimable dividend
      if (company.funding_address && this.walletAddress()) {
        const dist = new ethers.Contract(company.funding_address, DISTRIBUTION_MANAGER_ABI, provider);
        const claimable = await dist['claimableDividend'](this.walletAddress());
        this.claimableDiv.set(ethers.formatEther(claimable));
      }

      // Active funding round — contract dùng roundCount() + rounds(id), không có activeRoundId()
      if (company.funding_address) {
        const funding = new ethers.Contract(company.funding_address, FUNDING_MANAGER_ABI, provider);
        try {
          const count = Number(await funding['roundCount']());
          let found = null;
          // Tìm round mới nhất có active = true
          for (let i = count; i >= 1; i--) {
            const r = await funding['rounds'](i);
            if (r.active) {
              const isERC20 = r.paymentToken !== ethers.ZeroAddress;
              let tokenSymbol = 'BNB';
              let tokenDecimals = 18;

              if (isERC20) {
                try {
                  const tokenContract = new ethers.Contract(r.paymentToken, ERC20_ABI, provider);
                  const [sym, dec] = await Promise.all([
                    tokenContract['symbol'](),
                    tokenContract['decimals']()
                  ]);
                  tokenSymbol = sym;
                  tokenDecimals = Number(dec);
                } catch (tokErr) {
                  console.warn('Lỗi đọc metadata payment token:', tokErr);
                  tokenSymbol = 'USDT';
                  tokenDecimals = 18;
                }
              }

              found = {
                id: Number(r.id),
                name: r.name,
                paymentToken: r.paymentToken,
                paymentTokenSymbol: tokenSymbol,
                paymentTokenDecimals: tokenDecimals,
                price: ethers.formatUnits(r.price, tokenDecimals),
                maxSupply: ethers.formatEther(r.maxSupply),   // tokens cổ phần luôn 18 decimals
                soldAmount: ethers.formatEther(r.soldAmount), // tokens cổ phần luôn 18 decimals
                isWhitelistOnly: r.isWhitelistOnly,
                active: r.active,
                startTime: Number(r.startTime),
                endTime: Number(r.endTime)
              };
              break;
            }
          }
          this.activeFundingRound.set(found);
        } catch (err) {
          console.warn('Lỗi đọc funding round:', err);
          this.activeFundingRound.set(null);
        }
      }
    } catch (e) {
      console.error('On-chain read error:', e);
    }
  }

  // Load order book từ public API
  async loadOrderBook(company: any) {
    try {
      const data = await firstValueFrom(
        this.apiService.get<any>('marketplace/orderbook', undefined, { company_id: company.id })
      );
      this.orderBook.set(data || { bids: [], asks: [] });
    } catch (e) {
      this.orderBook.set({ bids: [], asks: [] });
    }
  }

  // Mua cổ phần từ FundingManager
  async handleBuyShares() {
    const company = this.selectedCompany();
    const round = this.activeFundingRound();
    if (!company || !round || !this.isConnected()) return;

    this.buyLoading.set(true);
    try {
      const signer = await this.stateService.web3Service.getSigner();
      const userAddress = await signer.getAddress();
      const funding = new ethers.Contract(company.funding_address, FUNDING_MANAGER_ABI, signer);

      // Token amount (18 decimals)
      const tokenAmount = ethers.parseEther(this.buyAmount().toString());
      // Chi phí = amount * price/token
      const pricePerToken = ethers.parseUnits(round.price, round.paymentTokenDecimals);
      const cost = (tokenAmount * pricePerToken) / ethers.parseEther('1');

      const isERC20 = round.paymentToken !== ethers.ZeroAddress;
      const gasOverrides = await this.stateService.web3Service.getGasOverrides();

      if (isERC20) {
        // Hỗ trợ thanh toán bằng Token ERC20
        const tokenContract = new ethers.Contract(round.paymentToken, ERC20_ABI, signer);
        const formattedCost = ethers.formatUnits(cost, round.paymentTokenDecimals);

        this.stateService.showToast(`Kiểm tra quyền sử dụng ${round.paymentTokenSymbol}...`, 'warning');
        const allowance = await tokenContract['allowance'](userAddress, company.funding_address);
        if (BigInt(allowance) < cost) {
          this.stateService.showToast(`Vui lòng phê duyệt (Approve) chi tiêu ${formattedCost} ${round.paymentTokenSymbol}...`, 'warning');
          const approveTx = await tokenContract['approve'](company.funding_address, cost, gasOverrides);
          await approveTx.wait();
          this.stateService.showToast('Đã phê duyệt thành công!', 'warning');
        }

        this.stateService.showToast(`Đang gửi giao dịch mua cổ phần (${formattedCost} ${round.paymentTokenSymbol})...`, 'warning');
        const tx = await funding['buyShares'](round.id, tokenAmount, { ...gasOverrides, value: 0 });
        await tx.wait();
      } else {
        // Hỗ trợ thanh toán bằng BNB
        const formattedCost = ethers.formatEther(cost);
        this.stateService.showToast(`Chi phí cần thanh toán: ${formattedCost} BNB. Đang gửi giao dịch...`, 'warning');
        const tx = await funding['buyShares'](round.id, tokenAmount, { ...gasOverrides, value: cost });
        await tx.wait();
      }

      this.stateService.showToast(`Mua thành công ${this.buyAmount()} cổ phần!`, 'success');
      await this.loadOnChainData(company);
    } catch (e: any) {
      this.stateService.showToast(e.reason || e.message || 'Giao dịch thất bại!', 'error');
    } finally {
      this.buyLoading.set(false);
    }
  }

  // Đặt lệnh mua/bán trên Marketplace
  async handlePlaceOrder() {
    const company = this.selectedCompany();
    if (!company || !this.isConnected()) return;

    this.orderLoading.set(true);
    try {
      const signer = await this.stateService.web3Service.getSigner();
      const market = new ethers.Contract(company.marketplace_address, MARKETPLACE_ABI, signer);
      const priceWei = ethers.parseEther(this.orderPrice());
      const gasOverrides = await this.stateService.web3Service.getGasOverrides();
      const isBuy = this.orderSide() === 'BUY';

      const tx = await market['placeOrder'](isBuy, priceWei, this.orderAmount(), gasOverrides);
      await tx.wait();
      this.stateService.showToast('Đặt lệnh thành công!', 'success');
      await this.loadOrderBook(company);
    } catch (e: any) {
      this.stateService.showToast(e.reason || 'Đặt lệnh thất bại!', 'error');
    } finally {
      this.orderLoading.set(false);
    }
  }

  // Nhận cổ tức
  async handleClaimDividend() {
    const company = this.selectedCompany();
    if (!company || !this.isConnected()) return;

    this.dividendLoading.set(true);
    try {
      const signer = await this.stateService.web3Service.getSigner();
      const dist = new ethers.Contract(company.funding_address, DISTRIBUTION_MANAGER_ABI, signer);
      const gasOverrides = await this.stateService.web3Service.getGasOverrides();

      const tx = await dist['claimDividend'](gasOverrides);
      await tx.wait();
      this.stateService.showToast('Đã nhận cổ tức thành công!', 'success');
      this.claimableDiv.set('0');
    } catch (e: any) {
      this.stateService.showToast(e.reason || 'Nhận cổ tức thất bại!', 'error');
    } finally {
      this.dividendLoading.set(false);
    }
  }

  // Progress bar phần trăm đã gọi vốn
  fundingProgress(): number {
    const r = this.activeFundingRound();
    if (!r || +r.maxSupply === 0) return 0;
    return Math.min(100, (+r.soldAmount / +r.maxSupply) * 100);
  }

  // Format số lớn
  formatNumber(n: string | number): string {
    return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 4 });
  }
}
