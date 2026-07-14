import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ModalService } from '@core/services/modal.service';
import { firstValueFrom } from 'rxjs';
import { ethers } from 'ethers';
import { environment } from '@environments/environment';

import { TabGroupComponent, TabOption } from '@shared/components/tab-group/tab-group.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CustomSelectComponent } from '@shared/components/custom-select/custom-select.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';

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
  'function hasClaimed(uint256 dividendId, address account) view returns (bool)',
  'function claimDividend(uint256 dividendId) external'
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
  imports: [CommonModule, FormsModule, TabGroupComponent, ButtonComponent, IconComponent, CustomSelectComponent, PaginationComponent],
  templateUrl: './invest.component.html'
})
export class InvestComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private modalService = inject(ModalService);

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

  // Dữ liệu công ty (tái sử dụng từ StateService để tránh gọi API trùng lặp)
  public companiesList = this.stateService.companiesList;
  public selectedCompany = this.stateService.currentCompany;

  // Cache metadata ERC20 token để tránh fetch RPC lặp lại
  private tokenMetadataCache = new Map<string, { symbol: string; decimals: number }>();

  // On-chain data
  public myBalance = signal<string>('0');         // EquityToken balance
  public totalSupply = signal<string>('0');        // Tổng cung
  public myPaymentTokenBalance = signal<string>('0'); // Số dư ví dùng thanh toán (USDT/BNB)
  public myPaymentTokenSymbol = signal<string>('BNB');

  // Cổ tức (Dividends)
  public allDividendsList = signal<any[]>([]);
  public divCurrentPage = signal<number>(1);
  public divItemsPerPage = 5;

  public paginatedDividends = computed(() => {
    const list = this.allDividendsList();
    const page = this.divCurrentPage();
    const limit = this.divItemsPerPage;
    const startIndex = (page - 1) * limit;
    return list.slice(startIndex, startIndex + limit);
  });

  public divTotalPages = computed(() => {
    return Math.ceil(this.allDividendsList().length / this.divItemsPerPage) || 1;
  });

  public divTotalItems = computed(() => {
    return this.allDividendsList().length;
  });

  // Nhóm cổ tức chưa nhận theo token để làm summary ở overview card
  public claimableDividendsSummary = computed(() => {
    const list = this.allDividendsList();
    const summaryMap = new Map<string, number>();

    for (const d of list) {
      if (!d.isClaimed && Number(d.claimableAmount) > 0) {
        const currentVal = summaryMap.get(d.dividendTokenSymbol) || 0;
        summaryMap.set(d.dividendTokenSymbol, currentVal + Number(d.claimableAmount));
      }
    }

    const result: { symbol: string; amount: number }[] = [];
    summaryMap.forEach((amount, symbol) => {
      result.push({ symbol, amount });
    });
    return result;
  });

  // Chuỗi text hiển thị cổ tức chưa nhận tổng hợp
  public claimableDivText = computed(() => {
    const summary = this.claimableDividendsSummary();
    if (summary.length === 0) {
      return '0 USDT';
    }
    return summary
      .map(item => `${this.formatNumber(item.amount)} ${item.symbol}`)
      .join(' + ');
  });

  public hasClaimableDividends = computed(() => {
    return this.claimableDividendsSummary().length > 0;
  });

  // Giữ lại các signal cũ dưới dạng computed để tránh compile error ở các file khác nếu có tham chiếu
  public claimableDiv = computed(() => {
    const summary = this.claimableDividendsSummary();
    if (summary.length === 0) return '0.0000';
    return String(summary[0].amount);
  });

  public dividendTokenSymbol = computed(() => {
    const summary = this.claimableDividendsSummary();
    if (summary.length === 0) return 'USDT';
    return summary[0].symbol;
  });

  public contractDivBalance = computed(() => {
    const list = this.allDividendsList();
    const pending = list.find(d => !d.isClaimed && Number(d.claimableAmount) > 0);
    return pending ? pending.contractBalance : '0';
  });

  // Cấu hình các payment tokens được hỗ trợ cho P2P
  public supportedPaymentTokens = [
    { symbol: 'USDT', address: '0xa0f2AfaACe4cB692Ea9FF666d2eF7AB054a35407', decimals: 18 },
    // { symbol: 'USDC', address: '0x645421226040516109Ed565B1b4a6ECd3159a2D5', decimals: 18 },
    // { symbol: 'LINK', address: '0x84b9B910527Ad5C03A9Ca831909EE2157D0b7b72', decimals: 18 }
  ];
  public selectedPaymentToken = signal<any>(this.supportedPaymentTokens[0]);

  public myOrders = computed(() => {
    const address = this.stateService.address()?.toLowerCase();
    if (!address) return [];

    const buy = (this.orderBook().bids || []).filter((o: any) => o.user_address?.toLowerCase() === address);
    const sell = (this.orderBook().asks || []).filter((o: any) => o.user_address?.toLowerCase() === address);

    return [...buy, ...sell].sort((a: any, b: any) => b.id - a.id);
  });

  // Funding round
  public activeFundingRound = signal<any | null>(null);
  public activeFundingRoundsList = signal<any[]>([]);
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

  constructor() {
    effect(async () => {
      const company = this.selectedCompany();
      const address = this.walletAddress(); // Lắng nghe sự thay đổi ví để tải lại data tương ứng
      if (company) {
        this.isPageLoading.set(true);
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
    }, { allowSignalWrites: true });
  }

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

  private getRpcUrl(company: any): string {
    if (!company || !company.chain_id) {
      return environment.defaultRpcUrl;
    }
    const chain = this.stateService.POPULAR_CHAINS.find(c => Number(c.chainId) === Number(company.chain_id));
    return chain ? chain.rpcUrl : environment.defaultRpcUrl;
  }

  private async getTokenMetadata(tokenAddress: string, provider: ethers.Provider): Promise<{ symbol: string; decimals: number }> {
    const addressKey = tokenAddress.toLowerCase();
    if (this.tokenMetadataCache.has(addressKey)) {
      return this.tokenMetadataCache.get(addressKey)!;
    }
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const [sym, dec] = await Promise.all([
        tokenContract['symbol'](),
        tokenContract['decimals']()
      ]);
      const metadata = { symbol: String(sym), decimals: Number(dec) };
      this.tokenMetadataCache.set(addressKey, metadata);
      return metadata;
    } catch (err) {
      console.warn(`Lỗi fetch metadata token ${tokenAddress}:`, err);
      return { symbol: 'USDT', decimals: 18 };
    }
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
      const rpcUrl = this.getRpcUrl(this.selectedCompany());
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 100 });
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
      // Tự động kiểm tra query parameter để chọn công ty chia sẻ
      this.route.queryParams.subscribe(async (params) => {
        const coId = params['companyId'];
        const coCode = params['companyCode'];
        const current = this.stateService.currentCompany();

        if (coId) {
          if (current && current.id === Number(coId)) {
            this.isPageLoading.set(false);
            return;
          }
          const co = this.companiesList().find(c => c.id === Number(coId));
          if (co) await this.selectCompany(co);
        } else if (coCode) {
          if (current && current.code?.toLowerCase() === coCode.toLowerCase()) {
            this.isPageLoading.set(false);
            return;
          }
          const co = this.companiesList().find(c => c.code?.toLowerCase() === coCode.toLowerCase());
          if (co) await this.selectCompany(co);
        } else if (current) {
          // Nếu URL chưa có, nhưng đã có current từ StateService (lấy từ localStorage)
          this.router.navigate([], {
            queryParams: { companyId: current.id },
            queryParamsHandling: 'merge'
          });
          this.isPageLoading.set(false);
        } else if (this.companiesList().length > 0) {
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
    const current = this.stateService.currentCompany();
    if (current && current.id === company.id) {
      return; // Tránh lặp vô hạn và gọi API trùng lặp
    }

    this.isPageLoading.set(true);
    await this.stateService.selectCompany(company);

    // Cập nhật thanh địa chỉ URL trình duyệt tự động
    this.router.navigate([], {
      queryParams: { companyId: company.id },
      queryParamsHandling: 'merge'
    });
  }

  // Đọc data trực tiếp từ Smart Contracts (không phụ thuộc vào mạng lưới ví đang chọn)
  async loadOnChainData(company: any) {
    try {
      const rpcUrl = this.getRpcUrl(company);
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 100 });
      const userAddress = this.walletAddress();
      const promises: Promise<any>[] = [];

      // 1. Tải EquityToken balance + total supply
      let loadEquityTokenPromise = Promise.resolve();
      if (company.token_address && company.token_address !== '—') {
        const token = new ethers.Contract(company.token_address, EQUITY_TOKEN_ABI, provider);
        const supplyPromise = token['totalSupply']();
        const decimalsPromise = token['decimals']();
        const balancePromise = userAddress ? token['balanceOf'](userAddress) : Promise.resolve(0n);

        loadEquityTokenPromise = Promise.all([supplyPromise, decimalsPromise, balancePromise]).then(([supply, decimals, balance]) => {
          this.totalSupply.set(ethers.formatUnits(supply, decimals));
          if (userAddress) {
            this.myBalance.set(ethers.formatUnits(balance, decimals));
          }
        });
        promises.push(loadEquityTokenPromise);
      }

      // 2. Tải Dividend & Claimable thông tin chi tiết (Quét toàn bộ đợt)
      let loadDividendPromise = Promise.resolve();
      if (company.funding_address && company.token_address) {
        const funding = new ethers.Contract(company.funding_address, FUNDING_MANAGER_ABI, provider);
        
        loadDividendPromise = funding['dividendCount']().then(async (divCountVal: any) => {
          const divCount = Number(divCountVal);
          if (divCount === 0) {
            this.allDividendsList.set([]);
            return;
          }

          const roundIds = Array.from({ length: divCount }, (_, i) => i + 1);
          
          // Tải dữ liệu thô của các đợt và trạng thái đã claim song song
          const [rawDividends, claimStatuses] = await Promise.all([
            Promise.all(roundIds.map(id => funding['dividends'](id))),
            userAddress 
              ? Promise.all(roundIds.map(id => funding['hasClaimed'](id, userAddress)))
              : Promise.resolve(Array(divCount).fill(false))
          ]);

          // Tải thông tin metadata token của từng đợt
          const tokenMetaPromises = rawDividends.map(d => {
            if (d.dividendToken !== ethers.ZeroAddress) {
              return this.getTokenMetadata(d.dividendToken, provider);
            }
            return Promise.resolve({ symbol: this.stateService.currentCompanyNativeSymbol() || 'BNB', decimals: 18 });
          });
          const tokenMetadatas = await Promise.all(tokenMetaPromises);

          // Tải checkpoint balance & supply cho từng đợt
          const shareToken = new ethers.Contract(company.token_address, EQUITY_TOKEN_ABI, provider);
          const checkpointPromises = rawDividends.map(d => {
            const blockNum = Number(d.checkpointBlock);
            const userBalPromise = userAddress ? shareToken['getPastBalanceOf'](userAddress, blockNum) : Promise.resolve(0n);
            const supplyPromise = shareToken['getPastTotalSupply'](blockNum);
            return Promise.all([userBalPromise, supplyPromise]);
          });
          const checkpointData = await Promise.all(checkpointPromises);

          // Tải số dư contract tương ứng cho từng loại token để check xem contract đủ tiền chi trả không
          const uniqueTokens = Array.from(new Set(rawDividends.map(d => d.dividendToken.toLowerCase())));
          const contractBalancesMap = new Map<string, bigint>();

          await Promise.all(uniqueTokens.map(async (tokAddr) => {
            let bal = 0n;
            try {
              if (tokAddr !== ethers.ZeroAddress.toLowerCase()) {
                const tokenContract = new ethers.Contract(tokAddr, ERC20_ABI, provider);
                bal = await tokenContract['balanceOf'](company.funding_address);
              } else {
                bal = await provider.getBalance(company.funding_address);
              }
            } catch (err) {
              console.warn(`Lỗi lấy số dư contract cho token ${tokAddr}:`, err);
            }
            contractBalancesMap.set(tokAddr, bal);
          }));

          // Xử lý và format dữ liệu chi tiết cho từng đợt
          const dividendsList: any[] = [];
          for (let i = 0; i < divCount; i++) {
            const d = rawDividends[i];
            const isClaimed = claimStatuses[i];
            const meta = tokenMetadatas[i];
            const [userBal, totalSupplyVal] = checkpointData[i];
            const contractBal = contractBalancesMap.get(d.dividendToken.toLowerCase()) || 0n;

            let claimableAmt = 0n;
            if (!isClaimed && userBal > 0n && totalSupplyVal > 0n) {
              claimableAmt = (userBal * BigInt(d.totalAmount)) / totalSupplyVal;
            }

            const claimableAmountFormatted = ethers.formatUnits(claimableAmt, meta.decimals);
            const contractBalanceFormatted = ethers.formatUnits(contractBal, meta.decimals);
            
            dividendsList.push({
              id: Number(d.id),
              name: d.name,
              dividendToken: d.dividendToken,
              dividendTokenSymbol: meta.symbol,
              dividendTokenDecimals: meta.decimals,
              totalAmount: ethers.formatUnits(d.totalAmount, meta.decimals),
              claimedAmount: ethers.formatUnits(d.claimedAmount, meta.decimals),
              checkpointBlock: Number(d.checkpointBlock),
              startTime: Number(d.startTime),
              endTime: Number(d.endTime),
              active: d.active,
              isClaimed,
              userBalanceAtCheckpoint: ethers.formatEther(userBal),
              totalSupplyAtCheckpoint: ethers.formatEther(totalSupplyVal),
              claimableAmount: claimableAmountFormatted,
              contractBalance: contractBalanceFormatted,
              hasInsufficientBalance: !isClaimed && Number(claimableAmountFormatted) > Number(contractBalanceFormatted)
            });
          }

          // Sắp xếp ID lớn nhất (mới nhất) lên đầu
          dividendsList.sort((a, b) => b.id - a.id);
          this.allDividendsList.set(dividendsList);
        }).catch(divErr => {
          console.warn('Lỗi khi tải thông tin danh sách cổ tức:', divErr);
          this.allDividendsList.set([]);
        });
        promises.push(loadDividendPromise);
      }

      // 3. Tải Active funding rounds
      let loadFundingRoundPromise = Promise.resolve();
      if (company.funding_address) {
        const funding = new ethers.Contract(company.funding_address, FUNDING_MANAGER_ABI, provider);
        loadFundingRoundPromise = funding['roundCount']().then(async (countVal: any) => {
          const count = Number(countVal);
          if (count === 0) {
            this.activeFundingRound.set(null);
            this.myPaymentTokenSymbol.set('BNB');
            this.myPaymentTokenBalance.set('0');
            return;
          }

          // Lấy tất cả các rounds song song
          const roundIds = Array.from({ length: count }, (_, i) => i + 1);
          const rawRounds = await Promise.all(roundIds.map(id => funding['rounds'](id)));

          // Lấy last round metadata (để fallback payment token mặc định)
          const lastRound = rawRounds[count - 1];
          const lastRoundIsERC20 = lastRound.paymentToken !== ethers.ZeroAddress;
          const defaultTokenMeta = lastRoundIsERC20 
            ? await this.getTokenMetadata(lastRound.paymentToken, provider)
            : { symbol: 'BNB', decimals: 18 };

          const roundsList: any[] = [];
          const activeRounds = rawRounds.filter(r => r.active);

          // Load payment token metadata cho tất cả active rounds song song
          const paymentTokenMetadatas = await Promise.all(
            activeRounds.map(r => {
              if (r.paymentToken !== ethers.ZeroAddress) {
                return this.getTokenMetadata(r.paymentToken, provider);
              }
              return Promise.resolve({ symbol: 'BNB', decimals: 18 });
            })
          );

          for (let i = 0; i < activeRounds.length; i++) {
            const r = activeRounds[i];
            const meta = paymentTokenMetadatas[i];
            roundsList.push({
              id: Number(r.id),
              name: r.name,
              paymentToken: r.paymentToken,
              paymentTokenSymbol: meta.symbol,
              paymentTokenDecimals: meta.decimals,
              price: ethers.formatUnits(r.price, meta.decimals),
              pricePerShare: ethers.formatUnits(r.price, meta.decimals),
              maxSupply: ethers.formatEther(r.maxSupply),
              soldAmount: ethers.formatEther(r.soldAmount),
              isWhitelistOnly: r.isWhitelistOnly,
              active: r.active,
              isActive: r.active,
              startTime: Number(r.startTime),
              endTime: Number(r.endTime)
            });
          }

          // Sắp xếp ID từ lớn đến bé
          roundsList.sort((a, b) => b.id - a.id);
          this.activeFundingRoundsList.set(roundsList);

          if (roundsList.length > 0) {
            const currentSelected = this.activeFundingRound();
            const stillActive = currentSelected ? roundsList.find(r => r.id === currentSelected.id) : null;
            const targetRound = stillActive || roundsList[0];
            
            this.activeFundingRound.set(targetRound);
            await this.updatePaymentTokenBalanceForSelectedRound(targetRound);
          } else {
            this.activeFundingRound.set(null);
            this.myPaymentTokenSymbol.set(defaultTokenMeta.symbol);

            if (userAddress) {
              if (lastRound.paymentToken !== ethers.ZeroAddress) {
                const tokenContract = new ethers.Contract(lastRound.paymentToken, ERC20_ABI, provider);
                const bal = await tokenContract['balanceOf'](userAddress);
                this.myPaymentTokenBalance.set(ethers.formatUnits(bal, defaultTokenMeta.decimals));
              } else {
                const bal = await provider.getBalance(userAddress);
                this.myPaymentTokenBalance.set(ethers.formatEther(bal));
              }
            } else {
              this.myPaymentTokenBalance.set('0');
            }
          }
        }).catch(err => {
          console.warn('Lỗi đọc funding round:', err);
          this.activeFundingRound.set(null);
          this.myPaymentTokenBalance.set('0');
        });
        promises.push(loadFundingRoundPromise);
      }

      await Promise.all(promises);
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
      this.orderBook.set({
        bids: data?.buy || [],
        asks: data?.sell || []
      });
    } catch (e) {
      this.orderBook.set({ bids: [], asks: [] });
    }
  }

  // Mua cổ phần từ FundingManager
  async handleBuyShares() {
    if (this.buyLoading()) return;

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

        this.stateService.showToast(`Đang gửi giao dịch mua ${this.stateService.currentCompanyTokenSymbol()} (${formattedCost} ${round.paymentTokenSymbol})...`, 'warning');
        const tx = await funding['buyShares'](round.id, tokenAmount, gasOverrides);
        await tx.wait();
      } else {
        const formattedCost = ethers.formatEther(cost);
        this.stateService.showToast(`Chi phí cần thanh toán: ${formattedCost} BNB. Đang gửi giao dịch...`, 'warning');
        const tx = await funding['buyShares'](round.id, tokenAmount, { ...gasOverrides, value: cost });
        await tx.wait();
      }

      this.stateService.showToast(`Mua thành công ${this.buyAmount()} ${this.stateService.currentCompanyTokenSymbol()}!`, 'success');
      await this.loadOnChainData(company);
    } catch (e: any) {
      this.stateService.showToast(e.reason || e.message || 'Giao dịch thất bại!', 'error');
    } finally {
      this.buyLoading.set(false);
    }
  }

  // Đặt lệnh mua/bán trên Marketplace (ký off-chain và gửi backend)
  async handlePlaceOrder() {
    if (this.orderLoading()) return;

    const company = this.selectedCompany();
    if (!company || !this.isConnected()) return;

    this.orderLoading.set(true);
    try {
      const price = parseFloat(this.orderPrice());
      const amount = this.orderAmount();
      const token = this.selectedPaymentToken();

      if (!price || !amount) {
        this.stateService.showToast('Vui lòng nhập đầy đủ giá và số lượng', 'warning');
        this.orderLoading.set(false);
        return;
      }

      // Kiểm tra số dư khả dụng trước khi đặt lệnh
      if (this.orderSide() === 'SELL') {
        const shareBalance = parseFloat(this.myBalance() || '0');
        if (amount > shareBalance) {
          this.stateService.showToast(`Số dư cổ phần không đủ để thực hiện lệnh bán (Số dư hiện tại: ${this.formatNumber(shareBalance)} ${this.stateService.currentCompanyTokenSymbol()})`, 'error');
          this.orderLoading.set(false);
          return;
        }
      } else if (this.orderSide() === 'BUY') {
        const paymentBalance = parseFloat(this.myPaymentTokenBalance() || '0');
        const totalCost = price * amount;
        if (totalCost > paymentBalance) {
          this.stateService.showToast(`Số dư ${token.symbol} không đủ để thực hiện lệnh mua (Cần: ${this.formatNumber(totalCost)} ${token.symbol}, Số dư hiện tại: ${this.formatNumber(paymentBalance)} ${token.symbol})`, 'error');
          this.orderLoading.set(false);
          return;
        }
      }

      // 1. Tạo thông điệp hash đóng gói tham số đặt lệnh (để khớp xác thực Smart Contract)
      const userAddress = this.walletAddress();
      const nonce = BigInt(Date.now());
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 365); // 1 năm

      const tokenDecimals = token.decimals || 18;
      const priceWei = ethers.parseUnits(String(price), tokenDecimals);
      const amountWei = ethers.parseEther(String(amount));

      const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
        [userAddress, company.token_address, amountWei, priceWei, nonce, deadline]
      );

      // 2. Ký ví thông điệp hash này
      const signer = await this.stateService.web3Service.getSigner();
      const signature = await signer.signMessage(ethers.getBytes(messageHash));
      const signatureFull = `${signature}_${nonce.toString()}_${deadline.toString()}`;

      // 3. Gửi lên Backend để xếp hàng và chạy Matcher Engine
      await firstValueFrom(this.apiService.post<any>('marketplace/orders', {
        side: this.orderSide(),
        price: price,
        amount: amount,
        signature: signatureFull,
        message: messageHash,
        payment_token_address: token.address,
        payment_token_symbol: token.symbol
      }, company.id));

      this.stateService.showToast('Đặt lệnh thành công! Hệ thống đang tự động khớp lệnh...', 'success');
      this.orderPrice.set('');
      this.orderAmount.set(1);
      await this.loadOrderBook(company);
      await this.loadPaymentTokenBalance();
      await this.loadOnChainData(company);
    } catch (e: any) {
      this.stateService.showToast(e.reason || 'Đặt lệnh thất bại!', 'error');
    } finally {
      this.orderLoading.set(false);
    }
  }

  // Hủy lệnh giao dịch
  public handleCancelOrder(orderId: number) {
    if (this.orderLoading()) return;

    const company = this.selectedCompany();
    if (!company) return;

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
          this.orderLoading.set(true);
          await firstValueFrom(this.apiService.post<any>(`marketplace/orders/${orderId}/cancel`, {}, company.id));
          this.stateService.showToast('Đã hủy lệnh thành công!', 'success');
          await this.loadOrderBook(company);
          await this.loadPaymentTokenBalance();
          await this.loadOnChainData(company);
        } catch (e: any) {
          this.stateService.showToast(e.error?.message || 'Có lỗi xảy ra khi hủy lệnh!', 'error');
        } finally {
          this.orderLoading.set(false);
        }
      }
    });
  }

  // Nhận cổ tức cho riêng lẻ một đợt cụ thể
  async handleClaimSingleDividend(round: any) {
    if (this.dividendLoading()) return;

    const company = this.selectedCompany();
    if (!company || !this.isConnected() || !round) return;

    if (Number(round.claimableAmount) > Number(round.contractBalance)) {
      this.stateService.showToast(`Lỗi: Smart Contract không đủ số dư tài sản chi trả cho đợt cổ tức này (Số dư hợp đồng: ${this.formatNumber(round.contractBalance)} ${round.dividendTokenSymbol}). Vui lòng liên hệ ban quản trị để nạp thêm tài sản chi trả!`, 'error');
      return;
    }

    this.dividendLoading.set(true);
    try {
      const signer = await this.stateService.web3Service.getSigner();
      const funding = new ethers.Contract(company.funding_address, FUNDING_MANAGER_ABI, signer);
      const gasOverrides = await this.stateService.web3Service.getGasOverrides();

      this.stateService.showToast(`Đang thực hiện nhận cổ tức đợt #${round.id} (${round.name})...`, 'warning');
      const tx = await funding['claimDividend'](round.id, gasOverrides);
      await tx.wait();

      this.stateService.showToast(`Đã nhận thành công ${this.formatNumber(round.claimableAmount)} ${round.dividendTokenSymbol} từ đợt #${round.id}!`, 'success');
      await this.loadOnChainData(company);
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.reason || e.message || 'Nhận cổ tức thất bại!', 'error');
    } finally {
      this.dividendLoading.set(false);
    }
  }

  // Nhận cổ tức từ Card Overview (Tự động chuyển tab và scroll xuống)
  async handleClaimDividend() {
    this.scrollToDividendsTab();
  }

  // Xử lý chuyển trang cho danh sách cổ tức
  public onDivPageChange(page: number) {
    this.divCurrentPage.set(page);
  }

  // Cuộn màn hình tới tab cổ tức
  public scrollToDividendsTab() {
    this.setActiveTab('dividends');
    setTimeout(() => {
      const element = document.getElementById('dividend-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
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

  // Cập nhật số dư ví payment token cho vòng gọi vốn được chọn
  async updatePaymentTokenBalanceForSelectedRound(round: any) {
    const userAddress = this.walletAddress();
    if (!userAddress || !round) {
      this.myPaymentTokenBalance.set('0');
      return;
    }
    try {
      const rpcUrl = this.getRpcUrl(this.selectedCompany());
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 100 });
      const isERC20 = round.paymentToken !== ethers.ZeroAddress;
      if (isERC20) {
        const tokenContract = new ethers.Contract(round.paymentToken, ERC20_ABI, provider);
        const bal = await tokenContract['balanceOf'](userAddress);
        this.myPaymentTokenBalance.set(ethers.formatUnits(bal, round.paymentTokenDecimals));
      } else {
        const bal = await provider.getBalance(userAddress);
        this.myPaymentTokenBalance.set(ethers.formatEther(bal));
      }
      this.myPaymentTokenSymbol.set(round.paymentTokenSymbol);
    } catch (e) {
      console.warn('Lỗi cập nhật số dư payment token cho vòng chọn:', e);
      this.myPaymentTokenBalance.set('0');
    }
  }

  // Sự kiện khi nhà đầu tư đổi vòng gọi vốn trên Dropdown
  async onSelectFundingRound(roundId: any) {
    const rId = Number(roundId);
    const round = this.activeFundingRoundsList().find(r => r.id === rId);
    if (round) {
      this.activeFundingRound.set(round);
      await this.updatePaymentTokenBalanceForSelectedRound(round);
    }
  }
}
