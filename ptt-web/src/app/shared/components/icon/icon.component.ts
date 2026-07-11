import { Component, Input } from '@angular/core';

/**
 * Component icon tái sử dụng toàn hệ thống.
 *
 * Sử dụng:
 *   <app-icon name="sun" class="h-5 w-5 text-amber-500" />
 *   <app-icon name="warning" strokeWidth="2.5" class="h-4 w-4" />
 *   <app-icon name="bolt" [solid]="true" viewBox="0 0 20 20" class="h-5 w-5" />
 */
@Component({
  selector: 'app-icon',
  
  templateUrl: './icon.component.html',
  
  host: {
    style: 'display: inline-flex; align-items: center; justify-content: center;'
  }
})
export class IconComponent {
  /** Tên icon. Xem danh sách trong icon.component.html */
  @Input() name: string = '';

  /** Độ dày nét vẽ (outline icons). Mặc định '2' */
  @Input() strokeWidth: string | number = '2';

  /** Dùng fill="currentColor" thay vì stroke (Heroicons Solid style). Mặc định false */
  @Input() solid: boolean = false;

  /** ViewBox SVG. Mặc định '0 0 24 24'. Heroicons Solid dùng '0 0 20 20' */
  @Input() viewBox: string = '0 0 24 24';
}
