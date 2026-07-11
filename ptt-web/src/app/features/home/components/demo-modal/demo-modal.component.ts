import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalRef } from '@core/services/modal-ref';
import { CustomDatePickerComponent } from '@shared/components/custom-date-picker/custom-date-picker.component';
import { CustomSelectComponent } from '@shared/components/custom-select/custom-select.component';
import { CustomSwitchComponent } from '@shared/components/custom-switch/custom-switch.component';
import { CustomRadioComponent } from '@shared/components/custom-radio/custom-radio.component';
import { CustomCheckboxComponent } from '@shared/components/custom-checkbox/custom-checkbox.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { CustomInputComponent } from '@shared/components/custom-input/custom-input.component';
import { AccordionComponent } from '@shared/components/accordion/accordion.component';
import { AccordionItemComponent } from '@shared/components/accordion/accordion-item.component';
import { KbdComponent } from '@shared/components/kbd/kbd.component';
import { TooltipDirective } from '@shared/components/tooltip/tooltip.directive';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { TabGroupComponent, TabOption } from '@shared/components/tab-group/tab-group.component';
import { CustomSliderComponent } from '@shared/components/custom-slider/custom-slider.component';
import { CustomDateTimeRangeComponent, DateTimeRangeValue } from '@shared/components/custom-date-time-range/custom-date-time-range.component';

@Component({
  selector: 'app-demo-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CustomDatePickerComponent,
    CustomSelectComponent,
    CustomSwitchComponent,
    CustomRadioComponent,
    CustomCheckboxComponent,
    IconComponent,
    ButtonComponent,
    CustomInputComponent,
    AccordionComponent,
    AccordionItemComponent,
    KbdComponent,
    TooltipDirective,
    BadgeComponent,
    TabGroupComponent,
    CustomSliderComponent,
    CustomDateTimeRangeComponent
  ],
  templateUrl: './demo-modal.component.html',
  styles: [
    `
      :host {
        display: block;
      }
    `
  ]
})
export class DemoModalComponent {
  private readonly modalRef = inject(ModalRef);

  // Form State Local
  public modalDateValue = signal('');
  public modalRangeValue = signal<DateTimeRangeValue>({ startDate: '', endDate: '' });
  public modalSelectValue = signal<string | null>(null);
  public modalSwitchValue = signal(false);
  public modalRadioValue = signal('arbitrum');
  public modalCheckboxValue = signal(false);
  public modalSliderValue = signal(3);

  // Trạng thái Demo Tab Group trong Modal
  public modalTabValue = signal('bsc');
  public readonly modalTabOptions: TabOption[] = [
    { value: 'ethereum', label: 'Ethereum', dotClass: 'bg-blue-500' },
    { value: 'arbitrum', label: 'Arbitrum', dotClass: 'bg-indigo-500' },
    { value: 'bsc', label: 'BNB Chain', dotClass: 'bg-amber-500' }
  ];

  // minDate & Presets configurations
  public readonly today = CustomDatePickerComponent.todayString();
  public limitDatePicker = signal(true); // Mặc định bật giới hạn
  public demoDatePickerMinDate = signal(this.today); // Mốc ngày minDate mặc định là hôm nay
  public limitDatePickerMax = signal(false); // Bật/tắt giới hạn ngày tối đa
  public demoDatePickerMaxDate = signal('2026-07-25'); // Mốc ngày maxDate mặc định (ví dụ: ngày 25)
  public demoDatePickerShowPresets = signal(true);

  public readonly demoChainOptions = [
    { value: '1',     label: 'Ethereum Mainnet' },
    { value: '42161', label: 'Arbitrum One' },
    { value: '56',    label: 'BNB Smart Chain' },
    { value: '421614',label: 'Arbitrum Sepolia' },
    { value: '97',    label: 'BSC Testnet' },
  ];

  public readonly demoRadioOptions = [
    { value: 'arbitrum', label: 'Arbitrum One', description: 'Layer 2 - Phí thấp, tốc độ cao' },
    { value: 'ethereum', label: 'Ethereum',     description: 'Mainnet - Bảo mật cao nhất' },
    { value: 'bsc',      label: 'BNB Chain',    description: 'BSC - Phí cực rẻ' },
  ];

  public cancel(): void {
    this.modalRef.close();
  }

  public confirm(): void {
    this.modalRef.close({
      date: this.modalDateValue(),
      select: this.modalSelectValue(),
      switch: this.modalSwitchValue(),
      radio: this.modalRadioValue(),
      checkbox: this.modalCheckboxValue(),
      tab: this.modalTabValue(),
      slider: this.modalSliderValue(),
      range: this.modalRangeValue()
    });
  }
}
