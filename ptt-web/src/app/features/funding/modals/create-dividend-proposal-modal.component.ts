import { Component, inject, signal, computed, OnInit } from '@angular/core';
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
  selector: 'app-create-dividend-proposal-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, CustomSelectComponent],
  template: `
    <div class="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
      <div class="form-field">
        <label>Tên đợt chia cổ tức</label>
        <input
          type="text"
          [(ngModel)]="newDividend.name"
          placeholder="VD: Cổ tức Quý 1 2026..."
          class="form-input focus:border-violet-500"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="form-field">
          <label>Loại token chi trả</label>
          <app-custom-select
            [options]="paymentOptions"
            valueKey="value"
            labelKey="label"
            [(value)]="newDividend.paymentMethod"
            placeholder="Chọn loại token..."
            triggerClass="w-full form-input !h-[42px] !bg-slate-50 !border-slate-200/40 dark:!bg-slate-900 dark:!border-slate-800 text-sm"
          />
        </div>
        <div class="form-field">
          <label>Tổng số tiền chi trả</label>
          <input
            type="number"
            [(ngModel)]="newDividend.totalAmount"
            placeholder="VD: 5000"
            class="form-input focus:border-violet-500 font-semibold"
          />
        </div>
      </div>

      <!-- Nếu chọn Custom Token hoặc ERC20 -->
      @if (newDividend.paymentMethod === 'ERC20') {
        <div class="grid grid-cols-1 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-900/20">
          @if (savedTokensList().length > 1) {
            <div class="form-field">
              <label class="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Chọn nhanh Token đã lưu</label>
              <app-custom-select
                [options]="savedTokensList()"
                valueKey="value"
                labelKey="label"
                [value]="selectedSavedToken()"
                (valueChange)="onSavedTokenChange($event)"
                placeholder="Chọn Token..."
                triggerClass="w-full form-input !h-[42px] !bg-white dark:!bg-slate-950 !border-slate-200 dark:!border-slate-800 text-xs text-slate-800 dark:text-slate-100"
              />
            </div>
          }

          <div class="form-field">
            <label class="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Địa chỉ contract Token (ERC20)</label>
            <input
              type="text"
              [ngModel]="newDividend.paymentTokenAddress"
              (ngModelChange)="onTokenAddressChange($event); selectedSavedToken.set('custom')"
              placeholder="0x..."
              [disabled]="selectedSavedToken() !== 'custom'"
              class="w-full h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-xs outline-none focus:border-violet-500 transition-all text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-900/60 disabled:cursor-not-allowed"
            />
            @if (isValidatingToken()) {
              <p class="text-[10px] text-violet-500 font-bold mt-1 animate-pulse select-none">Đang xác thực contract trên mạng lưới...</p>
            }
            @if (detectedTokenSymbol()) {
              <p class="text-[10px] text-emerald-600 font-black mt-1 select-none">✓ Đã nhận diện Token: {{ detectedTokenSymbol() }} ({{ detectedTokenDecimals() }} Decimals)</p>
            }
            @if (tokenValidationError()) {
              <p class="text-[10px] text-red-500 font-bold mt-1 select-none">✗ {{ tokenValidationError() }}</p>
            }
          </div>
        </div>
      }

      <div class="grid grid-cols-2 gap-4">
        <div class="form-field">
          <label>Block Snapshot</label>
          <div class="relative">
            <input
              type="number"
              [(ngModel)]="newDividend.checkpointBlock"
              class="form-input focus:border-violet-500 font-mono"
            />
            <button
              (click)="fetchCurrentBlock()"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2 py-1 rounded hover:bg-violet-100 dark:hover:bg-violet-950 transition-colors"
              title="Lấy block hiện tại"
            >
              MỚI NHẤT
            </button>
          </div>
        </div>
        <div class="form-field">
          <label>Thời hạn nhận (Ngày)</label>
          <input
            type="number"
            [(ngModel)]="newDividend.duration_days"
            class="form-input focus:border-violet-500"
          />
        </div>
      </div>

      <div class="form-field">
        <label>Hạn biểu quyết đề xuất (Ngày)</label>
        <input
          type="number"
          [(ngModel)]="newDividend.expiration_days"
          class="form-input focus:border-violet-500"
        />
      </div>

      <div class="pt-4 border-t border-slate-100 dark:border-slate-800/60 flex justify-end gap-3 select-none">
        <button
          app-button
          variant="cancel"
          (click)="onCancel()"
        >
          Hủy bỏ
        </button>
        <button
          app-button
          variant="primary"
          (click)="onSubmit()"
          [disabled]="isLoading() || !newDividend.name || !newDividend.totalAmount || !newDividend.checkpointBlock || (newDividend.paymentMethod === 'ERC20' && !detectedTokenSymbol())"
          [loading]="isLoading()"
        >
          Đệ trình đề xuất
        </button>
      </div>
    </div>
  `
})
export class CreateDividendProposalModalComponent implements OnInit {
  public modalRef = inject(ModalRef);
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  public isLoading = signal(false);

  // ERC20 verification
  public detectedTokenSymbol = signal<string>('');
  public detectedTokenDecimals = signal<number | null>(null);
  public isValidatingToken = signal<boolean>(false);
  public tokenValidationError = signal<string>('');

  public paymentOptions = [
    { value: 'BNB', label: 'BNB (Native)' },
    { value: 'ERC20', label: 'Token ERC20' }
  ];

  public savedTokensList = computed(() => {
    const comp = this.stateService.currentCompany();
    const tokens = comp?.saved_tokens || [];
    return [
      { value: 'custom', label: 'Nhập địa chỉ tùy chỉnh...' },
      ...tokens.map((t: any) => ({
        value: t.address,
        label: `${t.symbol} - ${t.name} (${t.address.substring(0, 6)}...${t.address.substring(t.address.length - 4)})`,
        decimals: t.decimals,
        symbol: t.symbol
      }))
    ];
  });
  public selectedSavedToken = signal<string>('custom');

