import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton-loader',
  
  imports: [CommonModule],
  
  templateUrl: './skeleton-loader.component.html'})
export class SkeletonLoaderComponent {
  @Input() type:
    | 'dashboard'
    | 'table'
    | 'card-grid'
    | 'form'
    | 'list' = 'table';
  @Input() rows = 5;
  @Input() cols = 5;
  @Input() cards = 8;
  @Input() showHeader = true;

  // Trả về mảng số lượng phần tử để lặp bằng @for
  getArray(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i + 1);
  }
}
