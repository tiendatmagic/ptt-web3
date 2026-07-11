import {
  Injectable,
  ApplicationRef,
  ComponentRef,
  createComponent,
  Type,
  Injector} from '@angular/core';
import { ModalRef, MODAL_DATA, ModalConfig, ConfirmConfig } from './modal-ref';
import { ModalWrapperComponent } from '@shared/components/modal/modal-wrapper.component';
import { ConfirmModalComponent } from '@shared/components/confirm-modal/confirm-modal.component';

@Injectable({
  providedIn: 'root'})
export class ModalService {
  constructor(
    private appRef: ApplicationRef,
    private injector: Injector
  ) {}

  open<T, D = any, R = any>(
    component: Type<T>,
    config: ModalConfig<D>
  ): ModalRef<R> {
    let componentRef: ComponentRef<ModalWrapperComponent> | null = null;

    const modalRef = new ModalRef<R>((result?: R) => {
      if (componentRef) {
        this.appRef.detachView(componentRef.hostView);
        componentRef.destroy();
      }
    });

    // Tạo injector riêng chứa ModalRef và MODAL_DATA để component con có thể inject
    const childInjector = Injector.create({
      providers: [
        { provide: ModalRef, useValue: modalRef },
        { provide: MODAL_DATA, useValue: config.data }
      ],
      parent: this.injector
    });

    // Tạo Wrapper component
    componentRef = createComponent(ModalWrapperComponent, {
      environmentInjector: this.appRef.injector,
      elementInjector: childInjector
    });

    // Gán dữ liệu cấu hình cho Wrapper
    componentRef.instance.title = config.title;
    componentRef.instance.size = config.size || 'md';
    componentRef.instance.closeOnBackdropClick = config.closeOnBackdropClick ?? true;
    componentRef.instance.showHeader = config.showHeader ?? true;
    componentRef.instance.childComponent = component;
    componentRef.instance.childInjector = childInjector;

    // Đăng ký View vào ApplicationRef để Angular chạy change detection
    this.appRef.attachView(componentRef.hostView);

    // Append DOM của wrapper vào document.body
    const domElem = (componentRef.hostView as any).rootNodes[0] as HTMLElement;
    document.body.appendChild(domElem);

    return modalRef;
  }

  confirm(config: ConfirmConfig): ModalRef<boolean> {
    return this.open(ConfirmModalComponent, {
      title: config.title || 'Xác nhận hành động',
      size: 'sm',
      closeOnBackdropClick: false,
      showHeader: false,
      data: config
    });
  }
}
