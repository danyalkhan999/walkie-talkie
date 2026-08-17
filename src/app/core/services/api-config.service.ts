import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { 
  AiProvider, 
  DEFAULT_AI_PROVIDER, 
  STORAGE_KEYS, 
  LOG_PREFIXES 
} from '../../utils/constants';
import { getLocalStorageItem, setLocalStorageItem, removeLocalStorageItem } from '../../utils/storage.utils';

export interface KeyVerificationResult {
  success: boolean;
  errorKey?: string;
  statusCode?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  private readonly http = inject(HttpClient);

  // Drawer open/closed state
  readonly isDrawerOpen = signal<boolean>(false);

  // Active selected provider
  readonly activeProvider = signal<AiProvider>(
    getLocalStorageItem<AiProvider>(STORAGE_KEYS.ACTIVE_AI_PROVIDER, DEFAULT_AI_PROVIDER)
  );

  // Provider API Keys
  private readonly groqKeySignal = signal<string>(
    getLocalStorageItem<string>(STORAGE_KEYS.GROQ_API_KEY, '')
  );

  private readonly openaiKeySignal = signal<string>(
    getLocalStorageItem<string>(STORAGE_KEYS.OPENAI_API_KEY, '')
  );

  private readonly elevenlabsKeySignal = signal<string>(
    getLocalStorageItem<string>(STORAGE_KEYS.ELEVENLABS_API_KEY, '')
  );

  readonly groqApiKey = this.groqKeySignal.asReadonly();
  readonly openaiApiKey = this.openaiKeySignal.asReadonly();
  readonly elevenlabsApiKey = this.elevenlabsKeySignal.asReadonly();

  // Status check for whether active provider is configured
  readonly isConfigured = computed<boolean>(() => {
    const provider = this.activeProvider();
    if (provider === AiProvider.GROQ) return !!this.groqKeySignal().trim();
    if (provider === AiProvider.OPENAI) return !!this.openaiKeySignal().trim();
    if (provider === AiProvider.ELEVENLABS) return !!this.elevenlabsKeySignal().trim();
    return true; // Demo mode always active
  });

  constructor() {
    this.logInitialStatus();
  }

  openDrawer(): void {
    console.log(`${LOG_PREFIXES.ACTION} Opened Settings Drawer`);
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    console.log(`${LOG_PREFIXES.ACTION} Closed Settings Drawer`);
    this.isDrawerOpen.set(false);
  }

  toggleDrawer(): void {
    this.isDrawerOpen.update(open => !open);
    console.log(`${LOG_PREFIXES.ACTION} Toggled Settings Drawer: ${this.isDrawerOpen()}`);
  }

  setProvider(provider: AiProvider): void {
    if (this.activeProvider() === provider) return;
    
    console.log(`${LOG_PREFIXES.API} Active AI Provider changed to: [${provider.toUpperCase()}]`);
    this.activeProvider.set(provider);
    setLocalStorageItem(STORAGE_KEYS.ACTIVE_AI_PROVIDER, provider);
  }

  setApiKey(provider: AiProvider, rawKey: string): void {
    const trimmed = rawKey.trim();
    const masked = this.maskKey(trimmed);

    switch (provider) {
      case AiProvider.GROQ:
        this.groqKeySignal.set(trimmed);
        if (trimmed) {
          setLocalStorageItem(STORAGE_KEYS.GROQ_API_KEY, trimmed);
          console.log(`${LOG_PREFIXES.API} Saved GROQ API key (${masked})`);
        } else {
          removeLocalStorageItem(STORAGE_KEYS.GROQ_API_KEY);
          console.log(`${LOG_PREFIXES.API} Cleared GROQ API key`);
        }
        break;

      case AiProvider.OPENAI:
        this.openaiKeySignal.set(trimmed);
        if (trimmed) {
          setLocalStorageItem(STORAGE_KEYS.OPENAI_API_KEY, trimmed);
          console.log(`${LOG_PREFIXES.API} Saved OPENAI API key (${masked})`);
        } else {
          removeLocalStorageItem(STORAGE_KEYS.OPENAI_API_KEY);
          console.log(`${LOG_PREFIXES.API} Cleared OPENAI API key`);
        }
        break;

      case AiProvider.ELEVENLABS:
        this.elevenlabsKeySignal.set(trimmed);
        if (trimmed) {
          setLocalStorageItem(STORAGE_KEYS.ELEVENLABS_API_KEY, trimmed);
          console.log(`${LOG_PREFIXES.API} Saved ELEVENLABS API key (${masked})`);
        } else {
          removeLocalStorageItem(STORAGE_KEYS.ELEVENLABS_API_KEY);
          console.log(`${LOG_PREFIXES.API} Cleared ELEVENLABS API key`);
        }
        break;
    }
  }

