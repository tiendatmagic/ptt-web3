import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChildren,
  QueryList,
  AfterViewInit,
  HostListener,
  ViewChild,
  signal,
  OnChanges,
  SimpleChanges,
  OnDestroy} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';

export interface TabOption {
  value: any;
  label: string;
  icon?: string;
  badge?: string | number;
  dotClass?: string;
}

@Component({
  selector: 'app-tab-group',
  host: {
    '(window:resize)': 'onResize()'
  },
  
  imports: [CommonModule, IconComponent],
  templateUrl: './tab-group.component.html',
  
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ]})
export class TabGroupComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** Danh sách các lựa chọn tab */
  @Input() options: TabOption[] = [];

  /** Giá trị active hiện tại */
  @Input() activeValue: any = null;

  /** Class CSS tùy chỉnh cho container */
  @Input() containerClass: string = '';

  /** Class CSS tùy chỉnh cho các nút bấm tab (để tùy chỉnh padding, width, v.v.) */
  @Input() buttonClass: string = '';

  /** Class CSS tùy chỉnh cho thẻ span nhãn chữ (ví dụ ẩn chữ trên desktop) */
  @Input() labelClass: string = '';

  /** Cho phép các tab tự động chia đều chiều rộng (flex-1). Mặc định là true. */
  @Input() flex: boolean = true;

  /** Sự kiện phát ra khi thay đổi tab */
  @Output() valueChange = new EventEmitter<any>();

  @ViewChild('containerEl') containerEl!: ElementRef<HTMLDivElement>;
  @ViewChildren('tabBtn') tabButtons!: QueryList<ElementRef<HTMLButtonElement>>;

  private resizeObserver?: ResizeObserver;

  /** Trạng thái vị trí và kích thước của slider */
  public readonly sliderStyle = signal<{ left: string; width: string }>({
    left: '0px',
    width: '0px'});

  public get activeIndex(): number {
    return this.options.findIndex((opt) => opt.value === this.activeValue);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateSliderPosition(), 50);

    if (typeof ResizeObserver !== 'undefined' && this.containerEl) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateSliderPosition();
      });
      this.resizeObserver.observe(this.containerEl.nativeElement);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeValue'] || changes['options']) {
      setTimeout(() => this.updateSliderPosition(), 0);
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  onResize(): void {
    this.updateSliderPosition();
  }

  public onSelect(value: any): void {
    if (value !== this.activeValue) {
      this.valueChange.emit(value);
      this.activeValue = value;
      this.updateSliderPosition();
    }
  }

  public updateSliderPosition(): void {
    if (!this.tabButtons || !this.containerEl) return;

    const buttons = this.tabButtons.toArray();
    const activeIdx = this.activeIndex;

    if (activeIdx !== -1 && buttons[activeIdx]) {
      const activeEl = buttons[activeIdx].nativeElement;
      const nextLeft = `${activeEl.offsetLeft}px`;
      const nextWidth = `${activeEl.offsetWidth}px`;

      const current = this.sliderStyle();
      if (current.left !== nextLeft || current.width !== nextWidth) {
        this.sliderStyle.set({ left: nextLeft, width: nextWidth });
      }

      // Tự động cuộn container để hiển thị tab active nếu bị che khuất
      const container = this.containerEl.nativeElement;
      const scrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;
      const buttonLeft = activeEl.offsetLeft;
      const buttonWidth = activeEl.offsetWidth;

      if (buttonLeft < scrollLeft) {
        container.scrollTo({ left: buttonLeft - 8, behavior: 'smooth' });
      } else if (buttonLeft + buttonWidth > scrollLeft + containerWidth) {
        container.scrollTo({ left: buttonLeft + buttonWidth - containerWidth + 8, behavior: 'smooth' });
      }
    } else {
      const current = this.sliderStyle();
      if (current.left !== '0px' || current.width !== '0px') {
        this.sliderStyle.set({ left: '0px', width: '0px' });
      }
    }
  }
}
