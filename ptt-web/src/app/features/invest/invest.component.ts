import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { firstValueFrom } from 'rxjs';
import { ethers } from 'ethers';

import { TabGroupComponent, TabOption } from '@shared/components/tab-group/tab-group.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { IconComponent } from '@shared/components/icon/icon.component';

// Minimal ABIs — chỉ những function cần thiết cho investor
const EQUITY_TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function getPastBalanceOf(address account, uint256 blockNumber) view returns (uint256)',
  'function getPastTotalSupply(uint256 blockNumber) view returns (uint256)'
];

// ABI khớp chính xác với FinanceManager contract
const FUNDING_MANAGER_ABI = [
  'function roundCount() view returns (uint256)',
  'function rounds(uint256 roundId) view returns (tuple(uint256 id, string name, address shareToken, address paymentToken, address treasury, uint256 price, uint256 maxSupply, uint256 soldAmount, uint256 startTime, uint256 endTime, uint256 minPurchase, uint256 maxPurchase, bool isWhitelistOnly, bool active))',
  'function buyShares(uint256 roundId, uint256 tokenAmount) external payable',
  
  // Hàm cổ tức bổ sung
  'function dividendCount() view returns (uint256)',
  'function dividends(uint256 dividendId) view returns (tuple(uint256 id, string name, address shareToken, address dividendToken, uint256 totalAmount, uint256 claimedAmount, uint256 checkpointBlock, uint256 startTime, uint256 endTime, bool active))',
  'function hasClaimed(uint256 dividendId, address account) view returns (bool)'
];

