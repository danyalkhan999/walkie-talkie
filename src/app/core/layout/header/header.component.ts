import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';
import { StateService } from '../../services/state.service';
import { ApiConfigService } from '../../services/api-config.service';
import { AppTheme, AppWorkflowState, LOG_PREFIXES } from '../../../utils/constants';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  readonly themeService = inject(ThemeService);
  readonly i18nService = inject(I18nService);
  readonly stateService = inject(StateService);
  readonly apiConfigService = inject(ApiConfigService);

  readonly AppTheme = AppTheme;
  readonly AppWorkflowState = AppWorkflowState;

  isLangDropdownOpen = false;

  openSettings(): void {
    console.log(`${LOG_PREFIXES.ACTION} Header Settings icon clicked`);
    this.apiConfigService.openDrawer();
  }

  toggleLangDropdown(): void {
    this.isLangDropdownOpen = !this.isLangDropdownOpen;
  }

  selectAppLanguage(langCode: string): void {
    this.i18nService.setLanguage(langCode);
    this.isLangDropdownOpen = false;
  }
}
