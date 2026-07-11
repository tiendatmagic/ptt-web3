import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { CustomSwitchComponent } from '@shared/components/custom-switch/custom-switch.component';
import { CustomRadioComponent } from '@shared/components/custom-radio/custom-radio.component';
import { CustomSearchInputComponent } from '@shared/components/custom-search-input/custom-search-input.component';
import { CustomSelectComponent } from '@shared/components/custom-select/custom-select.component';
import { CustomCheckboxComponent } from '@shared/components/custom-checkbox/custom-checkbox.component';
import { CustomDatePickerComponent } from '@shared/components/custom-date-picker/custom-date-picker.component';
import { CustomDateTimeRangeComponent, DateTimeRangeValue } from '@shared/components/custom-date-time-range/custom-date-time-range.component';
import { CardComponent } from '@shared/components/card/card.component';
import { CustomInputComponent } from '@shared/components/custom-input/custom-input.component';
import { AccordionComponent } from '@shared/components/accordion/accordion.component';
import { AccordionItemComponent } from '@shared/components/accordion/accordion-item.component';
import { KbdComponent } from '@shared/components/kbd/kbd.component';
import { TooltipDirective } from '@shared/components/tooltip/tooltip.directive';
import { CustomSliderComponent } from '@shared/components/custom-slider/custom-slider.component';
import { TabGroupComponent, TabOption } from '@shared/components/tab-group/tab-group.component';
import { StateService } from '@core/services/state.service';
import { ModalService } from '@core/services/modal.service';
import { DemoModalComponent } from './components/demo-modal/demo-modal.component';
import { parseEther } from 'ethers';

@Component({
  selector: 'app-home',
  
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonComponent,
    CustomSwitchComponent,
    CustomRadioComponent,
    CustomSearchInputComponent,
    CustomSelectComponent,
    CustomCheckboxComponent,
    CustomDatePickerComponent,
    CustomDateTimeRangeComponent,
    CardComponent,
    CustomInputComponent,
    BadgeComponent,
    AccordionComponent,
    AccordionItemComponent,
    KbdComponent,
    TooltipDirective,
    TabGroupComponent,
    CustomSliderComponent,
  ],
  templateUrl: './home.component.html'
})
export class HomeComponent {
  public stateService = inject(StateService);
  private readonly modalService = inject(ModalService);
  public readonly today = CustomDatePickerComponent.todayString();
  
  // Trạng thái Form Gửi ETH Demo
  public toAddress = signal('');
  public amount = signal('');
  public txHash = signal<string | null>(null);
  public txLoading = signal(false);
  public txError = signal<string | null>(null);

  // Trạng thái Form Ký tin nhắn Demo
  public messageToSign = signal('Chào mừng bạn đến với Angular Web3!');
  public signature = signal<string | null>(null);
  public signLoading = signal(false);
  public signError = signal<string | null>(null);

  // === DEMO STATE: UI Components Showcase ===
  public demoSwitchChecked = signal(true);
  public demoSwitchFull = signal(false);
  public demoRadioValue = signal('arbitrum');
  public demoCheckboxValue = signal(true);
  public demoSearchQuery = signal('');
  public demoSelectValue = signal<string | null>(null);
  public demoDatePickerValue = signal('2026-07-10');
  public limitDatePicker = signal(false); // Mặc định tắt giới hạn để chọn tự do
  public demoDatePickerMinDate = signal('2026-07-20'); // Mốc ngày minDate tùy biến (ví dụ: ngày 20)
  public demoDatePickerShowPresets = signal(true); // Cấu hình bật/tắt presets gợi ý chọn nhanh
  public demoAccordionMultiple = signal(false);

  // Trạng thái Demo Date Time Range Picker
  public demoRangeValue = signal<DateTimeRangeValue>({ startDate: '2026-07-10', endDate: '2026-07-15' });
  public demoRangeWithTimeValue = signal<DateTimeRangeValue>({ startDate: '2026-07-10 09:00', endDate: '2026-07-12 18:30' });
  public demoRangeLimitValue = signal<DateTimeRangeValue>({ startDate: '2026-07-12', endDate: '2026-07-15' });

  // Trạng thái Demo Slider
  public demoSliderVal1 = signal(60);
  public demoSliderVal2 = signal(30);

  // Trạng thái Demo Tab Group
  public demoTabValue = signal('wallet');
  public readonly demoTabOptions: TabOption[] = [
    { value: 'wallet', label: 'Ví dApp', icon: 'wallet', badge: 3 },
    { value: 'history', label: 'Lịch sử', icon: 'link-chain' },
    { value: 'settings', label: 'Cấu hình', icon: 'bolt' }
  ];

  // Trạng thái Demo Form Components
  public demoProfileBirthday = signal('');
  public demoProfileGender = signal('male');
  public demoProfileWallet = signal('');
  public readonly genderOptions: TabOption[] = [
    { value: 'male', label: 'Nam' },
    { value: 'female', label: 'Nữ' },
  ];



