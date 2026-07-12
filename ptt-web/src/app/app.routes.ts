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
  {
    path: 'invest',
    loadComponent: () => import('@features/invest/invest.component').then(m => m.InvestComponent)
  },
  {
    path: 'settings',
    loadComponent: () => import('@features/settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('@features/profile/profile.component').then(m => m.ProfileComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
