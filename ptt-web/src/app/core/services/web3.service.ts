import { Injectable, signal, inject, effect } from '@angular/core';
import { createAppKit, type AppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet, arbitrum, arbitrumSepolia, bsc, bscTestnet } from '@reown/appkit/networks';
import { ApiController } from '@reown/appkit-controllers';
import { BrowserProvider, formatEther } from 'ethers';
import { environment } from '@environments/environment';
import { ThemeService } from './theme.service';
import { ToastService } from './toast.service';
import { POPULAR_CHAINS } from '../utils/blockchain.utils';

@Injectable({
  providedIn: 'root'
})
export class Web3Service {
  private modal!: AppKit;

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

  public readonly POPULAR_CHAINS = POPULAR_CHAINS;

  // Mạng được hỗ trợ (cấu hình động RPC & Explorer từ POPULAR_CHAINS)
  public readonly supportedChains = [arbitrum, mainnet, bsc, arbitrumSepolia, bscTestnet].map(chain => {
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
    this.initAppKit();
    this.setupThemeSync();
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

  private initAppKit() {
    if (typeof window === 'undefined') return;

    const projectId = environment.walletConnectProjectId;
    if (!projectId) {
      console.warn('[Web3] walletConnectProjectId is missing in environment configuration.');
      return;
    }

    // Để AppKit tự động lấy cấu hình từ Reown Cloud Dashboard (Social & Email)
    const isDark = this.themeService.isDarkMode();

    this.modal = createAppKit({
      adapters: [new EthersAdapter()],
      networks: this.supportedChains as any,
      defaultNetwork: this.supportedChains[0] as any, // Arbitrum One làm default
      allowUnsupportedChain: true,
      metadata: {
        name: 'Angular Web3 DApp',
        description: 'Angular Web3 Application Framework',
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
        reownAuthentication: false // Vẫn giữ tắt local SIWX để an toàn
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
        
        // Cập nhật hiển thị modal nếu mạng hiện tại sai sau khi load account (khi reload)
        const currentChainId = this.chainId();
        if (currentChainId) {
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
    try {
      await this.modal.open();
    } catch (error) {
      console.error('Lỗi kết nối ví:', error);
    }
  }

  // Mở popup chuyển mạng
  public async openNetworkModal() {
    try {
      await this.modal.open({ view: 'Networks' });
    } catch (error) {
      console.error('Lỗi mở popup chuyển mạng:', error);
    }
  }

  // Mở popup chi tiết ví (Account view của AppKit)
  public async openAccountModal() {
    try {
      await this.modal.open({ view: 'Account' });
    } catch (error) {
      console.error('Lỗi mở popup chi tiết ví:', error);
    }
  }

  // Ngắt kết nối ví
  public async disconnect() {
    try {
      await this.modal.disconnect();
    } catch (error) {
      console.error('Lỗi ngắt kết nối ví:', error);
    }
  }

  // Chuyển sang mạng cụ thể
  public async switchNetwork(chainId: number) {
    try {
      const network = this.supportedChains.find(chain => Number(chain.id) === chainId);
      if (network) {
        await this.modal.switchNetwork(network as any);
      } else {
        console.warn(`[Web3] Mạng với chainId ${chainId} không được hỗ trợ để chuyển.`);
      }
    } catch (error) {
      console.error(`Lỗi chuyển mạng ${chainId}:`, error);
    }
  }

  // Lấy Ethers Signer phục vụ giao dịch ghi
  public async getSigner() {
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
    const walletProvider = this.modal.getWalletProvider();
    if (!walletProvider) {
      throw new Error('Ví chưa được kết nối');
    }
    return new BrowserProvider(walletProvider as any);
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
