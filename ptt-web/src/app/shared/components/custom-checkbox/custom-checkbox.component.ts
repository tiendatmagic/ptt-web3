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
 * Custom Checkbox Component dùng chung tích hợp ControlValueAccessor.
 *
 * Sử dụng:
 *   <app-custom-checkbox [(ngModel)]="agreeTerms" label="Tôi đồng ý" />
 *   <app-custom-checkbox [checked]="agreeTerms" (checkedChange)="agreeTerms = $event" label="Tôi đồng ý" />
 */
@Component({
  selector: 'app-custom-checkbox',
  
  imports: [CommonModule, FormsModule],
  templateUrl: './custom-checkbox.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomCheckboxComponent),
      multi: true},
  ],
  
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ]})
export class CustomCheckboxComponent implements ControlValueAccessor {
  public readonly checked = signal<boolean>(false);

  @Input() label: string = '';
  @Input() description: string = '';
  @Input() disabled: boolean = false;

  @Input('checked') set setChecked(value: boolean) {
    this.checked.set(!!value);
  }

  @Output() checkedChange = new EventEmitter<boolean>();

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  public toggleChecked(): void {
    if (this.disabled) return;
    const nextVal = !this.checked();
    this.checked.set(nextVal);
    this.checkedChange.emit(nextVal);
    this.onChange(nextVal);
    this.onTouched();
  }

  // ControlValueAccessor
  public writeValue(value: any): void {
    this.checked.set(!!value);
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
