import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Custom Radio Button component với ControlValueAccessor.
 *
 * Sử dụng:
 *   <app-custom-radio name="plan" value="free" label="Miễn phí" [(ngModel)]="selectedPlan" />
 *   <app-custom-radio name="plan" value="pro" [checked]="selectedPlan === 'pro'" (select)="selectedPlan = $event" />
 */
@Component({
  selector: 'app-custom-radio',
  
  imports: [CommonModule, FormsModule],
  templateUrl: './custom-radio.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomRadioComponent),
      multi: true},
  ],
  
  styles: [
    `
      :host {
        display: block;
      }
      @keyframes scaleUp {
        from { transform: scale(0); }
        to   { transform: scale(1); }
      }
      .animate-scale-up {
        animation: scaleUp 0.15s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
    `,
  ]})
export class CustomRadioComponent implements ControlValueAccessor {
  public readonly checked = signal<boolean>(false);

  @Input() value: any;
  @Input() name: string = '';
  @Input() label: string = '';
  @Input() description: string = '';
  @Input() disabled: boolean = false;

  @Input('checked') set setChecked(value: boolean) {
    this.checked.set(!!value);
  }

  @Output() checkedChange = new EventEmitter<boolean>();
  @Output() select = new EventEmitter<any>();

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  public onSelect(): void {
    if (this.disabled) return;
    this.checked.set(true);
    this.checkedChange.emit(true);
    this.select.emit(this.value);
    this.onChange(this.value);
    this.onTouched();
  }

  // ControlValueAccessor
  public writeValue(value: any): void {
    this.checked.set(value === this.value);
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
