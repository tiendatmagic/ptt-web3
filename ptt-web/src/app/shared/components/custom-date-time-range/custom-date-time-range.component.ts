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

export interface DateTimeRangeValue {
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'app-custom-date-time-range',
  host: {
    '(document:click)': 'onClickOutside($event)'
  },
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './custom-date-time-range.component.html',
  styleUrl: './custom-date-time-range.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomDateTimeRangeComponent),
      multi: true
    }
  ]
})
export class CustomDateTimeRangeComponent implements ControlValueAccessor, AfterViewChecked, OnInit, OnDestroy {
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

  @Input() placeholder: string = 'Chọn khoảng thời gian...';
  @Input() disabled: boolean = false;
  @Input() showTime: boolean = false; // Bật chế độ chọn Giờ:Phút
  @Input() showPresets: boolean = false; // Bật thanh chọn nhanh
  @Input() minDate: string = ''; // YYYY-MM-DD
  @Input() maxDate: string = ''; // YYYY-MM-DD

  @Output() valueChange = new EventEmitter<DateTimeRangeValue>();

  @ViewChild('triggerDiv', { static: false }) triggerDiv!: ElementRef<HTMLDivElement>;

  // Model value chính thức
  public readonly value = signal<DateTimeRangeValue>({ startDate: '', endDate: '' });
  public readonly isOpen = signal<boolean>(false);

  // Trạng thái tháng/năm đang xem trên lịch
  public readonly currentYear = signal<number>(new Date().getFullYear());
  public readonly currentMonth = signal<number>(new Date().getMonth());

  // Trạng thái tạm thời phục vụ chọn và hover trên popup
  public readonly tempStartDate = signal<string>('');
  public readonly tempEndDate = signal<string>('');
  public readonly tempStartTime = signal<string>('00:00');
  public readonly tempEndTime = signal<string>('23:59');
  public readonly hoveredDate = signal<Date | null>(null);

  // Bộ chọn giờ và phút tùy chỉnh (100% Custom UI)
  public readonly hoursArray = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  public readonly minutesArray = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  
  public readonly startHour = signal<string>('00');
  public readonly startMinute = signal<string>('00');
  public readonly endHour = signal<string>('23');
  public readonly endMinute = signal<string>('59');

  // Trạng thái hiển thị dropdown giờ/phút tùy chỉnh
  public readonly showStartHourDropdown = signal<boolean>(false);
  public readonly showStartMinuteDropdown = signal<boolean>(false);
  public readonly showEndHourDropdown = signal<boolean>(false);
  public readonly showEndMinuteDropdown = signal<boolean>(false);

  public readonly weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  public popoverStyle: { [key: string]: string } = {};

  // Khai báo các Presets chọn nhanh
  public readonly presets = [
    { label: 'Hôm nay', id: 'today' },
    { label: 'Hôm qua', id: 'yesterday' },
    { label: '7 ngày qua', id: 'last_7_days' },
    { label: '30 ngày qua', id: 'last_30_days' },
    { label: 'Tháng này', id: 'this_month' }
  ];

  // Chuỗi hiển thị trên ô nhập trigger
  public readonly displayValue = computed(() => {
    const val = this.value();
    if (!val.startDate) return '';
    
    const formatStr = (str: string) => {
      if (!str) return '';
      const parts = str.split(' ');
      const datePart = parts[0];
      const timePart = parts[1] || '';
      
      const dParts = datePart.split('-');
      if (dParts.length === 3) {
        const dateFormatted = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
        return timePart ? `${dateFormatted} ${timePart}` : dateFormatted;
      }
      return str;
    };

    const start = formatStr(val.startDate);
    const end = formatStr(val.endDate);

    if (start && end) {
      return `${start} - ${end}`;
    }
    return start || '';
  });

