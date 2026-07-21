import { Injectable, signal, inject, effect } from '@angular/core';
import { createAppKit, type AppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc, bscTestnet } from '@reown/appkit/networks';
import { BrowserProvider, formatEther, JsonRpcProvider } from 'ethers';
import { environment } from '@environments/environment';
import { ThemeService } from './theme.service';
import { ToastService } from './toast.service';
import { POPULAR_CHAINS } from '../utils/blockchain.utils';

@Injectable({
  providedIn: 'root'
})
export class Web3Service {
  private modal!: AppKit;

  public readonly isEnabled: boolean = true; // Luôn bật Web3 trong dự án này

  // Signals quản lý trạng thái ví
  public address = signal<string | null>(null);
  public chainId = signal<number | null>(null);
  public isConnected = signal<boolean>(false);
  public balance = signal<string>('0.0000');
  public chainSymbol = signal<string>('ETH');
  public networkName = signal<string>('Unknown Network');
  public isWrongChain = signal<boolean>(false);
  public txSpeed = signal<'default' | 'fast' | 'custom'>('default');
  public gasMultiplier = signal<number>(2);
  public showWrongChainModal = signal<boolean>(false);

  // Mạng cấu hình mong muốn (đồng bộ LocalStorage)
  public readonly configuredChainId = signal<string>(
    (typeof window !== 'undefined' && localStorage.getItem('angular_web3_configured_chain_id')) || environment.defaultChainId || '56'
  );

  public readonly POPULAR_CHAINS = POPULAR_CHAINS;

  // Mạng được hỗ trợ (cấu hình động RPC & Explorer từ POPULAR_CHAINS)
  public readonly supportedChains = [bsc, bscTestnet].map(chain => {
    const popular = POPULAR_CHAINS.find(c => Number(c.chainId) === Number(chain.id));
    if (popular) {
      return {
        ...chain,
        rpcUrls: {
          ...chain.rpcUrls,
          default: { http: [popular.rpcUrl] }
        },
        blockExplorers: {
          ...chain.blockExplorers,
          default: { name: popular.name, url: popular.explorerUrl }
        }
      };
    }
    return chain;
  });

  private readonly themeService = inject(ThemeService);
  private readonly toastService = inject(ToastService);

  constructor() {
    if (!this.isEnabled) {
      console.info('[Web3] Web3 đã bị tắt');
      return;
    }
    this.initAppKit();
    this.setupThemeSync();

    // Effect đồng bộ hóa tên mạng hiển thị và symbol khi ví chưa kết nối
    effect(() => {
      const isConn = this.isConnected();
      const confId = this.configuredChainId();
      if (!isConn) {
        const popular = POPULAR_CHAINS.find(c => c.chainId === confId);
        this.networkName.set(popular ? popular.name : 'Unknown Network');
        const symbol = popular ? (popular.chainId === '56' || popular.chainId === '97' ? 'BNB' : 'ETH') : 'ETH';
        this.chainSymbol.set(symbol);
      }
    }, { allowSignalWrites: true });

    // Effect lưu cấu hình mạng đã chọn vào LocalStorage
    effect(() => {
      const chain = this.configuredChainId();
      if (typeof window !== 'undefined' && chain) {
        localStorage.setItem('angular_web3_configured_chain_id', chain);
      }
    });
  }

  // Tự động đồng bộ theme hệ thống/lựa chọn sang WalletConnect Modal
  private setupThemeSync() {
    effect(() => {
      const isDark = this.themeService.isDarkMode();
      if (this.modal) {
        try {
          this.modal.setThemeMode(isDark ? 'dark' : 'light');
        } catch (e) {
          console.warn('[Web3] Lỗi đồng bộ theme sang AppKit:', e);
        }
      }
    });
  }

