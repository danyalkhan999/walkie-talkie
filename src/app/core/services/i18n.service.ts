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
  nav: {
    walkieTalkie: 'Walkie-Talkie',
    guide: 'User Guide',
    settings: 'Settings',
    github: 'GitHub'
  },
  drawer: {
    title: 'Settings & Connection',
    closeAria: 'Close settings drawer',
    appearance: 'Appearance & Theme',
    themeDescription: 'Choose your visual interface style',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    aiProvider: 'AI Models & API Keys',
    providerDescription: 'Connect your AI credentials for real-time speech translation',
    groqTab: 'Groq (Fast)',
    openaiTab: 'OpenAI',
    elevenlabsTab: 'ElevenLabs',
    apiKeyLabel: 'API Key',
    apiKeyPlaceholder: 'Paste your API key here...',
    getKeyLink: 'Get Free API Key',
    showKey: 'Show key',
    hideKey: 'Hide key',
    clearKey: 'Clear',
    saveKey: 'Save & Connect',
    verifyingKey: 'Verifying Key...',
    keySavedSuccess: 'API Key verified & connected successfully!',
    keyRequired: 'Please enter an API key before saving.',
    invalidGroqKey: "Invalid Groq API key format. A valid Groq key begins with 'gsk_'.",
    invalidOpenAiKey: "Invalid OpenAI API key format. A valid OpenAI key begins with 'sk-'.",
    invalidElevenLabsKey: 'Invalid ElevenLabs API key format.',
    invalidServerKey: 'Authentication failed: The API key is invalid or unauthorized.',
    rateLimitServerKey: 'Rate limit reached on provider. Please try again in a few moments.',
    connectionFailed: 'Could not connect to provider endpoint. Please check your network.',
    statusConnected: 'Connected',
    statusSandbox: 'Dev Sandbox Mode',
    statusNotSet: 'Not Configured',
    groqNote: 'Groq provides ultra-fast (<300ms) Whisper audio transcription and Llama-3 translation with a generous free tier.',
    openaiNote: 'OpenAI powers Whisper-1 transcription and GPT-4o-mini translation pipelines.',
    elevenlabsNote: 'ElevenLabs provides state-of-the-art realistic voice synthesis.'
  },
  guide: {
    pageTitle: 'Documentation & Setup Guide',
    pageSubtitle: 'Everything you need to know about EchoTranslate architecture, API keys, and voice workflows.',
    tableOfContents: 'Table of Contents',
    aboutTitle: 'About EchoTranslate',
    aboutContent: 'EchoTranslate is a high-speed Client-Side Rendered (CSR) speech-to-speech translation web application built with Angular. It captures voice directly in the browser via native WebRTC MediaRecorder APIs and pipes audio through cloud STT, LLM reasoning, and TTS engines with zero server middleware.',
    quickstartTitle: '3-Step Quick Start',
    quickstartStep1: 'Connect your API key in Settings (Groq is free and recommended).',
    quickstartStep2: 'Select your Source (FROM) and Target (TO) languages.',
    quickstartStep3: 'Press and hold the Walkie-Talkie button, speak, and release to translate instantly.',
    apiSetupTitle: 'API Key Setup Guide',
    apiSetupGroq: 'Groq Setup (Recommended & Free)',
    apiSetupGroqStep1: 'Visit console.groq.com/keys and sign in.',
    apiSetupGroqStep2: "Click 'Create API Key' and copy your key (starts with 'gsk_').",
    apiSetupGroqStep3: 'Open Settings in the top bar, select Groq, and paste your key.',
    apiSetupOpenAI: 'OpenAI Setup',
    apiSetupOpenAIStep1: 'Visit platform.openai.com/api-keys and generate an API key.',
    apiSetupOpenAIStep2: 'Paste the key into the OpenAI tab in Settings.',
    controlsTitle: 'Push-to-Talk Controls',
    controlsHold: 'Hold-to-Talk (Walkie-Talkie): Press and hold the mic button while speaking, release when done.',
    controlsClick: 'Click-to-Toggle (Hands-Free): Tap once to start recording, tap again to finish.',
    controlsWaveform: 'Real-Time Visualizer: Animated waveform bars bounce dynamically based on your microphone live decibel volume.',
    securityTitle: 'Security & Hardware Privacy',
    securityContext: 'Secure Context Enforcement: Microphone access is strictly confined to HTTPS and localhost domains per browser security standards.',
    securityTeardown: 'Instant Hardware Release: Audio tracks are immediately stopped (.stop()) upon recording completion, extinguishing the browser mic indicator dot.',
    openSettingsBtn: 'Open Settings Drawer',
    launchAppBtn: 'Launch Walkie-Talkie'
  },
  errors: {
    micPermissionDenied: 'Microphone permission was denied. Please allow microphone access in your browser settings.',
    insecureContext: 'Microphone access requires a secure connection (HTTPS or localhost). Please serve the application over HTTPS.',
    noMicFound: 'No audio input device (microphone) was detected on your device.',
    recordingTooShort: 'Recording was too short. Please hold the button and speak.',
    hardwareError: 'An unexpected error occurred while accessing the microphone.',
    networkError: 'Network request failed. Please check your internet connection.',
    sttUnauthorized: 'Invalid API key. Please check your API key in Settings.',
    sttRateLimit: 'API rate limit exceeded. Please wait a moment before speaking again.',
    sttFailed: 'Speech transcription failed. Please try speaking again.',
    sttEmpty: 'No speech detected in audio. Please speak clearly.',
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

  readonly currentLanguageFlag = computed<string>(() => {
    const code = this.currentLanguageSignal();
    const match = this.supportedLanguages.find(l => l.code === code);
    return match ? match.flag : '🌐';
  });

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