  // Mảng 42 ngày tính toán động hiển thị trên lịch
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
      const popover = document.querySelector('.date-time-range-popover');
      if (popover && popover.contains(event.target as Node)) return;
      if (this.isOpen()) {
        this.cancel();
      }
    }
  }

  public toggleOpen(): void {
    if (this.disabled) return;
    const nextState = !this.isOpen();
    if (nextState) {
      this.openPopover();
    } else {
      this.cancel();
    }
  }

  private openPopover(): void {
    const val = this.value();
    
    // Phân rã giá trị hiện có để gán vào các biến temp
    if (val.startDate) {
      const startParts = val.startDate.split(' ');
      this.tempStartDate.set(startParts[0]);
      if (startParts[1]) {
        this.tempStartTime.set(startParts[1]);
        const timeParts = startParts[1].split(':');
        this.startHour.set(timeParts[0] || '00');
        this.startMinute.set(timeParts[1] || '00');
      } else {
        this.tempStartTime.set('00:00');
        this.startHour.set('00');
        this.startMinute.set('00');
      }
      
      if (val.endDate) {
        const endParts = val.endDate.split(' ');
        this.tempEndDate.set(endParts[0]);
        if (endParts[1]) {
          this.tempEndTime.set(endParts[1]);
          const timeParts = endParts[1].split(':');
          this.endHour.set(timeParts[0] || '23');
          this.endMinute.set(timeParts[1] || '59');
        } else {
          this.tempEndTime.set('23:59');
          this.endHour.set('23');
          this.endMinute.set('59');
        }
      } else {
        this.tempEndDate.set('');
        this.tempEndTime.set('23:59');
        this.endHour.set('23');
        this.endMinute.set('59');
      }
    } else {
      this.tempStartDate.set('');
      this.tempEndDate.set('');
      this.tempStartTime.set('00:00');
      this.tempEndTime.set('23:59');
      this.startHour.set('00');
      this.startMinute.set('00');
      this.endHour.set('23');
      this.endMinute.set('59');
    }

    const baseDateStr = this.tempStartDate() || this.formatDate(new Date());
    const baseDate = this.parseDate(baseDateStr) || new Date();
    this.currentYear.set(baseDate.getFullYear());
    this.currentMonth.set(baseDate.getMonth());
    this.hoveredDate.set(null);
    this.closeAllTimeDropdowns();
    this.isOpen.set(true);
    this.updatePopoverPosition();
  }

  private updatePopoverPosition(): void {
    const triggerEl = this.triggerDiv?.nativeElement;
    if (!triggerEl) return;

    const rect = triggerEl.getBoundingClientRect();
    // Kích thước popover thực tế: chiều rộng ~320px, chiều cao ~433px (không time) hoặc ~500px (kèm time)
    const popoverHeight = this.showTime ? 510 : 440;
    const popoverWidth = 320;
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
    this.closeAllTimeDropdowns();
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
    this.closeAllTimeDropdowns();
  }

  public selectDate(date: Date, event: Event): void {
    event.stopPropagation();
    if (this.isDateDisabled(date)) return;

    const formatted = this.formatDate(date);
    const start = this.tempStartDate();
    const end = this.tempEndDate();

    if (!start || (start && end)) {
      // Bấm lần 1 hoặc reset để chọn mới
      this.tempStartDate.set(formatted);
      this.tempEndDate.set('');
    } else {
      // Đã có startDate, bấm chọn endDate
      const startDateObj = this.parseDate(start);
      if (startDateObj && date >= startDateObj) {
        this.tempEndDate.set(formatted);
      } else {
        // Nếu click ngày trước startDate, đảo ngày đó làm startDate mới
        this.tempStartDate.set(formatted);
        this.tempEndDate.set('');
      }
    }
    this.closeAllTimeDropdowns();
  }

  public onDateHover(date: Date): void {
    if (this.tempStartDate() && !this.tempEndDate()) {
      this.hoveredDate.set(date);
    } else {
      this.hoveredDate.set(null);
    }
  }

  // --- Logic điều khiển Custom Time Dropdowns ---

  public toggleDropdown(type: 'startHour' | 'startMinute' | 'endHour' | 'endMinute', event: Event): void {
    event.stopPropagation();
    
    const showSH = this.showStartHourDropdown();
    const showSM = this.showStartMinuteDropdown();
    const showEH = this.showEndHourDropdown();
    const showEM = this.showEndMinuteDropdown();

    this.closeAllTimeDropdowns();

    if (type === 'startHour') this.showStartHourDropdown.set(!showSH);
    if (type === 'startMinute') this.showStartMinuteDropdown.set(!showSM);
    if (type === 'endHour') this.showEndHourDropdown.set(!showEH);
    if (type === 'endMinute') this.showEndMinuteDropdown.set(!showEM);
  }

  public closeAllTimeDropdowns(): void {
    this.showStartHourDropdown.set(false);
    this.showStartMinuteDropdown.set(false);
    this.showEndHourDropdown.set(false);
    this.showEndMinuteDropdown.set(false);
  }

  public selectTimeValue(type: 'startHour' | 'startMinute' | 'endHour' | 'endMinute', val: string, event: Event): void {
    event.stopPropagation();
    if (type === 'startHour') this.startHour.set(val);
    if (type === 'startMinute') this.startMinute.set(val);
    if (type === 'endHour') this.endHour.set(val);
    if (type === 'endMinute') this.endMinute.set(val);
    
    this.onTimeChange();
    this.closeAllTimeDropdowns();
  }

  public onTimeChange(): void {
    this.tempStartTime.set(`${this.startHour()}:${this.startMinute()}`);
    this.tempEndTime.set(`${this.endHour()}:${this.endMinute()}`);
  }

  public apply(event?: Event): void {
    if (event) event.stopPropagation();

    const start = this.tempStartDate();
    let end = this.tempEndDate();
    
    if (!start) return;
    if (!end) end = start; // Nếu chưa chọn ngày kết thúc, mặc định lấy trùng ngày bắt đầu

    let finalStart = start;
    let finalEnd = end;

    if (this.showTime) {
      this.onTimeChange(); // Đảm bảo giờ phút đồng bộ mới nhất
      finalStart = `${start} ${this.tempStartTime()}`;
      finalEnd = `${end} ${this.tempEndTime()}`;
    }

    const newValue: DateTimeRangeValue = {
      startDate: finalStart,
      endDate: finalEnd
    };

    this.value.set(newValue);
    this.valueChange.emit(newValue);
    this.onChange(newValue);
    this.onTouched();
    this.closeAllTimeDropdowns();
    this.isOpen.set(false);
  }

  public cancel(event?: Event): void {
    if (event) event.stopPropagation();
    this.closeAllTimeDropdowns();
    this.isOpen.set(false);
  }

  public clear(event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;

    const emptyValue: DateTimeRangeValue = { startDate: '', endDate: '' };
    this.value.set(emptyValue);
    this.valueChange.emit(emptyValue);
    this.onChange(emptyValue);
    this.onTouched();
    
    this.tempStartDate.set('');
    this.tempEndDate.set('');
    this.closeAllTimeDropdowns();
    this.isOpen.set(false);
  }

  // Xử lý các Preset chọn nhanh
  public selectPreset(presetId: string, event: Event): void {
    event.stopPropagation();
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (presetId) {
      case 'today':
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        this.startHour.set('00');
        this.startMinute.set('00');
        this.endHour.set('23');
        this.endMinute.set('59');
        this.tempStartTime.set('00:00');
        this.tempEndTime.set('23:59');
        break;
      case 'yesterday':
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        this.startHour.set('00');
        this.startMinute.set('00');
        this.endHour.set('23');
        this.endMinute.set('59');
        this.tempStartTime.set('00:00');
        this.tempEndTime.set('23:59');
        break;
      case 'last_7_days':
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        this.startHour.set('00');
        this.startMinute.set('00');
        this.endHour.set('23');
        this.endMinute.set('59');
        this.tempStartTime.set('00:00');
        this.tempEndTime.set('23:59');
        break;
      case 'last_30_days':
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        this.startHour.set('00');
        this.startMinute.set('00');
        this.endHour.set('23');
        this.endMinute.set('59');
        this.tempStartTime.set('00:00');
        this.tempEndTime.set('23:59');
        break;
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        this.startHour.set('00');
        this.startMinute.set('00');
        this.endHour.set('23');
        this.endMinute.set('59');
        this.tempStartTime.set('00:00');
        this.tempEndTime.set('23:59');
        break;
    }

    this.tempStartDate.set(this.formatDate(start));
    this.tempEndDate.set(this.formatDate(end));
    
    // Tự động lưu và đóng luôn khi bấm preset chọn nhanh
    this.apply();
  }

  // --- Helpers So Sánh & Trạng Thái Trực Quan Lịch ---
  
  public isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }

  public isStart(date: Date): boolean {
    return this.tempStartDate() === this.formatDate(date);
  }

  public isEnd(date: Date): boolean {
    return this.tempEndDate() === this.formatDate(date);
  }

  public isInRange(date: Date): boolean {
    const start = this.tempStartDate();
    const end = this.tempEndDate();
    if (!start || !end) return false;

    const checkTime = this.clearTime(date).getTime();
    const startTime = this.parseDate(start)!.getTime();
    const endTime = this.parseDate(end)!.getTime();

    return checkTime > startTime && checkTime < endTime;
  }

  public isHoverRange(date: Date): boolean {
    const start = this.tempStartDate();
    const end = this.tempEndDate();
    const hover = this.hoveredDate();
    if (!start || end || !hover) return false;

    const checkTime = this.clearTime(date).getTime();
    const startTime = this.parseDate(start)!.getTime();
    const hoverTime = this.clearTime(hover).getTime();

    if (hoverTime >= startTime) {
      return checkTime > startTime && checkTime < hoverTime;
    } else {
      return checkTime > hoverTime && checkTime < startTime;
    }
  }

  public isHoverEndDate(date: Date): boolean {
    const start = this.tempStartDate();
    const end = this.tempEndDate();
    const hover = this.hoveredDate();
    if (!start || end || !hover) return false;

    const checkTime = this.clearTime(date).getTime();
    const startTime = this.parseDate(start)!.getTime();
    const hoverTime = this.clearTime(hover).getTime();

    return checkTime === hoverTime && hoverTime > startTime;
  }

  public isHoverStartDate(date: Date): boolean {
    const start = this.tempStartDate();
    const end = this.tempEndDate();
    const hover = this.hoveredDate();
    if (!start || end || !hover) return false;

    const checkTime = this.clearTime(date).getTime();
    const startTime = this.parseDate(start)!.getTime();
    const hoverTime = this.clearTime(hover).getTime();

    return checkTime === hoverTime && hoverTime < startTime;
  }

  private clearTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  public getHighlightClass(date: Date): string {
    const start = this.tempStartDate();
    const end = this.tempEndDate();
    const hover = this.hoveredDate();
    
    if (!start) return 'hidden';
    
    const dTime = this.clearTime(date).getTime();
    const sTime = this.parseDate(start)!.getTime();
    const eTime = end ? this.parseDate(end)!.getTime() : null;
    const hTime = hover ? this.clearTime(hover).getTime() : null;
    
    // Xác định ngày bắt đầu và kết thúc thực tế của dải highlight (chọn chính thức hoặc đang hover)
    let rangeStart = sTime;
    let rangeEnd = eTime;
    
    if (!end && hTime !== null) {
      if (hTime >= sTime) {
        rangeEnd = hTime;
      } else {
        rangeStart = hTime;
        rangeEnd = sTime;
      }
    }
    
    // Nếu ngày nằm ngoài dải highlight thì không vẽ
    if (rangeEnd === null) {
      if (dTime !== sTime) return 'hidden';
    } else {
      if (dTime < rangeStart || dTime > rangeEnd) return 'hidden';
    }
    
    // Tính toán bo góc cho ngày nằm TRONG dải highlight:
    if (rangeEnd === null || rangeStart === rangeEnd) {
      // Chỉ có 1 ngày duy nhất được highlight
      return 'rounded-full w-full';
    }
    
    if (dTime === rangeStart) {
      // Đầu bắt đầu: bo góc trái
      return 'rounded-l-full w-full';
    }
    
    if (dTime === rangeEnd) {
      // Đầu kết thúc: bo góc phải
      return 'rounded-r-full w-full';
    }
    
    // Các ngày ở giữa: không bo góc, rộng 100%
    return 'w-full';
  }

  public isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.currentMonth();
  }

  public isDateDisabled(date: Date): boolean {
    if (this.minDate) {
      const min = this.parseDate(this.minDate);
      if (min) {
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

  // --- ControlValueAccessor Implementation ---
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  public writeValue(value: any): void {
    if (value && typeof value === 'object' && 'startDate' in value && 'endDate' in value) {
      this.value.set(value);
    } else {
      this.value.set({ startDate: '', endDate: '' });
    }
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
