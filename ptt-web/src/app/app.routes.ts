import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('@features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'governance',
    loadComponent: () => import('@features/governance/governance.component').then(m => m.GovernanceComponent)
  },
  {
    path: 'marketplace',
    loadComponent: () => import('@features/marketplace/marketplace.component').then(m => m.MarketplaceComponent)
  },
  {
    path: 'funding',
    loadComponent: () => import('@features/funding/funding.component').then(m => m.FundingComponent)
  },
  {
    path: 'kyc',
    loadComponent: () => import('@features/kyc/kyc.component').then(m => m.KycComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
