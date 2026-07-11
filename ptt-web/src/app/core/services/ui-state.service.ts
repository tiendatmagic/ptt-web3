import { Injectable, signal } from '@angular/core';

/**
 * Service quản lý trạng thái giao diện (UI state) toàn cục của ứng dụng.
 * Tương tự mẫu ui-state.service.ts của dự án cafe-blockchain.
 */
@Injectable({
  providedIn: 'root'
})
export class UiStateService {
  // Trạng thái hiển thị menu và các dropdown của Header/Sidebar
  public readonly showMobileMenu = signal<boolean>(false);
  public readonly showDropdown = signal<boolean>(false);
  public readonly showNetworkDropdown = signal<boolean>(false);

  // Trạng thái Loading hệ thống toàn cục
  public readonly isLoading = signal<boolean>(false);
}
