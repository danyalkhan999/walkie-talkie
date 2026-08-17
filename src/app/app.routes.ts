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
    path: '**',
    redirectTo: 'walkie-talkie'
  }
];
