import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ModalRef } from '@core/services/modal-ref';
import { firstValueFrom } from 'rxjs';
import { ethers } from 'ethers';
import { BoardGovernance, FinanceManager } from '../../../core/constants/contracts';

import { ButtonComponent } from '@shared/components/button/button.component';
import { CustomSelectComponent } from '../../../shared/components/custom-select/custom-select.component';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-create-round-proposal-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, CustomSelectComponent, IconComponent],
  templateUrl: './create-round-proposal-modal.component.html'
})
export class CreateRoundProposalModalComponent {
  public modalRef = inject(ModalRef);
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  public isLoading = signal(false);

  // Phân tích & xác thực ERC20 Token thông qua RPC
  public detectedTokenSymbol = signal<string>('');
  public detectedTokenDecimals = signal<number | null>(null);
  public isValidatingToken = signal<boolean>(false);
  public tokenValidationError = signal<string>('');

  public paymentOptions = [
    { value: 'ERC20', label: 'Token ERC20' },
    { value: 'BNB', label: 'BNB (Native)' }
  ];

  public newRound = {
    name: 'Vòng Seed',
    share_price: '0.1', // mặc định giá 0.1
    max_supply: 100000,
    duration_days: 30,
    expiration_days: 7,
    paymentMethod: 'ERC20', // Mặc định là Token ERC20
    paymentTokenAddress: ''
  };

  onCancel() {
    this.modalRef.close();
  }

  // Tự động load thông tin ERC20 khi dán địa chỉ hợp đồng
  async onTokenAddressChange(addr: string) {
    this.newRound.paymentTokenAddress = addr.trim();
    const cleanAddr = this.newRound.paymentTokenAddress;

    if (!cleanAddr) {
      this.detectedTokenSymbol.set('');
      this.detectedTokenDecimals.set(null);
      this.tokenValidationError.set('');
      return;
    }

    // 1. Kiểm tra định dạng địa chỉ ví
    if (!ethers.isAddress(cleanAddr)) {
      this.detectedTokenSymbol.set('');
      this.detectedTokenDecimals.set(null);
      this.tokenValidationError.set('Địa chỉ ví không đúng định dạng 0x...!');
      return;
    }

    this.isValidatingToken.set(true);
    this.tokenValidationError.set('');
    this.detectedTokenSymbol.set('');
    this.detectedTokenDecimals.set(null);

    try {
      const provider = this.stateService.getProvider();
      if (!provider) {
        this.tokenValidationError.set('Ví chưa kết nối, không thể tải thông tin!');
        this.isValidatingToken.set(false);
        return;
      }

      // ABI tối giản ERC20
      const minErc20Abi = [
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
      ];

      const contract = new ethers.Contract(cleanAddr, minErc20Abi, provider);

      // Đọc symbol và decimals từ blockchain
      const [symbol, decimals] = await Promise.all([
        contract['symbol'](),
        contract['decimals']()
      ]);

      this.detectedTokenSymbol.set(symbol);
      this.detectedTokenDecimals.set(Number(decimals));
    } catch (e: any) {
      console.error('Lỗi khi đọc token ERC20:', e);
      this.tokenValidationError.set('Địa chỉ không phải Token ERC20 hợp lệ trên mạng lưới hiện hành!');
    } finally {
      this.isValidatingToken.set(false);
    }
  }

  async onSubmit() {
    if (!this.newRound.name || !this.newRound.share_price || !this.newRound.max_supply) return;
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.governance_address || !comp.funding_address || !comp.token_address) {
      this.stateService.showToast('Cấu hình Smart Contracts của doanh nghiệp chưa hoàn chỉnh!', 'error');
      return;
    }

