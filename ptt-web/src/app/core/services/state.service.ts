import { Injectable, inject, computed } from '@angular/core';
import { Web3Service } from './web3.service';
import { UiStateService } from './ui-state.service';
import { ThemeService } from './theme.service';
import { ToastService } from './toast.service';

/**
 * StateService đóng vai trò là Facade Pattern (giống như cafe-blockchain).
 * Lớp này chịu trách nhiệm tiêm các dịch vụ con và expose (ủy thác) các tín hiệu (signals),
 * thuộc tính cũng như phương thức cần thiết ra bên ngoài để các component sử dụng thống nhất.
 */
@Injectable({
  providedIn: 'root'
})
export class StateService {
  public readonly web3Service = inject(Web3Service);
  private readonly uiStateService = inject(UiStateService);
  private readonly themeService = inject(ThemeService);
  private readonly toastService = inject(ToastService);

  // ====================================================
  // DELEGATED UI STATE (ỦY THÁC TRẠNG THÁI GIAO DIỆN)
  // ====================================================
  public readonly showMobileMenu = this.uiStateService.showMobileMenu;
  public readonly showDropdown = this.uiStateService.showDropdown;
  public readonly showNetworkDropdown = this.uiStateService.showNetworkDropdown;
  public readonly isLoading = this.uiStateService.isLoading;

  // ====================================================
  // DELEGATED THEME STATE (ỦY THÁC TRẠNG THÁI THEME)
  // ====================================================
  public readonly isDarkMode = this.themeService.isDarkMode;
  public readonly themeMode = this.themeService.themeMode;

  // ====================================================
  // DELEGATED WEB3 STATE (ỦY THÁC TRẠNG THÁI BLOCKCHAIN)
  // ====================================================
  public readonly address = this.web3Service.address;
  public readonly chainId = this.web3Service.chainId;
  public readonly isConnected = this.web3Service.isConnected;
  public readonly balance = this.web3Service.balance;
  public readonly networkName = this.web3Service.networkName;
  public readonly isWrongChain = this.web3Service.isWrongChain;
  public readonly chainSymbol = this.web3Service.chainSymbol;
  public readonly txSpeed = this.web3Service.txSpeed;
  public readonly gasMultiplier = this.web3Service.gasMultiplier;
  public readonly showWrongChainModal = this.web3Service.showWrongChainModal;
  public readonly POPULAR_CHAINS = this.web3Service.POPULAR_CHAINS;

  // Thuộc tính tính toán rút gọn địa chỉ ví
  public readonly shortenedAddress = computed(() => {
    const addr = this.address();
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  });

  // ====================================================
  // DELEGATED METHODS (ỦY THÁC PHƯƠNG THỨC HÀNH ĐỘNG)
  // ====================================================

  // Thông báo Toast
  public showToast(msg: string, type: 'success' | 'error' | 'warning' = 'success') {
    this.toastService.showToast(msg, type);
  }

  // Thay đổi giao diện màu
  public toggleTheme() {
    this.themeService.toggleTheme();
  }

  public setThemeMode(mode: 'light' | 'dark' | 'auto') {
    this.themeService.setThemeMode(mode);
  }

  // Tương tác ví Web3
  public async connectWallet() {
    await this.web3Service.connect();
  }

  public async openNetworkModal() {
    await this.web3Service.openNetworkModal();
  }

  public async openAccountModal() {
    await this.web3Service.openAccountModal();
  }

  public async disconnectWallet() {
    await this.web3Service.disconnect();
    this.showWrongChainModal.set(false);
  }

  public async switchNetwork(chainId: number) {
    await this.web3Service.switchNetwork(chainId);
  }

  public async getSigner() {
    return await this.web3Service.getSigner();
  }

  public getProvider() {
    return this.web3Service.getProvider();
  }

  public async getGasOverrides(signer?: any) {
    return await this.web3Service.getGasOverrides(signer);
  }
}
