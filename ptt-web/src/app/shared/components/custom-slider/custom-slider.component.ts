import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Custom Slider Component dùng chung tích hợp ControlValueAccessor.
 *
 * Sử dụng:
 *   <app-custom-slider [(ngModel)]="value" [min]="0" [max]="100" [step]="5" [marks]="true" label="Độ ưu tiên" />
 */
@Component({
  selector: 'app-custom-slider',
  imports: [CommonModule, FormsModule],
  templateUrl: './custom-slider.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSliderComponent),
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
export class CustomSliderComponent implements ControlValueAccessor {
  public readonly value = signal<number>(0);

  @Input() min = 0;
  @Input() max = 100;
  @Input() step = 1;
  @Input() disabled = false;
  @Input() marks = false;
  @Input() color: 'primary' | 'secondary' | 'neutral' = 'primary';

  @Input('value') set setValue(val: number) {
    this.value.set(Number(val) || 0);
  }

  @Output() valueChange = new EventEmitter<number>();

  public readonly percentage = computed(() => {
    const val = this.value();
    const minVal = this.min;
    const maxVal = this.max;
    if (maxVal === minVal) return 0;
    const pct = ((val - minVal) / (maxVal - minVal)) * 100;
    return Math.max(0, Math.min(100, pct));
  });

  public readonly markPositions = computed(() => {
    if (!this.marks) return [];
    const stepsCount = (this.max - this.min) / this.step;
    if (stepsCount <= 0 || stepsCount > 40) return []; // Giới hạn mốc để tránh rối mắt

    const positions: number[] = [];
    for (let i = 0; i <= stepsCount; i++) {
      positions.push((i / stepsCount) * 100);
    }
    return positions;
  });

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  public onInput(event: Event): void {
    if (this.disabled) return;
    const val = Number((event.target as HTMLInputElement).value);
    this.value.set(val);
    this.valueChange.emit(val);
    this.onChange(val);
  }

  public onChangeEvent(event: Event): void {
    this.onTouched();
  }

  // Implementation of ControlValueAccessor
  writeValue(value: any): void {
    if (value !== undefined && value !== null) {
      this.value.set(Number(value));
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // CSS Class getters
  get filledTrackClass(): string {
    switch (this.color) {
      case 'primary':
        return 'bg-[var(--color-primary)]';
      case 'secondary':
        return 'bg-[var(--color-secondary)]';
      case 'neutral':
        return 'bg-slate-400 dark:bg-slate-500';
    }
  }

  get thumbClass(): string {
    switch (this.color) {
      case 'primary':
        return 'bg-[var(--color-primary)] hover:scale-110 active:scale-95 focus:ring-4 focus:ring-[var(--color-primary)]/20';
      case 'secondary':
        return 'bg-[var(--color-secondary)] hover:scale-110 active:scale-95 focus:ring-4 focus:ring-[var(--color-secondary)]/20';
      case 'neutral':
        return 'bg-slate-400 dark:bg-slate-500 hover:scale-110 active:scale-95 focus:ring-4 focus:ring-slate-500/20';
    }
  }

  get activeMarkClass(): string {
    switch (this.color) {
      case 'primary':
        return 'bg-white/80 dark:bg-[var(--color-primary)]/80';
      case 'secondary':
        return 'bg-white/80 dark:bg-[var(--color-secondary)]/80';
      case 'neutral':
        return 'bg-white/80 dark:bg-slate-400';
    }
  }

  get inactiveMarkClass(): string {
    return 'bg-slate-400/50 dark:bg-slate-600/50';
  }
}