  private async initAppKit() {
    if (typeof window === 'undefined') return;

    const projectId = environment.walletConnectProjectId;
    if (!projectId) {
      console.warn('[Web3] walletConnectProjectId is missing in environment configuration.');
      return;
    }

    // Tự động dọn dẹp các session treo của WalletConnect nếu chưa kết nối
    if (!this.isConnected()) {
      await this.clearWalletConnectStorage();
    }

    const isDark = this.themeService.isDarkMode();
    const defaultChainIdNum = Number(this.configuredChainId());
    const defaultNet = this.supportedChains.find(c => Number(c.id) === defaultChainIdNum) || this.supportedChains[0];

    this.modal = createAppKit({
      adapters: [new EthersAdapter()],
      networks: this.supportedChains as any,
      defaultNetwork: defaultNet as any,
      allowUnsupportedChain: true,
      metadata: {
        name: 'PTT DApp',
        description: 'PTT DApp Application Framework',
        url: window.location.origin,
        icons: [window.location.origin + '/assets/logo.svg']
      },
      projectId,
      themeMode: isDark ? 'dark' : 'light',
      defaultAccountTypes: {
        eip155: 'smartAccount'
      },
      features: {
        analytics: false,
        reownAuthentication: false
      },
      enableCoinbase: false
    } as any);

    // Lắng nghe sự thay đổi tài khoản
    this.modal.subscribeAccount(async (accountState) => {
      const prevConnected = this.isConnected();
      this.address.set(accountState.address || null);
      this.isConnected.set(accountState.isConnected);

      if (accountState.isConnected && accountState.address) {
        await this.updateBalanceAndNetwork();
        
        const currentChainId = this.chainId();
        const targetChainId = Number(this.configuredChainId());

        if (currentChainId && currentChainId !== targetChainId) {
          // Delay chuyển mạng một chút để đảm bảo ví đã sẵn sàng nhận request
          setTimeout(async () => {
            await this.switchNetwork(targetChainId);
          }, 500);
        } else if (currentChainId) {
          this.checkAndUpdateNetworkState(currentChainId, false);
        }
      } else {
        this.balance.set('0.0000');
        this.chainId.set(null);
        this.networkName.set('Unknown Network');
        this.isWrongChain.set(false);
        this.showWrongChainModal.set(false);
        if (prevConnected) {
          this.toastService.showToast('Đã ngắt kết nối ví!', 'error');
        }
      }
    });

    // Lắng nghe sự thay đổi mạng lưới
    this.modal.subscribeNetwork((networkState) => {
      if (networkState.chainId) {
        const id = Number(networkState.chainId);
        this.checkAndUpdateNetworkState(id, true);
      }

      if (this.isConnected()) {
        this.updateBalanceAndNetwork();
      }
    });

    // Lắng nghe sự kiện AppKit để bắt lỗi treo session/ví từ chối, tự động giải phóng
    this.modal.subscribeEvents(async (event: any) => {
      const eventName = event.data?.event;
      const errorMsg = event.data?.properties?.message || event.data?.error || '';
      const isConnectionError = 
        eventName === 'CONNECT_ERROR' || 
        errorMsg.toString().toLowerCase().includes('declined') || 
        errorMsg.toString().toLowerCase().includes('active');
      
      if (isConnectionError) {
        console.warn('[Web3] Phát hiện lỗi kết nối hoặc treo session từ AppKit, tự động giải phóng...');
        try {
          await this.modal.disconnect();
          await this.clearWalletConnectStorage();
        } catch (e) {}
      }
    });
  }

  // Hàm helper tập trung kiểm tra và cập nhật trạng thái mạng lưới
  private checkAndUpdateNetworkState(chainId: number, showToastAlert = true) {
    const prevChainId = this.chainId();
    const prevWrongChain = this.isWrongChain();
    
    this.chainId.set(chainId);

    const supportedChain = this.supportedChains.find(c => Number(c.id) === chainId);
    const isSupported = !!supportedChain;
    this.isWrongChain.set(!isSupported);

    if (isSupported) {
      this.networkName.set(supportedChain.name);
      // Lấy symbol của native currency của chain
      const symbol = (supportedChain as any).nativeCurrency?.symbol || 'ETH';
      this.chainSymbol.set(symbol);

      this.showWrongChainModal.set(false);
      // Chỉ tự động đóng modal nếu trước đó đang ở sai mạng lưới và nay đã chuyển về đúng mạng
      if (prevWrongChain) {
        try {
          this.modal.close();
        } catch (e) {
          // ignore
        }
      }
      if (showToastAlert && prevChainId && prevChainId !== chainId) {
        this.toastService.showToast(`Đã chuyển sang mạng ${supportedChain.name}!`, 'success');
      }

      // Tự động điều chỉnh tốc độ gas theo mạng (Testnet -> fast, Mainnet -> default)
      const isTestnet = !!supportedChain.testnet || supportedChain.name.toLowerCase().includes('sepolia') || supportedChain.name.toLowerCase().includes('testnet');
      if (isTestnet) {
        this.txSpeed.set('fast');
      } else {
        this.txSpeed.set('default');
      }
    } else {
      const popular = POPULAR_CHAINS.find(c => Number(c.chainId) === chainId);
      this.networkName.set(popular ? popular.name : 'Mạng không hỗ trợ');
      this.chainSymbol.set('ETH'); // default fallback
      
      if (this.isConnected()) {
        this.showWrongChainModal.set(true);
        if (showToastAlert && (!prevWrongChain || prevChainId !== chainId)) {
          this.toastService.showToast('Mạng hiện tại không được hỗ trợ!', 'error');
        }
      } else {
        this.showWrongChainModal.set(false);
      }

      // Tự động điều chỉnh tốc độ gas theo mạng (Testnet -> fast, Mainnet -> default)
      const isTestnet = popular 
        ? popular.name.toLowerCase().includes('sepolia') || popular.name.toLowerCase().includes('testnet')
        : (chainId === 421614 || chainId === 97 || chainId === 11155111);
      if (isTestnet) {
        this.txSpeed.set('fast');
      } else {
        this.txSpeed.set('default');
      }
    }
  }

