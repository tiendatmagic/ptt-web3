import { Component, Input, Output, EventEmitter, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Custom Input component hỗ trợ text, number, email, password và textarea.
 * Tự động đồng bộ kích thước và bo góc chuẩn với hệ thống button/select.
 */
@Component({
  selector: 'app-custom-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './custom-input.component.html',
  styleUrls: ['./custom-input.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomInputComponent),
      multi: true
    }
  ]
})
export class CustomInputComponent implements ControlValueAccessor {
  public readonly val = signal<any>('');

  @Input() type: 'text' | 'number' | 'email' | 'password' | 'textarea' = 'text';
  @Input() placeholder: string = '';
  @Input() disabled: boolean = false;
  @Input() rows: number = 3;
  @Input() min: number | string = '';
  @Input() max: number | string = '';
  @Input() step: number | string = '';
  @Input() name: string = '';
  @Input() customClass: string = '';

  @Output() valueChange = new EventEmitter<any>();

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  public onInput(event: Event): void {
    if (this.disabled) return;
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.updateValue(value);
  }

  private updateValue(value: any): void {
    this.val.set(value);
    this.onChange(value);
    this.onTouched();
    this.valueChange.emit(value);
  }

  // ControlValueAccessor
  public writeValue(value: any): void {
    this.val.set(value === null || value === undefined ? '' : value);
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