  /**
   * Dispatches a live lightweight ping / health-check call to verify that the API key is valid on the server
   */
  async testConnection(provider: AiProvider, rawKey: string): Promise<KeyVerificationResult> {
    const key = rawKey.trim();
    if (!key) {
      return { success: false, errorKey: 'drawer.keyRequired' };
    }

    console.log(`${LOG_PREFIXES.API} Testing live API connection for [${provider.toUpperCase()}]...`);

    try {
      if (provider === AiProvider.GROQ) {
        const headers = new HttpHeaders({ Authorization: `Bearer ${key}` });
        await firstValueFrom(this.http.get('https://api.groq.com/openai/v1/models', { headers }));
        console.log(`${LOG_PREFIXES.API} Live Groq API verification succeeded (200 OK)`);
        return { success: true };
      } 
      
      if (provider === AiProvider.OPENAI) {
        const headers = new HttpHeaders({ Authorization: `Bearer ${key}` });
        await firstValueFrom(this.http.get('https://api.openai.com/v1/models', { headers }));
        console.log(`${LOG_PREFIXES.API} Live OpenAI API verification succeeded (200 OK)`);
        return { success: true };
      } 
      
      if (provider === AiProvider.ELEVENLABS) {
        const headers = new HttpHeaders({ 'xi-api-key': key });
        await firstValueFrom(this.http.get('https://api.elevenlabs.io/v1/user', { headers }));
        console.log(`${LOG_PREFIXES.API} Live ElevenLabs API verification succeeded (200 OK)`);
        return { success: true };
      }

      return { success: true };
    } catch (err: unknown) {
      console.warn(`${LOG_PREFIXES.API} Live API key verification failed:`, err);

      if (err instanceof HttpErrorResponse) {
        if (err.status === 401) {
          return { success: false, errorKey: 'drawer.invalidServerKey', statusCode: 401 };
        } else if (err.status === 429) {
          return { success: false, errorKey: 'drawer.rateLimitServerKey', statusCode: 429 };
        }
      }

      return { success: false, errorKey: 'drawer.connectionFailed' };
    }
  }

  getApiKey(provider: AiProvider): string {
    switch (provider) {
      case AiProvider.GROQ: return this.groqKeySignal();
      case AiProvider.OPENAI: return this.openaiKeySignal();
      case AiProvider.ELEVENLABS: return this.elevenlabsKeySignal();
      default: return '';
    }
  }

  hasKey(provider: AiProvider): boolean {
    return !!this.getApiKey(provider).trim();
  }

  /**
   * Helper to safely mask API keys for console logging (e.g. "gsk_1234...****")
   */
  private maskKey(key: string): string {
    if (!key) return 'empty';
    if (key.length <= 8) return '****';
    const prefix = key.slice(0, 6);
    return `${prefix}...****`;
  }

  private logInitialStatus(): void {
    const provider = this.activeProvider();
    const hasGroq = !!this.groqKeySignal();
    const hasOpenAI = !!this.openaiKeySignal();
    const hasElevenLabs = !!this.elevenlabsKeySignal();

    console.log(
      `${LOG_PREFIXES.API} Config initialized | Active Provider: [${provider.toUpperCase()}] | Groq: ${hasGroq ? 'Configured' : 'Not set'} | OpenAI: ${hasOpenAI ? 'Configured' : 'Not set'} | ElevenLabs: ${hasElevenLabs ? 'Configured' : 'Not set'}`
    );
  }
}
