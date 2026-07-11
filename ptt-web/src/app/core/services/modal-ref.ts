import { InjectionToken } from '@angular/core';
import { Subject } from 'rxjs';

export const MODAL_DATA = new InjectionToken<any>('MODAL_DATA');

export class ModalRef<R = any> {
  private result$ = new Subject<R | undefined>();
  afterClosed$ = this.result$.asObservable();

  constructor(private destroyCallback: (result?: R) => void) {}

  close(result?: R): void {
    this.result$.next(result);
    this.result$.complete();
    this.destroyCallback(result);
  }
}

export interface ModalConfig<D = any> {
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  closeOnBackdropClick?: boolean;
  showHeader?: boolean;
  data?: D;
}

export interface ConfirmConfig {
  title?: string;
  description?: string;
  descriptionHtml?: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  isSubmitting?: boolean;
}
