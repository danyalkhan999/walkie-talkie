import { Component, ChangeDetectionStrategy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiConfigService } from '../../services/api-config.service';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';
import { AiProvider, AppTheme } from '../../../utils/constants';

@Component({
  selector: 'app-settings-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-drawer.component.html',
  styleUrls: ['./settings-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsDrawerComponent {
  readonly apiConfigService = inject(ApiConfigService);
  readonly themeService = inject(ThemeService);
  readonly i18nService = inject(I18nService);

  readonly AiProvider = AiProvider;
  readonly AppTheme = AppTheme;

  // Selected tab in drawer
  readonly currentTab = signal<AiProvider>(AiProvider.GROQ);

  // Form input model for active editing
  readonly inputKey = signal<string>('');
  readonly showPassword = signal<boolean>(false);
  readonly isVerifying = signal<boolean>(false);
  readonly saveSuccess = signal<boolean>(false);
  readonly validationError = signal<string | null>(null);

  private saveSuccessTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Sync active key into input field on tab switch
    this.syncInputWithSelectedTab(AiProvider.GROQ);
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.apiConfigService.isDrawerOpen()) {
      this.close();
    }
  }

  selectTab(provider: AiProvider): void {
    this.currentTab.set(provider);
    this.validationError.set(null);
    this.saveSuccess.set(false);
    this.isVerifying.set(false);
    this.syncInputWithSelectedTab(provider);
  }

  private syncInputWithSelectedTab(provider: AiProvider): void {
    this.inputKey.set(this.apiConfigService.getApiKey(provider));
    this.showPassword.set(false);
  }

  toggleShowPassword(): void {
    this.showPassword.update(show => !show);
  }

  async pasteFromClipboard(): Promise<void> {
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) {
          this.inputKey.set(text.trim());
          this.validationError.set(null);
        }
      }
    } catch {}
  }

  clearKey(): void {
    this.inputKey.set('');
    this.validationError.set(null);
    this.saveSuccess.set(false);
    this.isVerifying.set(false);
    this.apiConfigService.setApiKey(this.currentTab(), '');
  }

  async saveKey(): Promise<void> {
    const provider = this.currentTab();
    const rawKey = this.inputKey().trim();

    // 1. Mandatory presence validation
    if (!rawKey) {
      this.validationError.set(this.i18nService.get('drawer.keyRequired'));
      this.saveSuccess.set(false);
      return;
    }

    // 2. Syntax/Format validation per provider
    if (provider === AiProvider.GROQ) {
      if (!rawKey.startsWith('gsk_') || rawKey.length < 15) {
        this.validationError.set(this.i18nService.get('drawer.invalidGroqKey'));
        this.saveSuccess.set(false);
        return;
      }
    } else if (provider === AiProvider.OPENAI) {
      if (!rawKey.startsWith('sk-') || rawKey.length < 15) {
        this.validationError.set(this.i18nService.get('drawer.invalidOpenAiKey'));
        this.saveSuccess.set(false);
        return;
      }
    } else if (provider === AiProvider.ELEVENLABS) {
      if (rawKey.length < 15) {
        this.validationError.set(this.i18nService.get('drawer.invalidElevenLabsKey'));
        this.saveSuccess.set(false);
        return;
      }
    }

    // 3. Live Server-Side Health Check & Authentication Verification
    this.validationError.set(null);
    this.isVerifying.set(true);

    try {
      const result = await this.apiConfigService.testConnection(provider, rawKey);

      if (!result.success) {
        const errorKey = result.errorKey || 'drawer.connectionFailed';
        this.validationError.set(this.i18nService.get(errorKey));
        this.saveSuccess.set(false);
        return;
      }

      // Live verification passed!
      this.validationError.set(null);
      this.apiConfigService.setApiKey(provider, rawKey);
      this.apiConfigService.setProvider(provider);

      // Show temporary success feedback
      if (this.saveSuccessTimer) clearTimeout(this.saveSuccessTimer);
      this.saveSuccess.set(true);
      this.saveSuccessTimer = setTimeout(() => {
        this.saveSuccess.set(false);
      }, 3000);
    } catch {
      this.validationError.set(this.i18nService.get('drawer.connectionFailed'));
      this.saveSuccess.set(false);
    } finally {
      this.isVerifying.set(false);
    }
  }

  setTheme(theme: AppTheme): void {
    this.themeService.setTheme(theme);
  }

  close(): void {
    this.apiConfigService.closeDrawer();
  }
}
