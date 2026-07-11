import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  signal,
  OnDestroy} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

/**
 * Custom Search Input với debounce, loading spinner, clear button.
 *
 * Sử dụng:
 *   <app-custom-search-input [(ngModel)]="query" (valueChange)="onSearch($event)" />
 *   <app-custom-search-input placeholder="Tìm kiếm..." [debounce]="300" [loading]="isLoading" />
 */
@Component({
  selector: 'app-custom-search-input',
  
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './custom-search-input.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSearchInputComponent),
      multi: true},
  ],
  
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ]})
export class CustomSearchInputComponent implements ControlValueAccessor, OnDestroy {
  public readonly val = signal<string>('');

  @Input() placeholder: string = 'Tìm kiếm...';
  @Input() disabled: boolean = false;
  @Input() clearable: boolean = true;
  @Input() containerClass: string = 'w-full';
  @Input() inputClass: string = 'w-full search-input';
  /** Thời gian debounce tính bằng ms (0 = tức thì) */
  @Input() debounce: number = 0;
  /** Hiển thị spinner loading */
  @Input() loading: boolean = false;

  @Output() valueChange = new EventEmitter<string>();

  private readonly valueSubject = new Subject<string>();
  private valueSubscription: Subscription | null = null;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    this.valueSubscription = this.valueSubject
      .pipe(debounceTime(this.debounce || 0))
      .subscribe((v) => {
        this.valueChange.emit(v);
      });
  }

  public onInput(event: Event): void {
    if (this.disabled) return;
    const value = (event.target as HTMLInputElement).value;
    this.updateValue(value);
  }

  public onClear(): void {
    if (this.disabled) return;
    this.updateValue('');
  }

  private updateValue(value: string): void {
    this.val.set(value);
    this.onChange(value);
    this.onTouched();
    this.valueSubject.next(value);
  }

  // ControlValueAccessor
  public writeValue(value: any): void {
    this.val.set(value || '');
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

  ngOnDestroy(): void {
    if (this.valueSubscription) {
      this.valueSubscription.unsubscribe();
    }
  }
}