  /** Danh sách chain để demo custom-select */
  public readonly demoChainOptions = [
    { value: '1',     label: 'Ethereum Mainnet' },
    { value: '42161', label: 'Arbitrum One' },
    { value: '56',    label: 'BNB Smart Chain' },
    { value: '421614',label: 'Arbitrum Sepolia' },
    { value: '97',    label: 'BSC Testnet' },
  ];

  /** Danh sách radio options cho demo */
  public readonly demoRadioOptions = [
    { value: 'arbitrum', label: 'Arbitrum One', description: 'Layer 2 - Phí thấp, tốc độ cao' },
    { value: 'ethereum', label: 'Ethereum',     description: 'Mainnet - Bảo mật cao nhất' },
    { value: 'bsc',      label: 'BNB Chain',    description: 'BSC - Phí cực rẻ' },
  ];

  // Sao chép địa chỉ ví nhanh
  public copyAddress(event: Event) {
    event.stopPropagation();
    const address = this.stateService.address();
    if (address) {
      navigator.clipboard.writeText(address);
      this.stateService.showToast('Đã sao chép địa chỉ ví vào clipboard!', 'success');
    }
  }

  // Gửi ETH thông qua Ethers v6 Signer
  public async sendTransaction() {
    const to = String(this.toAddress() || '').trim();
    const val = String(this.amount() || '').trim();

    if (!to || !val) {
      this.stateService.showToast(`Vui lòng điền đầy đủ địa chỉ nhận và số lượng ${this.stateService.chainSymbol()}.`, 'error');
      return;
    }

    this.txLoading.set(true);
    this.txHash.set(null);
    this.txError.set(null);
    this.stateService.showToast('Đang gửi yêu cầu giao dịch đến ví...', 'warning');

    try {
      const signer = await this.stateService.getSigner();
      
      // Thực hiện gửi giao dịch với cấu hình phí gas động
      const overrides = await this.stateService.getGasOverrides(signer);
      const txRequest: any = {
        to,
        value: parseEther(val),
        data: '0x', // Đảm bảo trường data luôn là '0x' để tránh lỗi của một số ví di động như Trust Wallet
        chainId: this.stateService.chainId() ? Number(this.stateService.chainId()) : undefined,
        ...overrides
      };

      const tx = await signer.sendTransaction(txRequest);
      
      this.txHash.set(tx.hash);
      this.stateService.showToast('Giao dịch đã được phát đi! Đang chờ xác nhận...', 'warning');
      
      // Đợi giao dịch được khai thác trên mạng (mined) và cập nhật số dư mới
      await tx.wait();
      await this.stateService.web3Service.updateBalanceAndNetwork();
      this.stateService.showToast(`Giao dịch chuyển ${this.stateService.chainSymbol()} đã thành công!`, 'success');
      
      // Reset form
      this.toAddress.set('');
      this.amount.set('');
    } catch (err: any) {
      console.error('Lỗi khi gửi giao dịch:', err);
      const errMsg = err.reason || err.message || 'Lỗi không xác định xảy ra.';
      this.txError.set(errMsg);
      this.stateService.showToast('Giao dịch thất bại: ' + errMsg, 'error');
    } finally {
      this.txLoading.set(false);
    }
  }

  // Ký tin nhắn bảo mật thông qua ví
  public async signMessage() {
    const msg = String(this.messageToSign() || '').trim();
    if (!msg) {
      this.stateService.showToast('Vui lòng nhập nội dung tin nhắn cần ký.', 'error');
      return;
    }

    this.signLoading.set(true);
    this.signature.set(null);
    this.signError.set(null);
    this.stateService.showToast('Đang yêu cầu ký tin nhắn...', 'warning');

    try {
      const signer = await this.stateService.getSigner();
      const sig = await signer.signMessage(msg);
      this.signature.set(sig);
      this.stateService.showToast('Đã ký tin nhắn thành công!', 'success');
    } catch (err: any) {
      console.error('Lỗi khi ký tin nhắn:', err);
      const errMsg = err.message || 'Lỗi không xác định xảy ra khi ký.';
      this.signError.set(errMsg);
      this.stateService.showToast('Ký tin nhắn thất bại: ' + errMsg, 'error');
    } finally {
      this.signLoading.set(false);
    }
  }

  // Sao chép chữ ký vào Clipboard
  public copySignature() {
    if (this.signature()) {
      navigator.clipboard.writeText(this.signature()!);
      this.stateService.showToast('Đã sao chép chữ ký vào bộ nhớ tạm!', 'success');
    }
  }

  // Mở Modal Demo Form động
  public openDemoModal(): void {
    const ref = this.modalService.open(DemoModalComponent, {
      title: 'Demo Form Components',
      size: 'xl',
      closeOnBackdropClick: true
    });

    ref.afterClosed$.subscribe(result => {
      if (result) {
        this.stateService.showToast(
          `Xác nhận form! Date: ${result.date || '(chưa chọn)'}, Select: ${result.select || '(chưa chọn)'}`,
          'success'
        );
      }
    });
  }
}
