import { Component, Input } from '@angular/core';

/**
 * Card container tái sử dụng toàn hệ thống.
 *
 * Sử dụng:
 *   <div app-card>...</div>
 *   <app-card>...</app-card>
 *   <app-card [interactive]="true">...</app-card>
 */
@Component({
  selector: 'app-card, [app-card]',
  
  template: `<ng-content></ng-content>`,
  host: {
    '[class.app-card]': '!interactive',
    '[class.app-card-interactive]': 'interactive'},
  
  styles: [
    `
      :host:not(.flex):not(.grid):not(.inline-block):not(.inline-flex):not(.hidden) {
        display: block;
      }
    `,
  ]})
export class CardComponent {
  /** Nếu true, thêm hiệu ứng hover/scale cho card có thể click */
  @Input() interactive = false;
}