// ABI rút gọn của ERC20 để xử lý phê duyệt (approve)
const ERC20_ABI = [
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)"
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Tabs
  public activeTab = signal<'funding' | 'trade' | 'dividends' | 'portfolio'>('funding');
  public tabOptions = [
    { value: 'funding', label: 'Mua cổ phần', icon: 'pos' },
    { value: 'trade', label: 'Giao dịch P2P', icon: 'blockchain' },
    { value: 'dividends', label: 'Cổ tức', icon: 'financials' },
    { value: 'portfolio', label: 'Portfolio', icon: 'staffs' }
  ];

  public orderSideOptions: TabOption[] = [
    { value: 'BUY', label: 'MUA' },
    { value: 'SELL', label: 'BÁN' }
  ];

  // Dữ liệu công ty (từ Public API, không cần auth)
  public companiesList = signal<any[]>([]);
  public selectedCompany = signal<any | null>(null);

  // On-chain data
  public myBalance = signal<string>('0');         // EquityToken balance
  public totalSupply = signal<string>('0');        // Tổng cung
  public claimableDiv = signal<string>('0');       // Cổ tức có thể claim
  public dividendTokenSymbol = signal<string>('USDT'); // Symbol token cổ tức
  public myPaymentTokenBalance = signal<string>('0'); // Số dư ví dùng thanh toán (USDT/BNB)
  public myPaymentTokenSymbol = signal<string>('BNB');

  // Cấu hình các payment tokens được hỗ trợ cho P2P
  public supportedPaymentTokens = [
    { symbol: 'USDT', address: '0x337610d27c682E347C9cD60BD4b3b107c913E45f', decimals: 18 },
    { symbol: 'USDC', address: '0x645421226040516109Ed565B1b4a6ECd3159a2D5', decimals: 18 },
    { symbol: 'LINK', address: '0x84b9B910527Ad5C03A9Ca831909EE2157D0b7b72', decimals: 18 }
  ];
  public selectedPaymentToken = signal<any>(this.supportedPaymentTokens[0]);

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

  // Trạng thái tải trang
  public isPageLoading = signal(true);

  // Computed: đã kết nối ví chưa
  public isConnected = computed(() => this.stateService.isConnected());
  public walletAddress = computed(() => this.stateService.address());

  // Tìm kiếm công ty
  public searchTerm = signal<string>('');
  public filteredCompanies = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.companiesList();
    return this.companiesList().filter(
      co => co.name?.toLowerCase().includes(term) || co.code?.toLowerCase().includes(term)
    );
  });

  // Tính chi phí mua động để hiển thị lên nút bấm mua cổ phần
  public purchaseCostText = computed(() => {
    const round = this.activeFundingRound();
    if (!round) return '0 BNB';
    const amount = this.buyAmount();
    const total = Number(round.price) * amount;
    return `${this.formatNumber(total)} ${round.paymentTokenSymbol}`;
  });

  public setActiveTab(tab: string) {
    this.activeTab.set(tab as 'funding' | 'trade' | 'dividends' | 'portfolio');
    if (tab === 'trade') {
      this.loadPaymentTokenBalance();
    }
  }

  public setOrderSide(side: string) {
    this.orderSide.set(side as 'BUY' | 'SELL');
  }

  public changePaymentToken(token: any) {
    this.selectedPaymentToken.set(token);
    this.loadOrderBook(this.selectedCompany());
    this.loadPaymentTokenBalance();
  }

  async loadPaymentTokenBalance() {
    const userAddress = this.walletAddress();
    const token = this.selectedPaymentToken();
    if (!userAddress || !token) {
      if (!this.activeFundingRound()) {
        this.myPaymentTokenBalance.set('0');
      }
      return;
    }
    // Chỉ tự cập nhật số dư cho P2P khi tab hiện tại là tab Trade
    if (this.activeTab() !== 'trade') return;

    try {
      const provider = new ethers.JsonRpcProvider('https://bsc-testnet-rpc.publicnode.com');
      const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const bal = await tokenContract['balanceOf'](userAddress);
      this.myPaymentTokenBalance.set(ethers.formatUnits(bal, token.decimals));
      this.myPaymentTokenSymbol.set(token.symbol);
    } catch (e) {
      console.warn('Lỗi load số dư P2P token:', e);
    }
  }

  async ngOnInit() {
    try {
      await this.loadCompanies();
      
      // Tự động kiểm tra query parameter để chọn công ty chia sẻ
      this.route.queryParams.subscribe(async (params) => {
        const coId = params['companyId'];
        const coCode = params['companyCode'];
        const current = this.selectedCompany();

        if (coId) {
          if (current && current.id === Number(coId)) return;
          const co = this.companiesList().find(c => c.id === Number(coId));
          if (co) await this.selectCompany(co);
        } else if (coCode) {
          if (current && current.code?.toLowerCase() === coCode.toLowerCase()) return;
          const co = this.companiesList().find(c => c.code?.toLowerCase() === coCode.toLowerCase());
          if (co) await this.selectCompany(co);
        } else if (this.companiesList().length > 0) {
          if (current && current.id === this.companiesList()[0].id) return;
          await this.selectCompany(this.companiesList()[0]);
        } else {
          this.isPageLoading.set(false);
        }
      });
    } catch (e) {
      console.error(e);
      this.isPageLoading.set(false);
    }
  }

  // Load danh sách công ty (public API, không cần auth)
  async loadCompanies() {
    const res = await firstValueFrom(this.apiService.get<any[]>('companies'));
    this.companiesList.set(res || []);
  }

  // Chia sẻ liên kết của công ty
  handleShareLink(co: any) {
    if (!co) return;
    const shareUrl = `${window.location.origin}/invest?companyCode=${encodeURIComponent(co.code)}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      this.stateService.showToast(`Đã sao chép liên kết chia sẻ của công ty ${co.name}!`, 'success');
    }).catch(err => {
      this.stateService.showToast('Không thể sao chép liên kết chia sẻ!', 'error');
    });
  }

  async selectCompany(company: any) {
    const current = this.selectedCompany();
    if (current && current.id === company.id) {
      return; // Tránh lặp vô hạn và gọi API trùng lặp
    }

    this.selectedCompany.set(company);
    this.isPageLoading.set(true);
    
    // Cập nhật thanh địa chỉ URL trình duyệt tự động
    this.router.navigate([], {
      queryParams: { companyId: company.id },
      queryParamsHandling: 'merge'
    });

    try {
      await Promise.all([
        this.loadOnChainData(company),
        this.loadOrderBook(company)
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      this.isPageLoading.set(false);
    }
  }

  // Đọc data trực tiếp từ Smart Contracts (không phụ thuộc vào mạng lưới ví đang chọn)
  async loadOnChainData(company: any) {
    try {
      // Sử dụng Public RPC của BSC Testnet ổn định (không bị chặn bởi extension/client)
      const provider = new ethers.JsonRpcProvider('https://bsc-testnet-rpc.publicnode.com');

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

      // Claimable dividend - tính toán động on-chain chính xác dựa trên snapshot checkpoints
      if (company.funding_address && this.walletAddress() && company.token_address) {
        try {
          const funding = new ethers.Contract(company.funding_address, FUNDING_MANAGER_ABI, provider);
          const shareToken = new ethers.Contract(company.token_address, EQUITY_TOKEN_ABI, provider);
          
          const divCount = Number(await funding['dividendCount']());
          let totalClaimable = 0n;
          let currentDivTokenSymbol = this.myPaymentTokenSymbol(); // Mặc định theo symbol của payment token

          for (let i = 1; i <= divCount; i++) {
            const hasClaimed = await funding['hasClaimed'](i, this.walletAddress());
            if (!hasClaimed) {
              const divRound = await funding['dividends'](i);
              if (divRound.active) {
                const nowSec = Math.floor(Date.now() / 1000);
                if (nowSec >= Number(divRound.startTime) && nowSec <= Number(divRound.endTime)) {
                  // Đọc symbol của token cổ tức nếu là ERC20
                  if (divRound.dividendToken !== ethers.ZeroAddress) {
                    try {
                      const tokenContract = new ethers.Contract(divRound.dividendToken, ERC20_ABI, provider);
                      currentDivTokenSymbol = await tokenContract['symbol']();
                    } catch (tokErr) {
                      currentDivTokenSymbol = 'USDT';
                    }
                  } else {
                    currentDivTokenSymbol = 'BNB';
                  }

                  try {
                    const blockNumber = Number(divRound.checkpointBlock);
                    const userBalance = await shareToken['getPastBalanceOf'](this.walletAddress(), blockNumber);
                    if (userBalance > 0n) {
                      const totalShares = await shareToken['getPastTotalSupply'](blockNumber);
                      if (totalShares > 0n) {
                        const claimAmt = (userBalance * BigInt(divRound.totalAmount)) / totalShares;
                        totalClaimable += claimAmt;
                      }
                    }
                  } catch (blockErr) {
                    console.warn(`Lỗi tính toán cho đợt cổ tức #${i}:`, blockErr);
                  }
                }
              }
            }
          }
          this.claimableDiv.set(ethers.formatEther(totalClaimable));
          this.dividendTokenSymbol.set(currentDivTokenSymbol);
        } catch (divErr) {
          console.warn('Lỗi khi tính toán tổng cổ tức claimable:', divErr);
          this.claimableDiv.set('0.0000');
          this.dividendTokenSymbol.set('USDT');
        }
      }

      // Active funding round — contract dùng roundCount() + rounds(id), không có activeRoundId()
      if (company.funding_address) {
        const funding = new ethers.Contract(company.funding_address, FUNDING_MANAGER_ABI, provider);
        try {
          const count = Number(await funding['roundCount']());
          let found = null;
          let defaultTokenSymbol = 'BNB';
          let defaultTokenDecimals = 18;
          let defaultTokenAddress = ethers.ZeroAddress;

          // 1. Quét tìm cấu hình của round gần nhất để lấy payment token mặc định của doanh nghiệp
          if (count > 0) {
            try {
              const lastRound = await funding['rounds'](count);
              const isERC20 = lastRound.paymentToken !== ethers.ZeroAddress;
              if (isERC20) {
                const tokenContract = new ethers.Contract(lastRound.paymentToken, ERC20_ABI, provider);
                const [sym, dec] = await Promise.all([
                  tokenContract['symbol'](),
                  tokenContract['decimals']()
                ]);
                defaultTokenSymbol = sym;
                defaultTokenDecimals = Number(dec);
                defaultTokenAddress = lastRound.paymentToken;
              } else {
                defaultTokenSymbol = 'BNB';
                defaultTokenDecimals = 18;
                defaultTokenAddress = ethers.ZeroAddress;
              }
            } catch (lastRoundErr) {
              console.warn('Lỗi đọc round gần nhất:', lastRoundErr);
            }
          }

          // 2. Tìm round mới nhất có active = true
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
                pricePerShare: ethers.formatUnits(r.price, tokenDecimals),
                maxSupply: ethers.formatEther(r.maxSupply),
                soldAmount: ethers.formatEther(r.soldAmount),
                isWhitelistOnly: r.isWhitelistOnly,
                active: r.active,
                isActive: r.active,
                startTime: Number(r.startTime),
                endTime: Number(r.endTime)
              };
              
              const userAddress = this.walletAddress();
              if (userAddress) {
                try {
                  if (isERC20) {
                    const tokenContract = new ethers.Contract(r.paymentToken, ERC20_ABI, provider);
                    const bal = await tokenContract['balanceOf'](userAddress);
                    this.myPaymentTokenBalance.set(ethers.formatUnits(bal, tokenDecimals));
                  } else {
                    const bal = await provider.getBalance(userAddress);
                    this.myPaymentTokenBalance.set(ethers.formatEther(bal));
                  }
                  this.myPaymentTokenSymbol.set(tokenSymbol);
                } catch (balErr) {
                  console.warn('Lỗi đọc số dư payment token:', balErr);
                  this.myPaymentTokenBalance.set('0');
                }
              } else {
                this.myPaymentTokenBalance.set('0');
              }

              break;
            }
          }

          if (!found) {
            this.activeFundingRound.set(null);
            this.myPaymentTokenSymbol.set(defaultTokenSymbol);
            
            const userAddress = this.walletAddress();
            if (userAddress) {
              try {
                if (defaultTokenAddress !== ethers.ZeroAddress) {
                  const tokenContract = new ethers.Contract(defaultTokenAddress, ERC20_ABI, provider);
                  const bal = await tokenContract['balanceOf'](userAddress);
                  this.myPaymentTokenBalance.set(ethers.formatUnits(bal, defaultTokenDecimals));
                } else {
                  const bal = await provider.getBalance(userAddress);
                  this.myPaymentTokenBalance.set(ethers.formatEther(bal));
                }
              } catch (balErr) {
                this.myPaymentTokenBalance.set('0');
              }
            } else {
              this.myPaymentTokenBalance.set('0');
            }
          } else {
            this.activeFundingRound.set(found);
          }
        } catch (err) {
          console.warn('Lỗi đọc funding round:', err);
          this.activeFundingRound.set(null);
          this.myPaymentTokenBalance.set('0');
        }
      }
    } catch (e) {
      console.error('On-chain read error:', e);
    }

    // Luôn tải số dư payment token cho P2P nếu đang ở tab Trade
    await this.loadPaymentTokenBalance();
  }

  // Load order book từ public API
  async loadOrderBook(company: any) {
    if (!company) return;
    try {
      const data = await firstValueFrom(
        this.apiService.get<any>('marketplace/orderbook', undefined, {
          company_id: company.id,
          payment_token_address: this.selectedPaymentToken().address
        })
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
      const funding = new ethers.Contract(company.funding_address, FUNDING_MANAGER_ABI, signer);
      const tokenAmount = ethers.parseEther(String(this.buyAmount()));
      const pricePerToken = ethers.parseUnits(round.price, round.paymentTokenDecimals);
      const cost = (tokenAmount * pricePerToken) / ethers.parseEther('1');
      const gasOverrides = await this.stateService.web3Service.getGasOverrides();

      const isERC20 = round.paymentToken !== ethers.ZeroAddress;

      if (isERC20) {
        const tokenContract = new ethers.Contract(round.paymentToken, ERC20_ABI, signer);
        const formattedCost = ethers.formatUnits(cost, round.paymentTokenDecimals);
        
        this.stateService.showToast(`Kiểm tra quyền sử dụng ${round.paymentTokenSymbol}...`, 'warning');
        const allowance = await tokenContract['allowance'](this.walletAddress(), company.funding_address);
        if (allowance < cost) {
          this.stateService.showToast(`Vui lòng phê duyệt (Approve) chi tiêu ${formattedCost} ${round.paymentTokenSymbol}...`, 'warning');
          const appTx = await tokenContract['approve'](company.funding_address, cost, gasOverrides);
          await appTx.wait();
        }

        this.stateService.showToast(`Đang gửi giao dịch mua cổ phần (${formattedCost} ${round.paymentTokenSymbol})...`, 'warning');
        const tx = await funding['buyShares'](round.id, tokenAmount, gasOverrides);
        await tx.wait();
      } else {
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

  // Đặt lệnh mua/bán trên Marketplace (ký off-chain và gửi backend)
  async handlePlaceOrder() {
    const company = this.selectedCompany();
    if (!company || !this.isConnected()) return;

    this.orderLoading.set(true);
    try {
      const price = parseFloat(this.orderPrice());
      const amount = this.orderAmount();
      const token = this.selectedPaymentToken();

      if (!price || !amount) {
        this.stateService.showToast('Vui lòng nhập đầy đủ giá và số lượng', 'warning');
        return;
      }

      // 1. Tạo thông điệp EIP-712 / personal_sign đặt lệnh
      const message = `Place ${this.orderSide()} Order for ${company.name}\nPrice: ${price} ${token.symbol}\nAmount: ${amount} Shares\nPayment Token: ${token.address}`;

      // 2. Ký ví
      const signer = await this.stateService.web3Service.getSigner();
      const signature = await signer.signMessage(message);

      // 3. Gửi lên Backend để xếp hàng và chạy Matcher Engine
      await firstValueFrom(this.apiService.post<any>('marketplace/orders', {
        side: this.orderSide(),
        price: price,
        amount: amount,
        signature: signature,
        message: message,
        payment_token_address: token.address,
        payment_token_symbol: token.symbol
      }, company.id));

      this.stateService.showToast('Đặt lệnh thành công! Hệ thống đang tự động khớp lệnh...', 'success');
      this.orderPrice.set('');
      this.orderAmount.set(1);
      await this.loadOrderBook(company);
      await this.loadPaymentTokenBalance();
    } catch (e: any) {
      this.stateService.showToast(e.reason || 'Đặt lệnh thất bại!', 'error');
    } finally {
      this.orderLoading.set(false);
    }
  }

  // Nhận cổ tức (tự động nhận toàn bộ các đợt cổ tức chưa nhận)
  async handleClaimDividend() {
    const company = this.selectedCompany();
    if (!company || !this.isConnected()) return;

    this.dividendLoading.set(true);
    try {
      const signer = await this.stateService.web3Service.getSigner();
      const funding = new ethers.Contract(company.funding_address, FUNDING_MANAGER_ABI, signer);
      const gasOverrides = await this.stateService.web3Service.getGasOverrides();
      
      const divCount = Number(await funding['dividendCount']());
      let claimCount = 0;

      for (let i = 1; i <= divCount; i++) {
        const claimed = await funding['hasClaimed'](i, this.walletAddress());
        if (!claimed) {
          const divRound = await funding['dividends'](i);
          if (divRound.active) {
            this.stateService.showToast(`Đang rút cổ tức đợt #${i} (${divRound.name})...`, 'warning');
            const tx = await funding['claimDividend'](i, gasOverrides);
            await tx.wait();
            claimCount++;
          }
        }
      }

      if (claimCount > 0) {
        this.stateService.showToast(`Đã nhận thành công cổ tức từ ${claimCount} đợt!`, 'success');
      } else {
        this.stateService.showToast('Không có cổ tức khả dụng để nhận hoặc đã nhận hết!', 'warning');
      }
      this.claimableDiv.set('0.0000');
      await this.loadOnChainData(company);
    } catch (e: any) {
      this.stateService.showToast(e.reason || e.message || 'Nhận cổ tức thất bại!', 'error');
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
