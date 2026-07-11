import { Routes } from '@angular/router';

/**
 * Cấu hình định tuyến của ứng dụng (Routing) áp dụng cơ chế Lazy Loading
 * tương tự như mẫu thiết kế định tuyến của cafe-blockchain.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('@features/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'about',
    loadComponent: () => import('@features/about/about.component').then(m => m.AboutComponent)
  },
  {
    path: 'contact',
    loadComponent: () => import('@features/contact/contact.component').then(m => m.ContactComponent)
  }
];
