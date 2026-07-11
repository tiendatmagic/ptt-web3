import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  HostListener,
  inject,
  signal,
  computed,
  forwardRef,
  ViewChild,
  AfterViewChecked,
  OnInit,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

/**
 * Custom Date Picker Component chất lượng cao, fixed positioning thoát overflow.
 * Hỗ trợ minDate, maxDate, quick-select presets, smart placement.
 *
 * Sử dụng:
 *   <app-custom-date-picker [(ngModel)]="selectedDate" label="Ngày bắt đầu" />
 *   <app-custom-date-picker [(ngModel)]="date" [minDate]="today" [showPresets]="true" />
 */
@Component({
  selector: 'app-custom-date-picker',
  host: {
    '(document:click)': 'onClickOutside($event)'
  },
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './custom-date-picker.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomDatePickerComponent),
      multi: true
    }
  ],
  styles: [
    `
      :host {
        display: block;
      }
    `
  ]
})
export class CustomDatePickerComponent implements ControlValueAccessor, AfterViewChecked, OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private scrollListener: any;

  ngOnInit(): void {
    this.scrollListener = () => {
      if (this.isOpen()) {
        this.updatePopoverPosition();
        this.cdr.detectChanges();
      }
    };
    window.addEventListener('scroll', this.scrollListener, true);
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener, true);
    }
  }

  @Input() placeholder: string = 'Chọn ngày...';
  @Input() disabled: boolean = false;
  @Input() minDate: string = ''; // YYYY-MM-DD
  @Input() maxDate: string = ''; // YYYY-MM-DD
  @Input() showPresets: boolean = true; // Hiển thị nút quick-select

  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('triggerDiv', { static: false }) triggerDiv!: ElementRef<HTMLDivElement>;

  public readonly value = signal<string>('');
  public readonly isOpen = signal<boolean>(false);

  public readonly currentYear = signal<number>(new Date().getFullYear());
  public readonly currentMonth = signal<number>(new Date().getMonth());

  public readonly weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  public popoverStyle: { [key: string]: string } = {};

  public readonly presets = [
    { label: '7 ngày', days: 7 },
    { label: '1 tháng', days: 30 },
    { label: '3 tháng', days: 90 },
    { label: '6 tháng', days: 180 },
    { label: '1 năm', days: 365 },
  ];

  public readonly displayValue = computed(() => {
    const val = this.value();
    if (!val) return '';
    const parts = val.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return val;
  });

  public readonly calendarDays = computed(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay();
    const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    const startDate = new Date(year, month, 1 - offset);

    const daysArray: Date[] = [];
    for (let i = 0; i < 42; i++) {
      daysArray.push(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i));
    }
    return daysArray;
  });

  public readonly currentMonthName = computed(() => {
    const monthNames = [
      'Tháng 01', 'Tháng 02', 'Tháng 03', 'Tháng 04', 'Tháng 05', 'Tháng 06',
      'Tháng 07', 'Tháng 08', 'Tháng 09', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];
    return monthNames[this.currentMonth()];
  });

  public onClickOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      const popover = document.querySelector('.date-picker-popover');
      if (popover && popover.contains(event.target as Node)) return;
      this.isOpen.set(false);
    }
  }

  public toggleOpen(): void {
    if (this.disabled) return;
    const nextState = !this.isOpen();
    this.isOpen.set(nextState);
    if (nextState) {
      const dateVal = this.parseDate(this.value());
      const baseDate = dateVal || new Date();
      this.currentYear.set(baseDate.getFullYear());
      this.currentMonth.set(baseDate.getMonth());
      this.updatePopoverPosition();
    }
  }

  private updatePopoverPosition(): void {
    const triggerEl = this.triggerDiv?.nativeElement;
    if (!triggerEl) return;

    const rect = triggerEl.getBoundingClientRect();
    const popoverHeight = this.showPresets ? 380 : 340;
    const popoverWidth = 300;
    const gap = 6;

    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;

    let placeBottom = true;
    if (spaceBelow >= popoverHeight) {
      placeBottom = true;
    } else if (spaceAbove >= popoverHeight) {
      placeBottom = false;
    } else {
      placeBottom = spaceBelow >= spaceAbove;
    }

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 8) {
      left = rect.right - popoverWidth;
    }
    if (left < 8) left = 8;

    let top = 0;
    if (placeBottom) {
      top = rect.bottom + gap;
      if (top + popoverHeight > window.innerHeight - 8) {
        top = window.innerHeight - 8 - popoverHeight;
      }
      if (top < 8) top = 8;
    } else {
      top = rect.top - gap - popoverHeight;
      if (top < 8) {
        top = 8;
      }
      if (top + popoverHeight > window.innerHeight - 8) {
        top = window.innerHeight - 8 - popoverHeight;
      }
    }

    this.popoverStyle = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${popoverWidth}px`,
      zIndex: '9999',
    };
  }

  ngAfterViewChecked(): void {
    if (this.isOpen() && this.triggerDiv) {
      this.updatePopoverPosition();
    }
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onWindowChange(): void {
    if (this.isOpen()) {
      this.updatePopoverPosition();
    }
  }

  public prevMonth(event: Event): void {
    event.stopPropagation();
    const current = this.currentMonth();
    if (current === 0) {
      this.currentMonth.set(11);
      this.currentYear.update(y => y - 1);
    } else {
      this.currentMonth.set(current - 1);
    }
  }

  public nextMonth(event: Event): void {
    event.stopPropagation();
    const current = this.currentMonth();
    if (current === 11) {
      this.currentMonth.set(0);
      this.currentYear.update(y => y + 1);
    } else {
      this.currentMonth.set(current + 1);
    }
  }

  public selectDate(date: Date, event: Event): void {
    event.stopPropagation();
    if (this.isDateDisabled(date)) return;

    const formatted = this.formatDate(date);
    this.value.set(formatted);
    this.valueChange.emit(formatted);
    this.onChange(formatted);
    this.onTouched();
    this.isOpen.set(false);
  }

  /** Chọn nhanh preset (tính từ hôm nay) */
  public selectPreset(days: number, event: Event): void {
    event.stopPropagation();
    const target = new Date();
    target.setDate(target.getDate() + days);
    const formatted = this.formatDate(target);
    this.value.set(formatted);
    this.valueChange.emit(formatted);
    this.onChange(formatted);
    this.onTouched();
    this.isOpen.set(false);
  }

  public isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }

  public isSelected(date: Date): boolean {
    const val = this.value();
    if (!val) return false;
    return val === this.formatDate(date);
  }

  public isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.currentMonth();
  }

  /** Kiểm tra ngày có bị vô hiệu bởi minDate/maxDate */
  public isDateDisabled(date: Date): boolean {
    if (this.minDate) {
      const min = this.parseDate(this.minDate);
      if (min) {
        // So sánh theo ngày (bỏ giờ phút giây)
        const minDay = new Date(min.getFullYear(), min.getMonth(), min.getDate());
        const checkDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        if (checkDay.getTime() < minDay.getTime()) return true;
      }
    }
    if (this.maxDate) {
      const max = this.parseDate(this.maxDate);
      if (max) {
        const maxDay = new Date(max.getFullYear(), max.getMonth(), max.getDate());
        const checkDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        if (checkDay.getTime() > maxDay.getTime()) return true;
      }
    }
    return false;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDate(str: string): Date | null {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  /** Helper: Lấy ngày hôm nay dạng YYYY-MM-DD */
  public static todayString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ControlValueAccessor
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  public writeValue(value: any): void {
    this.value.set(value ? String(value) : '');
  }

  public registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
