import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-pagination',
  
  imports: [CommonModule, IconComponent],
  
  templateUrl: './pagination.component.html'})
export class PaginationComponent implements OnChanges {
  @Input() currentPage: number = 1;
  @Input() totalPages: number = 1;
  @Input() totalItems: number = 0;
  @Input() itemsPerPage: number = 10;
  @Input() itemName: string = 'bản ghi';

  @Output() pageChange = new EventEmitter<number>();

  public pagesArray: (number | string)[] = [];

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentPage'] || changes['totalPages']) {
      this.generatePagesArray();
    }
  }

  public getStartIndex(): number {
    if (this.totalItems === 0) return 0;
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  public getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
  }

  public toNumber(val: any): number {
    return Number(val);
  }

  public goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.pageChange.emit(page);
    }
  }

  private generatePagesArray(): void {
    const pages: (number | string)[] = [];
    const current = this.currentPage;
    const total = this.totalPages;

    if (total <= 5) {
      this.pagesArray = Array.from({ length: total }, (_, i) => i + 1);
      return;
    }

    pages.push(1);

    if (current > 3) {
      pages.push('...');
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push('...');
    }

    pages.push(total);
    this.pagesArray = pages;
  }
}
