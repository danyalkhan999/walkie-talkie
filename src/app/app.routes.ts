import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'walkie-talkie'
  },
  {
    path: 'walkie-talkie',
    loadComponent: () =>
      import('./features/translator/components/translator-workspace/translator-workspace.component').then(
        (m) => m.TranslatorWorkspaceComponent
      )
  },
  {
    path: 'guide',
    loadComponent: () =>
      import('./features/guide/guide.component').then(
        (m) => m.GuideComponent
      )
  },
  {
    path: '**',
    redirectTo: 'walkie-talkie'
  }
];
