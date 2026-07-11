import { Component } from '@angular/core';

@Component({
  selector: 'app-logo',
  
  template: `
    <div class="relative w-full h-full flex items-center justify-center rounded-full bg-secondary/10 dark:bg-secondary/15 p-[9%] border border-secondary/20 group">
      <div class="absolute inset-0 bg-gradient-to-tr from-primary/10 to-secondary/10 rounded-full blur-sm group-hover:blur-md transition-all"></div>
      <svg
        class="w-full h-full text-secondary relative z-10 animate-[spin_20s_linear_infinite] hover:animate-[spin_5s_linear_infinite] transition-all"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="50"
          cy="50"
          r="40"
          stroke="currentColor"
          stroke-width="6"
          stroke-dasharray="10 6"
        />
        <circle cx="50" cy="50" r="25" stroke="currentColor" stroke-width="4" />
        <path
          d="M50 10V25M50 75V90M10 50H25M75 50H90"
          stroke="currentColor"
          stroke-width="6"
          stroke-linecap="round"
        />
        <circle cx="50" cy="50" r="8" fill="url(#logo-grad-comp)" />
        <defs>
          <linearGradient id="logo-grad-comp" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="var(--color-primary, #ff00dd)" />
            <stop offset="100%" stop-color="var(--color-secondary, #8000ff)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `
  ]})
export class LogoComponent {}
