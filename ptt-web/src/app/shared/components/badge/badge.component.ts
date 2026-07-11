import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-badge, [app-badge]',
  
  imports: [CommonModule],
  template: `<ng-content></ng-content>`,
  host: {
    '[class]': 'hostClasses',
    '[class.animate-pulse]': 'pulse',
    '[class.cursor-pointer]': 'interactive',
    '[class.hover:opacity-85]': 'interactive',
    '[class.active:scale-95]': 'interactive',
    '[class.transition-all]': 'interactive'},
  
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        line-height: 1;
      }
    `,
  ]})
export class BadgeComponent {
  @Input() variant:
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'neutral'
    | 'ultra' = 'primary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() rounded: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'xl';
  @Input() pulse = false;
  @Input() interactive = false;

  get hostClasses(): string {
    const classes: string[] = ['select-none'];

    switch (this.variant) {
      case 'primary':
        classes.push(
          'bg-[var(--color-primary)]/10 dark:bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/20 dark:border-[var(--color-primary)]/30',
        );
        break;
      case 'secondary':
        classes.push(
          'bg-[var(--color-secondary)]/10 dark:bg-[var(--color-secondary)]/20 text-[var(--color-secondary)] dark:text-[color-mix(in srgb,var(--color-secondary)_80%,white)] border border-[var(--color-secondary)]/20 dark:border-[var(--color-secondary)]/30',
        );
        break;
      case 'success':
        classes.push(
          'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30',
        );
        break;
      case 'warning':
        classes.push(
          'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30',
        );
        break;
      case 'danger':
        classes.push(
          'bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/30',
        );
        break;
      case 'info':
        classes.push(
          'bg-[var(--color-secondary)]/8 dark:bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] dark:text-[color-mix(in srgb,var(--color-secondary)_80%,white)] border border-[var(--color-secondary)]/15 dark:border-[var(--color-secondary)]/25',
        );
        break;
      case 'neutral':
        classes.push(
          'bg-slate-150/90 dark:bg-slate-800/80 text-slate-650 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50',
        );
        break;
      case 'ultra':
        classes.push(
          'bg-gradient-to-r from-[var(--color-primary)]/15 to-[var(--color-secondary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/20 dark:border-[var(--color-primary)]/30 dark:text-white',
        );
        break;
    }

    switch (this.size) {
      case 'sm':
        classes.push('text-[10px] px-1.5 py-0.5');
        break;
      case 'md':
        classes.push('text-xs px-2.5 py-0.5');
        break;
      case 'lg':
        classes.push('text-sm px-3 py-1');
        break;
    }

    switch (this.rounded) {
      case 'sm':
        classes.push('rounded-sm');
        break;
      case 'md':
        classes.push('rounded-md');
        break;
      case 'lg':
        classes.push('rounded-lg');
        break;
      case 'xl':
        classes.push('rounded-xl');
        break;
      case 'full':
        classes.push('rounded-full');
        break;
    }

    return classes.join(' ');
  }
}
