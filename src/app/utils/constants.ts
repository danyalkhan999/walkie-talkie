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

export enum AiProvider {
  GROQ = 'groq',
  OPENAI = 'openai',
  ELEVENLABS = 'elevenlabs',
  BROWSER_DEMO = 'browser_demo'
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
export const DEFAULT_AI_PROVIDER = AiProvider.GROQ;

// Storage Keys
export const STORAGE_KEYS = {
  THEME: 'echotranslate_theme_preference',
  APP_LANGUAGE: 'echotranslate_app_language',
  SOURCE_LANGUAGE: 'echotranslate_source_language',
  TARGET_LANGUAGE: 'echotranslate_target_language',
  ACTIVE_AI_PROVIDER: 'echotranslate_active_provider',
  GROQ_API_KEY: 'echotranslate_groq_key',
  OPENAI_API_KEY: 'echotranslate_openai_key',
  ELEVENLABS_API_KEY: 'echotranslate_elevenlabs_key',
  GROQ_RESOLVED_MODEL: 'echotranslate_groq_resolved_model'
} as const;

// Candidate Groq LLM Models in priority order
export const GROQ_LLM_CANDIDATES: readonly string[] = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'groq/compound-mini',
  'groq/compound',
  'llama3-8b-8192',
  'llama-3.1-8b-instant',
  'qwen/qwen3.6-27b'
];

// API Endpoints & Models
export const API_ENDPOINTS = {
  GROQ_STT: 'https://api.groq.com/openai/v1/audio/transcriptions',
  GROQ_LLM: 'https://api.groq.com/openai/v1/chat/completions',
  OPENAI_STT: 'https://api.openai.com/v1/audio/transcriptions',
  OPENAI_LLM: 'https://api.openai.com/v1/chat/completions',
  OPENAI_TTS: 'https://api.openai.com/v1/audio/speech',
  ELEVENLABS_TTS: 'https://api.elevenlabs.io/v1/text-to-speech',
  ELEVENLABS_STT: 'https://api.elevenlabs.io/v1/speech-to-text'
} as const;

export const AI_MODELS = {
  GROQ_STT: 'whisper-large-v3',
  GROQ_DEFAULT_LLM: 'openai/gpt-oss-120b',
  OPENAI_STT: 'whisper-1',
  OPENAI_LLM: 'gpt-4o-mini',
  OPENAI_TTS: 'tts-1',
  OPENAI_TTS_VOICE: 'alloy',
  ELEVENLABS_DEFAULT_VOICE_ID: '21m00Tcm4TlvDq8ikWAM', // Rachel
  ELEVENLABS_MODEL_ID: 'eleven_multilingual_v2',
  ELEVENLABS_STT_MODEL: 'scribe_v1'
} as const;

// Timing & Duration Configurations
export const APP_TIMINGS = {
  SIMULATED_PROCESSING_MS: 1800,
  SIMULATED_PLAYBACK_MS: 3000,
  TOAST_NOTIFICATION_MS: 2500,
  SEARCH_DEBOUNCE_MS: 200
} as const;

// Audio Hardware & Recording Configurations
export const AUDIO_CONFIG = {
  MIN_RECORDING_DURATION_MS: 350,
  TIMESLICE_MS: 200,
  MIME_TYPE_CANDIDATES: [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav'
  ],
  FFT_SIZE: 128,
  SMOOTHING_TIME_CONSTANT: 0.8
} as const;

// SEO Metadata Defaults
export const SEO_DEFAULTS = {
  SITE_NAME: 'EchoTranslate',
  TITLE_WALKIE_TALKIE: 'EchoTranslate • Real-Time AI Voice Walkie-Talkie Translator',
  TITLE_GUIDE: 'Documentation & Setup Guide • EchoTranslate',
  DESCRIPTION_WALKIE_TALKIE: 'Instant speech-to-speech AI voice translator with Push-to-Talk controls, browser native WebRTC audio capture, and high-speed multi-language translation.',
  DESCRIPTION_GUIDE: 'Complete developer and user guide for EchoTranslate: API connection setup (Groq, OpenAI, ElevenLabs), architecture overview, and Push-to-Talk walkie-talkie controls.'
} as const;

// Log Prefixes for structured debugging and tracing
export const LOG_PREFIXES = {
  ACTION: '[EchoTranslate][Action]',
  STATE: '[EchoTranslate][State]',
  THEME: '[EchoTranslate][Theme]',
  I18N: '[EchoTranslate][i18n]',
  HARDWARE: '[EchoTranslate][Hardware]',
  NETWORK: '[EchoTranslate][Network]',
  API: '[EchoTranslate][API]',
  SEO: '[EchoTranslate][SEO]'
} as const;
