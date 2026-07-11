import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'button[app-button], a[app-button]',
  
  imports: [CommonModule],
  template: `
    @if (loading) {
      <div
        class="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"
      ></div>
    }
    <ng-content></ng-content>
  `,
  
  host: {
    '[class]': 'hostClasses',
    '[attr.disabled]': '(disabled || loading) ? "" : null',
    '[class.pointer-events-none]': 'loading || disabled'}})
export class ButtonComponent {
  @Input() variant:
    | 'primary'
    | 'secondary'
    | 'success'
    | 'danger'
    | 'danger-light'
    | 'cancel'
    | 'info' = 'primary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() loading = false;
  @Input() disabled = false;

  get hostClasses(): string {
    return `btn btn-${this.variant} btn-${this.size}`;
  }
}
