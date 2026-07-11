import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CardComponent } from '@shared/components/card/card.component';

@Component({
  selector: 'app-about',
  
  imports: [CommonModule, IconComponent, CardComponent],
  templateUrl: './about.component.html'
})
export class AboutComponent { }
