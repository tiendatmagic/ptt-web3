import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { TabGroupComponent, TabOption } from '@shared/components/tab-group/tab-group.component';

@Component({
  selector: 'app-tx-speed-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, TabGroupComponent],
  templateUrl: './tx-speed-selector.component.html',
  styleUrl: './tx-speed-selector.component.css'
})
export class TxSpeedSelectorComponent {
  public stateService = inject(StateService);

  public readonly speedOptions: TabOption[] = [
    { value: 'default', label: 'Mặc định' },
    { value: 'fast', label: 'Nhanh' },
    { value: 'custom', label: 'Tùy chọn' }
  ];
}