    this.isLoading.set(true);
    try {
      const signer = await this.stateService.getSigner();
      const govContract = new ethers.Contract(comp.governance_address, BoardGovernance.abi, signer);

      const target = comp.funding_address;
      const value = '0';
      const financeInterface = new ethers.Interface(FinanceManager.abi);

      // Cấu hình tham số gọi vốn on-chain
      let paymentToken = ethers.ZeroAddress;
      let tokenDecimals = 18; // mặc định BNB là 18 decimals

      if (this.newRound.paymentMethod === 'ERC20') {
        if (!this.newRound.paymentTokenAddress || !ethers.isAddress(this.newRound.paymentTokenAddress)) {
          this.stateService.showToast('Địa chỉ hợp đồng Token thanh toán không hợp lệ!', 'error');
          this.isLoading.set(false);
          return;
        }
        paymentToken = this.newRound.paymentTokenAddress;
        
        // Nếu load thành công decimals, dùng nó, ngược lại fallback 18
        if (this.detectedTokenDecimals() !== null) {
          tokenDecimals = this.detectedTokenDecimals()!;
        }
      }

      // Quy đổi share_price tương ứng decimals của token thanh toán
      const priceWei = ethers.parseUnits(this.newRound.share_price.toString(), tokenDecimals);
      // Quy đổi max supply tương ứng decimals của token cổ phần (luôn 18 decimals)
      const maxSupplyWei = ethers.parseUnits(this.newRound.max_supply.toString(), 18);
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + this.newRound.duration_days * 86400;

      const params = {
        name: this.newRound.name,
        shareToken: comp.token_address,
        paymentToken: paymentToken,
        treasury: comp.governance_address,
        price: priceWei,
        maxSupply: maxSupplyWei,
        startTime: startTime,
        endTime: endTime,
        minPurchase: 0,
        maxPurchase: 0,
        isWhitelistOnly: false
      };

      const calldata = financeInterface.encodeFunctionData('createFundingRound', [params]);

      this.stateService.showToast('Vui lòng xác nhận giao dịch gửi đề xuất lên HĐQT qua MetaMask...', 'warning');
      const gasOverrides = await this.stateService.getGasOverrides(signer);
      
      const delaySeconds = 0;
      const durationSeconds = this.newRound.expiration_days * 86400;
      const proposalTitle = `Mở vòng gọi vốn: ${this.newRound.name}`;

      // 1. Gửi transaction tạo proposal lên blockchain
      const tx = await govContract['createProposal'](
        target,
        value,
        calldata,
        proposalTitle,
        delaySeconds,
        durationSeconds,
        gasOverrides
      );

      this.stateService.showToast('Giao dịch đang chờ xác nhận từ mạng lưới...', 'warning');
      await tx.wait();

      // Đọc proposalCount mới nhất làm onchain_id
      const proposalCount = await govContract['proposalCount']();
      const onchainId = Number(proposalCount);

      // 2. Đồng bộ tạo Proposal trên Backend DB
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + this.newRound.expiration_days);

      const formatDate = (date: Date) => {
        const pad = (num: number) => String(num).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      };

      const paySymbol = this.newRound.paymentMethod === 'ERC20' ? (this.detectedTokenSymbol() || 'USDT') : 'BNB';
      const payDecimals = tokenDecimals;
      const payAddress = paymentToken;

      await firstValueFrom(this.apiService.post<any>('proposals', {
        title: proposalTitle,
        description: `Mở vòng gọi vốn ${this.newRound.name} thanh toán bằng ${paySymbol}. Giá ${this.newRound.share_price} / Share, giới hạn chào bán ${this.newRound.max_supply} cổ phần.`,
        type: 'FUNDING_ROUND',
        params: {
          target,
          value,
          calldata,
          onchain_id: onchainId,
          // Lưu chi tiết vòng gọi vốn để khi execute tự động đồng bộ sang ACTIVE
          name: this.newRound.name,
          share_price: this.newRound.share_price,
          max_supply: this.newRound.max_supply,
          duration_days: this.newRound.duration_days,
          payment_token_address: payAddress,
          payment_token_symbol: paySymbol,
          payment_token_decimals: payDecimals
        },
        expiration_date: formatDate(expirationDate)
      }, comp.id));

      // 3. Đồng bộ tạo Vòng gọi vốn tạm thời (DRAFT) trên Backend DB
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + this.newRound.duration_days);

      // Quy đổi mục tiêu gọi vốn = max_supply * price
      const targetAmount = Number(this.newRound.max_supply) * parseFloat(this.newRound.share_price);

      await firstValueFrom(this.apiService.post<any>('funding', {
        name: this.newRound.name,
        share_price: parseFloat(this.newRound.share_price),
        target_amount: targetAmount,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
        payment_token_address: payAddress,
        payment_token_symbol: paySymbol,
        payment_token_decimals: payDecimals
      }, comp.id));

      this.stateService.showToast('Đã đề xuất vòng gọi vốn thành công! Chờ HĐQT ký duyệt biểu quyết.', 'success');
      this.modalRef.close(true);
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || e.error?.message || 'Lỗi xảy ra trong quá trình đề xuất!', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
