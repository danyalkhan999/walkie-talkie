import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { 
  AiProvider, 
  DEFAULT_AI_PROVIDER, 
  STORAGE_KEYS, 
  GROQ_LLM_CANDIDATES,
  AI_MODELS,
  LOG_PREFIXES 
} from '../../utils/constants';
import { getLocalStorageItem, setLocalStorageItem, removeLocalStorageItem } from '../../utils/storage.utils';

export interface KeyVerificationResult {
  success: boolean;
  errorKey?: string;
  statusCode?: number;
}

interface GroqModelsResponse {
  data: Array<{
    id: string;
    object?: string;
    active?: boolean;
  }>;
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

  // Dynamically auto-discovered Groq model
  readonly resolvedGroqModel = signal<string>(
    getLocalStorageItem<string>(STORAGE_KEYS.GROQ_RESOLVED_MODEL, AI_MODELS.GROQ_DEFAULT_LLM)
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
    // Auto-discover models on startup if Groq key exists
    if (this.groqKeySignal().trim()) {
      this.discoverGroqModels(this.groqKeySignal().trim()).catch(() => {});
    }
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

  setResolvedGroqModel(modelId: string): void {
    if (!modelId) return;
    this.resolvedGroqModel.set(modelId);
    setLocalStorageItem(STORAGE_KEYS.GROQ_RESOLVED_MODEL, modelId);
    console.log(`${LOG_PREFIXES.API} Saved resolved Groq model: [${modelId}]`);
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
          this.discoverGroqModels(trimmed).catch(() => {});
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
   * Queries Groq models endpoint and auto-selects the optimal available chat model
   */
  async discoverGroqModels(key: string): Promise<string> {
    try {
      const headers = new HttpHeaders({ Authorization: `Bearer ${key}` });
      const res = await firstValueFrom(
        this.http.get<GroqModelsResponse>('https://api.groq.com/openai/v1/models', { headers })
      );

      const availableIds = (res?.data || []).map(m => m.id);
      console.log(`${LOG_PREFIXES.API} Discovered ${availableIds.length} models for Groq key:`, availableIds);

      // Find the highest priority match from our candidate list
      for (const candidate of GROQ_LLM_CANDIDATES) {
        if (availableIds.includes(candidate)) {
          this.setResolvedGroqModel(candidate);
          return candidate;
        }
      }

      // If no candidate matched, pick the first valid text completion model
      const fallback = availableIds.find(id => 
        !id.includes('whisper') && 
        !id.includes('guard') && 
        !id.includes('orpheus')
      ) || 'openai/gpt-oss-120b';
      this.setResolvedGroqModel(fallback);
      return fallback;
    } catch (err) {
      console.warn(`${LOG_PREFIXES.API} Could not auto-discover Groq models, using default:`, err);
      return this.resolvedGroqModel();
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
        const resolvedModel = await this.discoverGroqModels(key);
        console.log(`${LOG_PREFIXES.API} Live Groq API verification succeeded. Auto-selected model: [${resolvedModel}]`);
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
        try {
          await firstValueFrom(this.http.get('https://api.elevenlabs.io/v1/models', { headers }));
          console.log(`${LOG_PREFIXES.API} Live ElevenLabs API verification succeeded (200 OK)`);
          return { success: true };
        } catch (subErr) {
          // If key is authenticated but restricted specifically to Text-to-Speech (missing_permissions), accept it!
          if (
            subErr instanceof HttpErrorResponse &&
            (subErr.error?.detail?.status === 'missing_permissions' ||
             subErr.error?.detail?.message?.includes('missing the permission'))
          ) {
            console.log(`${LOG_PREFIXES.API} ElevenLabs API key authenticated (Scoped for Text-to-Speech)`);
            return { success: true };
          }
          throw subErr;
        }
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
