import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { 
  DEFAULT_APP_LANGUAGE, 
  STORAGE_KEYS, 
  LOG_PREFIXES, 
  SUPPORTED_APP_LANGUAGES 
} from '../../utils/constants';
import { getLocalStorageItem, setLocalStorageItem } from '../../utils/storage.utils';

// Embedded fallback dictionary for instant hydration
const FALLBACK_EN: Record<string, unknown> = {
  app: {
    title: 'EchoTranslate',
    subtitle: 'Voice Walkie-Talkie',
    badge: 'Walkie-Talkie',
    version: 'v1.0'
  },
  status: {
    idle: 'Ready',
    requesting_permission: 'Requesting Mic Access...',
    recording: 'Listening...',
    processing: 'Translating...',
    playing: 'Speaking...',
    error: 'Error Occurred'
  },
  workspace: {
    fromLabel: 'FROM',
    toLabel: 'TO',
    sourcePlaceholder: 'Tap the microphone and begin speaking...',
    sourceListening: 'Listening to your voice...',
    targetPlaceholder: 'Translation will appear here...',
    swapLanguages: 'Swap translation source and target languages',
    recordButtonAria: 'Toggle speech recording',
    playOutputAria: 'Play translated voice output',
    copyOutputAria: 'Copy translated text',
    copiedSuccess: 'Copied to clipboard!',
    statusIndicator: 'Engine Status'
  },
  languages: {
    searchPlaceholder: 'Search language...',
    noResults: 'No matching language found',
    selectLanguage: 'Select language',
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    hi: 'Hindi',
    ja: 'Japanese',
    zh: 'Chinese',
    pt: 'Portuguese',
    it: 'Italian',
    ar: 'Arabic',
    ru: 'Russian',
    ko: 'Korean'
  },
  theme: {
    toggleAria: 'Toggle Light/Dark theme',
    light: 'Light Mode',
    dark: 'Dark Mode',
    system: 'System Theme'
  },
  errors: {
    micPermissionDenied: 'Microphone permission was denied. Please allow microphone access in your browser settings.',
    networkError: 'Network request failed. Please check your internet connection.',
    timeout: 'Translation request timed out. Please try speaking again.',
    dismiss: 'Dismiss'
  },
  footer: {
    tagline: 'Real-time AI Voice-to-Voice Walkie-Talkie'
  }
};

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private readonly currentLanguageSignal = signal<string>(
    getLocalStorageItem<string>(STORAGE_KEYS.APP_LANGUAGE, DEFAULT_APP_LANGUAGE)
  );

  private readonly labelsDictionary = signal<Record<string, unknown>>(FALLBACK_EN);

  readonly currentLanguage = this.currentLanguageSignal.asReadonly();
  readonly supportedLanguages = SUPPORTED_APP_LANGUAGES;

  constructor(private readonly http: HttpClient) {
    this.loadLanguage(this.currentLanguageSignal());
  }

  /**
   * Switches the UI language and updates stored preferences
   */
  async setLanguage(langCode: string): Promise<void> {
    if (this.currentLanguageSignal() === langCode) return;
    
    console.log(`${LOG_PREFIXES.I18N} Switching UI language from ${this.currentLanguageSignal()} to ${langCode}`);
    this.currentLanguageSignal.set(langCode);
    setLocalStorageItem(STORAGE_KEYS.APP_LANGUAGE, langCode);
    await this.loadLanguage(langCode);
  }

  /**
   * Fetches the i18n JSON dictionary for the specified language
   */
  private async loadLanguage(langCode: string): Promise<void> {
    try {
      const path = `assets/i18n/${langCode}.json`;
      const labels = await firstValueFrom(this.http.get<Record<string, unknown>>(path));
      if (labels) {
        this.labelsDictionary.set(labels);
        console.log(`${LOG_PREFIXES.I18N} Successfully loaded labels for: ${langCode}`);
      }
    } catch (error) {
      console.warn(`${LOG_PREFIXES.I18N} Could not load remote JSON for ${langCode}, using fallback:`, error);
      if (langCode === 'en') {
        this.labelsDictionary.set(FALLBACK_EN);
      }
    }
  }

  /**
   * Retrieves a nested translation string using dot notation (e.g. 'app.title')
   */
  get(keyPath: string, defaultValue: string = keyPath): string {
    const keys = keyPath.split('.');
    let current: unknown = this.labelsDictionary();
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return defaultValue;
      }
    }

    return typeof current === 'string' ? current : defaultValue;
  }
}