  // Cập nhật số dư và thông tin mạng thông qua Ethers BrowserProvider
  public async updateBalanceAndNetwork() {
    try {
      const walletProvider = this.modal.getWalletProvider();
      const currentAddress = this.address();

      if (walletProvider && currentAddress) {
        const ethersProvider = new BrowserProvider(walletProvider as any);
        const balanceVal = await ethersProvider.getBalance(currentAddress);
        const formattedBalance = formatEther(balanceVal);
        // Định dạng làm tròn 4 chữ số thập phân
        this.balance.set(parseFloat(formattedBalance).toFixed(4));

        const network = await ethersProvider.getNetwork();
        const id = Number(network.chainId);
        this.checkAndUpdateNetworkState(id, false); // Cập nhật không phát ra Toast trùng lặp
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật số dư/mạng:', error);
    }
  }

  // Mở popup kết nối ví
  public async connect() {
    if (!this.isEnabled) return;
    try {
      // Ép mạng mong muốn trước khi kết nối để tránh lỗi
      const defaultChainIdNum = Number(this.configuredChainId());
      const defaultChain = this.supportedChains.find(c => Number(c.id) === defaultChainIdNum) || this.supportedChains[0];
      if (defaultChain) {
        try {
          await this.modal.switchNetwork(defaultChain as any);
        } catch (e) {
          console.warn('[Web3] Ép mạng trước khi mở modal thất bại:', e);
        }
      }

      if (!this.isConnected()) {
        try {
          await this.modal.disconnect();
        } catch (e) {}
      }
      await this.modal.open();
    } catch (error: any) {
      console.error('Lỗi kết nối ví:', error);
      // Bẫy lỗi treo session để thử ngắt kết nối và thử lại
      if (error?.message?.includes('declined') || error?.message?.includes('active')) {
        try {
          await this.modal.disconnect();
          await this.modal.open();
        } catch (e) {}
      }
    }
  }

  // Mở popup chuyển mạng
  public async openNetworkModal() {
    if (!this.isEnabled) return;
    try {
      await this.modal.open({ view: 'Networks' });
    } catch (error) {
      console.error('Lỗi mở popup chuyển mạng:', error);
    }
  }

  // Mở popup chi tiết ví (Account view của AppKit)
  public async openAccountModal() {
    if (!this.isEnabled) return;
    try {
      await this.modal.open({ view: 'Account' });
    } catch (error) {
      console.error('Lỗi mở popup chi tiết ví:', error);
    }
  }

  // Ngắt kết nối ví
  public async disconnect() {
    if (!this.isEnabled) return;
    try {
      await this.modal.disconnect();
    } catch (error) {
      console.error('Lỗi ngắt kết nối ví:', error);
    }
  }

  // Chuyển sang mạng cụ thể
  public async switchNetwork(chainId: number) {
    if (!this.isEnabled) return;

    const chainIdStr = chainId.toString();
    this.configuredChainId.set(chainIdStr);
    if (typeof window !== 'undefined') {
      localStorage.setItem('angular_web3_configured_chain_id', chainIdStr);
    }

    if (this.isConnected()) {
      try {
        const network = this.supportedChains.find(chain => Number(chain.id) === chainId);
        if (network) {
          try {
            await this.modal.switchNetwork(network as any);
          } catch (switchErr: any) {
            console.warn(`[Web3] AppKit switchNetwork thất bại cho chain ${chainId}, thử addNetworkToWallet:`, switchErr);
            // Tự động thêm mạng nếu chuyển mạng bị lỗi (thường do ví chưa cấu hình mạng này)
            const added = await this.addNetworkToWallet(chainId);
            if (added) {
              await this.modal.switchNetwork(network as any);
            } else {
              throw switchErr;
            }
          }
        } else {
          console.warn(`[Web3] Mạng với chainId ${chainId} không được hỗ trợ để chuyển.`);
        }
      } catch (error) {
        console.error(`Lỗi chuyển mạng ${chainId}:`, error);
      }
    } else {
      const popular = POPULAR_CHAINS.find(c => Number(c.chainId) === chainId);
      if (popular) {
        this.networkName.set(popular.name);
        this.toastService.showToast(`Đã chọn mạng mong muốn: ${popular.name}`, 'success');
      }
    }
  }

  // Tự động thêm mạng lưới mới vào ví MetaMask ( wallet_addEthereumChain )
  public async addNetworkToWallet(chainId: number | string): Promise<boolean> {
    if (typeof window === 'undefined' || !(window as any).ethereum) return false;
    const idNum = Number(chainId);
    const idStr = idNum.toString();
    const hexChainId = '0x' + idNum.toString(16);

    const chainInfo = this.POPULAR_CHAINS.find(c => c.chainId === idStr);
    if (!chainInfo) {
      console.warn(`[Web3] Không tìm thấy thông tin mạng trong POPULAR_CHAINS cho chainId: ${chainId}`);
      return false;
    }

    let symbol = 'ETH';
    let currencyName = 'Ether';
    if (idStr === '56' || idStr === '97') {
      symbol = 'BNB';
      currencyName = 'BNB';
    }

    const params = {
      chainId: hexChainId,
      chainName: chainInfo.name,
      nativeCurrency: { name: currencyName, symbol: symbol, decimals: 18 },
      rpcUrls: [chainInfo.rpcUrl],
      blockExplorerUrls: [chainInfo.explorerUrl]
    };

    try {
      await (window as any).ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [params]
      });
      return true;
    } catch (e) {
      console.warn('[Web3] Thêm mạng vào ví thất bại:', e);
      return false;
    }
  }

  // Tự động dọn dẹp dữ liệu kẹt trong IndexedDB & LocalStorage nếu chưa đăng nhập (Self-Healing)
  private async clearWalletConnectStorage() {
    if (typeof window === 'undefined') return;

    try {
      if ('indexedDB' in window) {
        const dbs = (await indexedDB.databases?.()) || [];
        for (const db of dbs) {
          if (db.name && (db.name.includes('WALLET_CONNECT') || db.name.includes('walletconnect') || db.name.includes('reown') || db.name.includes('appkit'))) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      }
    } catch (e) {
      console.warn('[Web3] Lỗi khi dọn dẹp IndexedDB:', e);
    }

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('wc@2') || key.startsWith('@w3m') || key.startsWith('@appkit'))) {
          if (key.includes('proposal') || key.includes('request') || key.includes('pending')) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }

  // Lấy Ethers Signer phục vụ giao dịch ghi
  public async getSigner() {
    if (!this.isEnabled) throw new Error('Web3 đã bị tắt.');
    const walletProvider = this.modal.getWalletProvider();
    if (!walletProvider) {
      throw new Error('Ví chưa được kết nối');
    }
    const ethersProvider = new BrowserProvider(walletProvider as any);

    // Ghi đè phương thức send để bypass cuộc gọi eth_accounts / eth_requestAccounts bị ví Social của AppKit chặn
    const currentAddress = this.address();
    const originalSend = ethersProvider.send.bind(ethersProvider);
    ethersProvider.send = async (method: string, params: any[]) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
        if (currentAddress) {
          return [currentAddress];
        }
      }
      return await originalSend(method, params);
    };

    return await ethersProvider.getSigner();
  }

  // Lấy Ethers Provider phục vụ giao dịch đọc
  public getProvider() {
    if (!this.isEnabled) throw new Error('Web3 đã bị tắt.');
    const walletProvider = this.modal?.getWalletProvider();
    if (walletProvider) {
      return new BrowserProvider(walletProvider as any);
    }
    
    // Fallback sang Public JsonRpcProvider khi ví chưa kết nối để khách vãng lai vẫn đọc được thông tin on-chain
    const currentChainId = this.chainId();
    const defaultChainIdNum = Number(environment.defaultChainId || 56);
    const chainConfig = POPULAR_CHAINS.find(c => Number(c.chainId) === Number(currentChainId))
      || POPULAR_CHAINS.find(c => Number(c.chainId) === defaultChainIdNum)
      || POPULAR_CHAINS[0];
      
    const rpcUrl = chainConfig ? chainConfig.rpcUrl : 'https://bsc-testnet-rpc.publicnode.com';
    return new JsonRpcProvider(rpcUrl);
  }

  // Lấy gas overrides dựa trên cài đặt tốc độ giao dịch của người dùng
  public async getGasOverrides(signer?: any): Promise<any> {
    const overrides: any = {};
    try {
      let currentSigner = signer;
      if (!currentSigner) {
        currentSigner = await this.getSigner();
      }
      const provider = currentSigner.provider;
      if (!provider) return overrides;
      
      const feeData = await provider.getFeeData();
      const speed = this.txSpeed();
      if (speed !== 'default') {
        const multiplier = speed === 'fast' ? 1.5 : this.gasMultiplier();
        if (feeData.maxFeePerGas) {
          overrides.maxFeePerGas = (feeData.maxFeePerGas * BigInt(Math.round(multiplier * 100))) / 100n;
        }
        if (feeData.maxPriorityFeePerGas) {
          overrides.maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * BigInt(Math.round(multiplier * 100))) / 100n;
        }
      }
    } catch (err) {
      console.warn('[Web3] Không thể lấy fee data để tính gas overrides:', err);
    }
    return overrides;
  }
}
