import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { CardComponent } from '@shared/components/card/card.component';
import { CustomInputComponent } from '@shared/components/custom-input/custom-input.component';

@Component({
  selector: 'app-contact',
  
  imports: [CommonModule, IconComponent, ButtonComponent, CardComponent, CustomInputComponent],
  templateUrl: './contact.component.html'
})
export class ContactComponent { }
