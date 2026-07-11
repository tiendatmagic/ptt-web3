import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '@shared/layout/header/header.component';
import { ToastComponent } from '@shared/components/toast/toast.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { SidebarComponent } from '@shared/layout/sidebar/sidebar.component';
import { StateService } from '@core/services/state.service';

@Component({
  selector: 'app-root',
  
  imports: [
    RouterOutlet,
    HeaderComponent,
    SidebarComponent,
    ToastComponent,
    ModalComponent,
    IconComponent,
    ButtonComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  public stateService = inject(StateService);

  public switchNetwork(chainId: number) {
    this.stateService.switchNetwork(chainId);
  }

  public disconnectWallet() {
    this.stateService.disconnectWallet();
  }
}
