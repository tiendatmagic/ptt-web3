import { Component, Input, Output, EventEmitter, inject, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionComponent } from './accordion.component';

@Component({
  selector: 'app-accordion-item',
  imports: [CommonModule],
  templateUrl: './accordion-item.component.html',
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class AccordionItemComponent {
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() expanded = false;
  @Input() disabled = false;
  @Output() expandedChange = new EventEmitter<boolean>();

  private accordion = inject(forwardRef(() => AccordionComponent), { optional: true });

  public toggle(): void {
    if (this.disabled) return;
    
    if (this.accordion) {
      this.accordion.toggleItem(this);
    } else {
      this.expanded = !this.expanded;
      this.expandedChange.emit(this.expanded);
    }
  }
}
