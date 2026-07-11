import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Component hiển thị phím tắt 3D.
 *
 * Sử dụng:
 *   <kbd app-kbd>Ctrl</kbd> + <kbd app-kbd>K</kbd>
 *   <app-kbd>⌘</app-kbd>
 */
@Component({
  selector: 'app-kbd, kbd[app-kbd]',
  imports: [CommonModule],
  templateUrl: './kbd.component.html',
  host: {
    'class': 'inline-flex items-center justify-center font-mono text-[10px] sm:text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-md px-1.5 py-0.5 shadow-[0_1.5px_0_0_rgba(148,163,184,0.6)] dark:shadow-[0_1.5px_0_0_rgba(3,7,18,0.8)] select-none min-h-[22px] min-w-[22px]'
  },
  styles: [
    `
      :host {
        display: inline-flex;
        line-height: 1;
      }
    `
  ]
})
export class KbdComponent {}