  onSavedTokenChange(val: string) {
    this.selectedSavedToken.set(val);
    if (val === 'custom') {
      this.newDividend.paymentTokenAddress = '';
      this.detectedTokenSymbol.set('');
      this.detectedTokenDecimals.set(null);
      this.tokenValidationError.set('');
    } else {
      const token = this.savedTokensList().find(t => t.value === val);
      if (token) {
        this.newDividend.paymentTokenAddress = token.value;
        this.detectedTokenSymbol.set((token as any).symbol);
        this.detectedTokenDecimals.set((token as any).decimals);
        this.tokenValidationError.set('');
      }
    }
  }

  public newDividend = {
    name: '',
    paymentMethod: 'BNB',
    paymentTokenAddress: '',
    totalAmount: null as number | null,
    checkpointBlock: null as number | null,
    duration_days: 30,
    expiration_days: 7
  };

  ngOnInit() {
    this.fetchCurrentBlock();
  }

  onCancel() {
    this.modalRef.close();
  }

  // Fetch current block from provider
  async fetchCurrentBlock() {
    try {
      const provider = this.stateService.getProvider();
      if (provider) {
        const block = await provider.getBlockNumber();
        this.newDividend.checkpointBlock = block;
      }
    } catch (e) {
      console.warn('Không thể tự động tải block number:', e);
    }
  }

  // Validate ERC20 address
  async onTokenAddressChange(addr: string) {
    this.newDividend.paymentTokenAddress = addr.trim();
    const cleanAddr = this.newDividend.paymentTokenAddress;

    if (!cleanAddr) {
      this.detectedTokenSymbol.set('');
      this.detectedTokenDecimals.set(null);
      this.tokenValidationError.set('');
      return;
    }

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

      const minErc20Abi = [
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
      ];

      const contract = new ethers.Contract(cleanAddr, minErc20Abi, provider);
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
    if (this.isLoading()) return;
    if (!this.newDividend.name || !this.newDividend.totalAmount || !this.newDividend.checkpointBlock) return;

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

      let dividendToken = ethers.ZeroAddress;
      let tokenDecimals = 18;

      if (this.newDividend.paymentMethod === 'ERC20') {
        if (!this.newDividend.paymentTokenAddress || !ethers.isAddress(this.newDividend.paymentTokenAddress)) {
          this.stateService.showToast('Địa chỉ hợp đồng Token thanh toán không hợp lệ!', 'error');
          this.isLoading.set(false);
          return;
        }
        dividendToken = this.newDividend.paymentTokenAddress;
        if (this.detectedTokenDecimals() !== null) {
          tokenDecimals = this.detectedTokenDecimals()!;
        }
      }

      // Convert amount to Wei
      const totalAmountWei = ethers.parseUnits(this.newDividend.totalAmount.toString(), tokenDecimals);
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + this.newDividend.duration_days * 86400;

      // Encode function arguments
      const calldata = financeInterface.encodeFunctionData('createDividendRound', [
        this.newDividend.name,
        comp.token_address,
        dividendToken,
        totalAmountWei,
        this.newDividend.checkpointBlock,
        startTime,
        endTime
      ]);

      this.stateService.showToast('Vui lòng xác nhận giao dịch gửi đề xuất lên HĐQT qua MetaMask...', 'warning');
      const gasOverrides = await this.stateService.getGasOverrides(signer);
      
      const delaySeconds = 0;
      const durationSeconds = this.newDividend.expiration_days * 86400;
      const proposalTitle = `Chia cổ tức: ${this.newDividend.name}`;

      // 1. Send transaction to create board proposal
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

      // Read new proposal count
      const proposalCount = await govContract['proposalCount']();
      const onchainId = Number(proposalCount);

      // 2. Save dividend record to DRAFT in Backend DB
      const dbDividend = await firstValueFrom(this.apiService.post<any>('dividends', {
        reward_token_address: dividendToken === ethers.ZeroAddress ? null : dividendToken,
        total_amount: this.newDividend.totalAmount,
        snapshot_block: this.newDividend.checkpointBlock,
        payment_date: new Date().toISOString().slice(0, 10)
      }, comp.id));

      const dividendDbId = dbDividend.dividend_id;

      // 3. Save board proposal to Backend DB
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + this.newDividend.expiration_days);

      const formatDate = (date: Date) => {
        const pad = (num: number) => String(num).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      };

      const paySymbol = this.newDividend.paymentMethod === 'ERC20' ? (this.detectedTokenSymbol() || 'USDT') : 'BNB';

      await firstValueFrom(this.apiService.post<any>('proposals', {
        title: proposalTitle,
        description: `Đợt chia cổ tức ${this.newDividend.name} với tổng số tiền ${this.newDividend.totalAmount} ${paySymbol} dựa trên tỷ lệ sở hữu tại Block #${this.newDividend.checkpointBlock}.`,
        type: 'DIVIDEND_ROUND',
        params: {
          target,
          value,
          calldata,
          onchain_id: onchainId,
          dividend_db_id: dividendDbId, // store reference to sync it on execute
          name: this.newDividend.name,
          reward_token_address: dividendToken,
          total_amount: this.newDividend.totalAmount,
          snapshot_block: this.newDividend.checkpointBlock
        },
        expiration_date: formatDate(expirationDate)
      }, comp.id));

      this.stateService.showToast('Đã đề xuất chia cổ tức thành công! Chờ HĐQT ký duyệt biểu quyết.', 'success');
      this.modalRef.close(true);
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || e.error?.message || 'Lỗi xảy ra trong quá trình đề xuất!', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
