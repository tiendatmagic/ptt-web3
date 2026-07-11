import { Directive, Input, ElementRef, HostListener, Renderer2, OnDestroy } from '@angular/core';

/**
 * Directive appTooltip hiển thị bong bóng thông tin khi di chuột hoặc focus.
 * Định vị động fixed ở body để tránh lỗi tràn khung.
 *
 * Sử dụng:
 *   <button appTooltip="Nội dung tooltip" tooltipPlacement="top">Hover me</button>
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') text: string = '';
  @Input() tooltipPlacement: 'top' | 'bottom' | 'left' | 'right' = 'top';

  private tooltipEl: HTMLElement | null = null;
  private removeListeners: (() => void)[] = [];

  constructor(
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

  @HostListener('mouseenter')
  @HostListener('focusin')
  onMouseEnter(): void {
    if (!this.text) return;
    this.createTooltip();
  }

  @HostListener('mouseleave')
  @HostListener('focusout')
  onMouseLeave(): void {
    this.destroyTooltip();
  }

  ngOnDestroy(): void {
    this.destroyTooltip();
  }

  private createTooltip(): void {
    if (this.tooltipEl) return;

    // Tạo phần tử tooltip
    this.tooltipEl = this.renderer.createElement('div');
    this.renderer.appendChild(this.tooltipEl, this.renderer.createText(this.text));

    // Thêm các class style theo design system
    const classes = [
      'fixed',
      'z-[9999]',
      'px-2.5',
      'py-1.5',
      'text-[11px]',
      'font-bold',
      'text-slate-100',
      'dark:text-slate-200',
      'bg-slate-950/90',
      'dark:bg-slate-900/95',
      'border',
      'border-slate-800/80',
      'dark:border-slate-700/50',
      'rounded-lg',
      'shadow-lg',
      'shadow-black/25',
      'pointer-events-none',
      'select-none',
      'backdrop-blur-sm',
      'opacity-0',
      'transition-all',
      'duration-150',
      'ease-out'
    ];
    classes.forEach(c => this.renderer.addClass(this.tooltipEl!, c));

    // Thêm vào document body
    this.renderer.appendChild(document.body, this.tooltipEl);

    // Tính toán tọa độ ban đầu
    this.updatePosition();

    // Kích hoạt animation xuất hiện (fade-in & scale)
    requestAnimationFrame(() => {
      if (this.tooltipEl) {
        this.renderer.removeClass(this.tooltipEl, 'opacity-0');
        this.updatePosition(true);
      }
    });

    // Lắng nghe scroll & resize để ẩn tooltip tránh bị trôi lệch vị trí
    const scrollListener = this.renderer.listen('window', 'scroll', () => this.destroyTooltip());
    const resizeListener = this.renderer.listen('window', 'resize', () => this.destroyTooltip());
    this.removeListeners.push(scrollListener, resizeListener);
  }

  private updatePosition(active = false): void {
    if (!this.tooltipEl) return;

    const hostRect = this.el.nativeElement.getBoundingClientRect();
    let top = 0;
    let left = 0;
    let transform = '';

    switch (this.tooltipPlacement) {
      case 'top':
        top = hostRect.top;
        left = hostRect.left + hostRect.width / 2;
        transform = `translate(-50%, -100%) translateY(-6px) ${active ? 'scale(1)' : 'scale(0.95)'}`;
        break;
      case 'bottom':
        top = hostRect.bottom;
        left = hostRect.left + hostRect.width / 2;
        transform = `translate(-50%, 0) translateY(6px) ${active ? 'scale(1)' : 'scale(0.95)'}`;
        break;
      case 'left':
        top = hostRect.top + hostRect.height / 2;
        left = hostRect.left;
        transform = `translate(-100%, -50%) translateX(-6px) ${active ? 'scale(1)' : 'scale(0.95)'}`;
        break;
      case 'right':
        top = hostRect.top + hostRect.height / 2;
        left = hostRect.right;
        transform = `translate(0, -50%) translateX(6px) ${active ? 'scale(1)' : 'scale(0.95)'}`;
        break;
    }

    this.renderer.setStyle(this.tooltipEl, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipEl, 'left', `${left}px`);
    this.renderer.setStyle(this.tooltipEl, 'transform', transform);
  }

  private destroyTooltip(): void {
    if (!this.tooltipEl) return;

    // Hủy các sự kiện scroll & resize
    this.removeListeners.forEach(fn => fn());
    this.removeListeners = [];

    const el = this.tooltipEl;
    this.tooltipEl = null;

    // Fade-out và scale down
    this.renderer.addClass(el, 'opacity-0');
    this.renderer.setStyle(el, 'transform', el.style.transform + ' scale(0.95)');

    // Xóa khỏi DOM sau khi transition hoàn thành
    setTimeout(() => {
      if (el.parentNode) {
        this.renderer.removeChild(document.body, el);
      }
    }, 150);
  }
}
