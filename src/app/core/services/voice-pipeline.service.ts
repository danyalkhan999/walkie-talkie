import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { I18nService } from './i18n.service';
import { 
  AiProvider, 
  API_ENDPOINTS, 
  AI_MODELS, 
  LOG_PREFIXES 
} from '../../utils/constants';

export interface WhisperTranscriptionResponse {
  text: string;
}

@Injectable({
  providedIn: 'root'
})
export class VoicePipelineService {
  private readonly http = inject(HttpClient);
  private readonly apiConfigService = inject(ApiConfigService);
  private readonly i18nService = inject(I18nService);

  /**
   * Transcribes raw audio blob into text using cloud Whisper STT (Groq / OpenAI) or Sandbox Fallback
   */
  async transcribeAudio(audioBlob: Blob, languageCode: string): Promise<string> {
    const provider = this.apiConfigService.activeProvider();
    let apiKey = this.apiConfigService.getApiKey(provider);

    // If active provider is ElevenLabs (which is TTS-only) or active has no key, check Groq/OpenAI keys
    let endpoint: string = API_ENDPOINTS.GROQ_STT;
    let model: string = AI_MODELS.GROQ_STT;
    let activeSttProvider = 'GROQ';

    if (provider === AiProvider.OPENAI && apiKey) {
      endpoint = API_ENDPOINTS.OPENAI_STT;
      model = AI_MODELS.OPENAI_STT;
      activeSttProvider = 'OPENAI';
    } else if (this.apiConfigService.hasKey(AiProvider.GROQ)) {
      apiKey = this.apiConfigService.getApiKey(AiProvider.GROQ);
      endpoint = API_ENDPOINTS.GROQ_STT;
      model = AI_MODELS.GROQ_STT;
      activeSttProvider = 'GROQ';
    } else if (this.apiConfigService.hasKey(AiProvider.OPENAI)) {
      apiKey = this.apiConfigService.getApiKey(AiProvider.OPENAI);
      endpoint = API_ENDPOINTS.OPENAI_STT;
      model = AI_MODELS.OPENAI_STT;
      activeSttProvider = 'OPENAI';
    }

    // 1. Live Cloud STT Execution (When API key is present)
    if (apiKey && apiKey.trim()) {
      return this.executeCloudStt(audioBlob, languageCode, endpoint, model, apiKey, activeSttProvider);
    }

    // 2. Development Sandbox / Fallback Mode (When no API key is configured)
    return this.executeSandboxStt(languageCode, audioBlob);
  }

  /**
   * Packages binary Blob into FormData and posts to Whisper endpoint
   */
  private async executeCloudStt(
    audioBlob: Blob,
    languageCode: string,
    endpoint: string,
    model: string,
    apiKey: string,
    providerName: string
  ): Promise<string> {
    const startTime = Date.now();
    console.log(
      `${LOG_PREFIXES.NETWORK} Dispatching STT request [Provider: ${providerName}, Model: ${model}, Size: ${audioBlob.size} bytes, Lang: ${languageCode || 'auto'}]`
    );

    // Build standard multipart/form-data payload
    const formData = new FormData();
    const fileExt = audioBlob.type.includes('mp4') ? 'speech.mp4' : 'speech.webm';
    formData.append('file', audioBlob, fileExt);
    formData.append('model', model);
    if (languageCode) {
      formData.append('language', languageCode);
    }
    formData.append('response_format', 'json');
    formData.append('temperature', '0.0');

    // DO NOT manually set Content-Type header; browser calculates boundary automatically
    const headers = new HttpHeaders({
      Authorization: `Bearer ${apiKey.trim()}`
    });

    try {
      const response = await firstValueFrom(
        this.http.post<WhisperTranscriptionResponse>(endpoint, formData, { headers })
      );

      const latency = Date.now() - startTime;
      const transcript = (response?.text || '').trim();

      if (!transcript) {
        console.warn(`${LOG_PREFIXES.NETWORK} STT response returned empty text (Latency: ${latency}ms)`);
        throw new Error(this.i18nService.get('errors.sttEmpty'));
      }

      console.log(
        `${LOG_PREFIXES.NETWORK} STT Transcription received in ${latency}ms: "${transcript}"`
      );
      return transcript;
    } catch (error: unknown) {
      const latency = Date.now() - startTime;
      console.error(`${LOG_PREFIXES.NETWORK} STT request failed after ${latency}ms:`, error);

      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          throw new Error(this.i18nService.get('errors.sttUnauthorized'));
        } else if (error.status === 429) {
          throw new Error(this.i18nService.get('errors.sttRateLimit'));
        }
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(this.i18nService.get('errors.sttFailed'));
    }
  }

  /**
   * Sandbox simulation mode when user has not entered an API key
   */
  private async executeSandboxStt(languageCode: string, audioBlob: Blob): Promise<string> {
    console.log(
      `${LOG_PREFIXES.NETWORK} Sandbox STT mode active (no API key configured). Processing binary payload (${audioBlob.size} bytes)...`
    );

    // Simulate realistic STT processing delay
    await new Promise(resolve => setTimeout(resolve, 1200));

    const sampleTranscriptions: Record<string, string> = {
      en: 'Hello, how are you doing today?',
      es: 'Hola, ¿cómo estás hoy?',
      fr: 'Bonjour, comment allez-vous aujourd\'hui ?',
      de: 'Hallo, wie geht es Ihnen heute?',
      hi: 'नमस्ते, आज आप कैसे हैं?',
      ja: 'こんにちは、今日の調子はいかがですか？',
      zh: '你好，你今天过得怎么样？'
    };

    const transcript = sampleTranscriptions[languageCode] || `Voice input captured in [${languageCode.toUpperCase()}].`;
    console.log(`${LOG_PREFIXES.NETWORK} [Sandbox STT] Transcribed text: "${transcript}"`);
    return transcript;
  }
}
