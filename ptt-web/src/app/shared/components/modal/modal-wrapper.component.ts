import { Component, Type, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalRef } from '@core/services/modal-ref';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-modal-wrapper',
  
  imports: [CommonModule, IconComponent],
  templateUrl: './modal-wrapper.component.html'})
export class ModalWrapperComponent {
  title = '';
  size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' = 'md';
  closeOnBackdropClick = true;
  showHeader = true;
  childComponent!: Type<any>;
  childInjector!: Injector;

  constructor(public modalRef: ModalRef) {}

  onClose(): void {
    this.modalRef.close();
  }

  onBackdropClick(): void {
    if (this.closeOnBackdropClick) {
      this.onClose();
    }
  }

  getSizeClass(): string {
    switch (this.size) {
      case 'sm': return 'max-w-sm';
      case 'lg': return 'max-w-lg';
      case 'xl': return 'max-w-xl';
      case '2xl': return 'max-w-2xl';
      case '3xl': return 'max-w-3xl';
      case '4xl': return 'max-w-4xl';
      case '5xl': return 'max-w-5xl';
      case 'md':
      default: return 'max-w-md';
    }
  }
}
