import { Component, Input, ContentChildren, QueryList, AfterContentInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionItemComponent } from './accordion-item.component';

/**
 * Accordion container component.
 *
 * Sử dụng:
 *   <app-accordion [multiple]="false">
 *     <app-accordion-item title="Tiêu đề 1">Nội dung 1</app-accordion-item>
 *     <app-accordion-item title="Tiêu đề 2">Nội dung 2</app-accordion-item>
 *   </app-accordion>
 */
@Component({
  selector: 'app-accordion',
  imports: [CommonModule],
  templateUrl: './accordion.component.html',
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class AccordionComponent implements AfterContentInit {
  /** Cho phép mở nhiều panel cùng lúc hay không */
  @Input() multiple = false;

  @ContentChildren(AccordionItemComponent) items!: QueryList<AccordionItemComponent>;

  ngAfterContentInit(): void {
    // Nếu không cho mở nhiều, và có nhiều item được thiết lập expanded=true, chỉ giữ lại item đầu tiên
    if (!this.multiple) {
      let alreadyExpanded = false;
      this.items.forEach(item => {
        if (item.expanded) {
          if (alreadyExpanded) {
            item.expanded = false;
          } else {
            alreadyExpanded = true;
          }
        }
      });
    }
  }

  public toggleItem(targetItem: AccordionItemComponent): void {
    if (this.multiple) {
      targetItem.expanded = !targetItem.expanded;
      targetItem.expandedChange.emit(targetItem.expanded);
    } else {
      const isCurrentlyExpanded = targetItem.expanded;
      
      this.items.forEach(item => {
        if (item === targetItem) {
          item.expanded = !isCurrentlyExpanded;
          item.expandedChange.emit(item.expanded);
        } else {
          if (item.expanded) {
            item.expanded = false;
            item.expandedChange.emit(false);
          }
        }
      });
    }
  }
}
