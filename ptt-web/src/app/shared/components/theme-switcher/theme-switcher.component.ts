import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '@core/services/state.service';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-theme-switcher',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './theme-switcher.component.html',
  styleUrl: './theme-switcher.component.css'
})
export class ThemeSwitcherComponent {
  public stateService = inject(StateService);
}
