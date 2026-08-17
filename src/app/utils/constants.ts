// ==========================================
// Application Constants & Enums
// ==========================================

export enum AppWorkflowState {
  IDLE = 'idle',
  REQUESTING_PERMISSION = 'requesting_permission',
  RECORDING = 'recording',
  PROCESSING = 'processing',
  PLAYING = 'playing',
  ERROR = 'error'
}

export enum AppTheme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  speechCode: string;
}

export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', speechCode: 'en-US' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', speechCode: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', speechCode: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', speechCode: 'de-DE' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', speechCode: 'hi-IN' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', speechCode: 'ja-JP' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', speechCode: 'zh-CN' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', speechCode: 'pt-PT' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', speechCode: 'it-IT' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', speechCode: 'ar-SA' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', speechCode: 'ru-RU' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', speechCode: 'ko-KR' }
];

export const SUPPORTED_APP_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' }
] as const;

export const DEFAULT_SOURCE_LANGUAGE = 'en';
export const DEFAULT_TARGET_LANGUAGE = 'es';
export const DEFAULT_APP_LANGUAGE = 'en';
export const DEFAULT_THEME = AppTheme.DARK;

// Storage Keys
export const STORAGE_KEYS = {
  THEME: 'echotranslate_theme_preference',
  APP_LANGUAGE: 'echotranslate_app_language',
  SOURCE_LANGUAGE: 'echotranslate_source_language',
  TARGET_LANGUAGE: 'echotranslate_target_language'
} as const;

// Timing & Duration Configurations
export const APP_TIMINGS = {
  SIMULATED_PROCESSING_MS: 1800,
  SIMULATED_PLAYBACK_MS: 3000,
  TOAST_NOTIFICATION_MS: 2500,
  SEARCH_DEBOUNCE_MS: 200
} as const;

// Log Prefixes for structured debugging and tracing
export const LOG_PREFIXES = {
  ACTION: '[EchoTranslate][Action]',
  STATE: '[EchoTranslate][State]',
  THEME: '[EchoTranslate][Theme]',
  I18N: '[EchoTranslate][i18n]',
  HARDWARE: '[EchoTranslate][Hardware]',
  NETWORK: '[EchoTranslate][Network]'
} as const;
