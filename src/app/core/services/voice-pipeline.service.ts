import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { StateService } from './state.service';
import { I18nService } from './i18n.service';
import { 
  AiProvider, 
  API_ENDPOINTS, 
  AI_MODELS, 
  GROQ_LLM_CANDIDATES,
  SUPPORTED_LANGUAGES,
  AppWorkflowState,
  LOG_PREFIXES 
} from '../../utils/constants';

export interface WhisperTranscriptionResponse {
  text: string;
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class VoicePipelineService {
  private readonly http = inject(HttpClient);
  private readonly apiConfigService = inject(ApiConfigService);
  private readonly stateService = inject(StateService);
  private readonly i18nService = inject(I18nService);

  // Active audio playback instance for cleanup & interruption
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private playbackStartTime = 0;
  private estimatedDurationMs = 0;
  private pausedElapsedMs = 0;

  // Reactive Studio Audio Player Signals
  readonly isPlaying = signal<boolean>(false);
  readonly isPaused = signal<boolean>(false);
  readonly playbackProgress = signal<number>(0);
  readonly playbackRate = signal<number>(1.0);
  readonly isPlayerVisible = signal<boolean>(false);
  readonly activePlayerText = signal<string>('');
  readonly activePlayerLang = signal<string>('');
  readonly elapsedTime = signal<string>('0:00');
  readonly totalTime = signal<string>('0:00');

  /**
   * Transcribes raw audio blob into text using cloud Whisper STT (Groq / OpenAI) or Sandbox Fallback
   */
  async transcribeAudio(audioBlob: Blob, languageCode: string): Promise<string> {
    const provider = this.apiConfigService.activeProvider();
    let apiKey = this.apiConfigService.getApiKey(provider);

    let endpoint: string = API_ENDPOINTS.GROQ_STT;
    let model: string = AI_MODELS.GROQ_STT;
    let activeSttProvider = 'GROQ';

    if (provider === AiProvider.ELEVENLABS && apiKey) {
      try {
        return await this.executeElevenLabsStt(audioBlob, languageCode, apiKey);
      } catch {
        console.warn(`${LOG_PREFIXES.NETWORK} ElevenLabs STT failed, trying fallback STT...`);
      }
    }

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
    } else if (this.apiConfigService.hasKey(AiProvider.ELEVENLABS)) {
      apiKey = this.apiConfigService.getApiKey(AiProvider.ELEVENLABS);
      return this.executeElevenLabsStt(audioBlob, languageCode, apiKey);
    }

    // 1. Live Cloud STT Execution (When API key is present)
    if (apiKey && apiKey.trim()) {
      return this.executeCloudStt(audioBlob, languageCode, endpoint, model, apiKey, activeSttProvider);
    }

    // 2. Development Sandbox / Fallback Mode (When no API key is configured)
    return this.executeSandboxStt(languageCode, audioBlob);
  }

  /**
   * Translates transcribed or typed text into target language
   */
  async translateText(text: string, sourceLangCode: string, targetLangCode: string): Promise<string> {
    if (!text || !text.trim()) return '';

    const sourceLangObj = SUPPORTED_LANGUAGES.find(l => l.code === sourceLangCode);
    const targetLangObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLangCode);
    const sourceName = sourceLangObj ? sourceLangObj.name : sourceLangCode;
    const targetName = targetLangObj ? targetLangObj.name : targetLangCode;

    // Check available LLM providers & keys
    let endpoint: string = API_ENDPOINTS.GROQ_LLM;
    let model: string = this.apiConfigService.resolvedGroqModel();
    let apiKey: string = '';
    let providerName = 'GROQ';

    if (this.apiConfigService.hasKey(AiProvider.GROQ)) {
      apiKey = this.apiConfigService.getApiKey(AiProvider.GROQ);
      endpoint = API_ENDPOINTS.GROQ_LLM;
      model = this.apiConfigService.resolvedGroqModel();
      providerName = 'GROQ';
    } else if (this.apiConfigService.hasKey(AiProvider.OPENAI)) {
      apiKey = this.apiConfigService.getApiKey(AiProvider.OPENAI);
      endpoint = API_ENDPOINTS.OPENAI_LLM;
      model = AI_MODELS.OPENAI_LLM;
      providerName = 'OPENAI';
    }

    // 1. Live LLM Translation
    if (apiKey && apiKey.trim()) {
      return this.executeCloudTranslation(text, sourceName, targetName, targetLangCode, endpoint, model, apiKey, providerName);
    }

    // 2. Sandbox Translation Fallback
    return this.executeSandboxTranslation(text, targetLangCode);
  }

  /**
   * Speaks the translated text using the Browser Native Speech Engine and activates the Studio Player Dock
   */
  async speakTranslation(text: string, targetLangCode: string): Promise<void> {
    if (!text || !text.trim()) return;

    // Activate the sticky audio player dock
    this.isPlayerVisible.set(true);
    this.activePlayerText.set(text);
    this.activePlayerLang.set(targetLangCode);

    // Play using browser native SpeechSynthesis
    this.playNativeSpeech(text, targetLangCode, this.playbackRate());
  }

  /**
   * Plays speech using Browser Native Web SpeechSynthesis with real-time word-boundary progress tracking
   */
  playNativeSpeech(text: string, targetLangCode: string, rate: number = 1.0): void {
    if (!text || !text.trim()) return;

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn(`${LOG_PREFIXES.HARDWARE} Browser does not support window.speechSynthesis`);
      this.stateService.setWorkflowState(AppWorkflowState.IDLE);
      return;
    }

    // Clean any ongoing synthesis
    this.stopPlayback(false);

    const targetLangObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLangCode);
    const speechCode = targetLangObj ? targetLangObj.speechCode : targetLangCode;

    console.log(`${LOG_PREFIXES.HARDWARE} Playing Native Speech [Lang: ${speechCode}, Rate: ${rate}x]`);

    this.currentUtterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance.lang = speechCode;
    this.currentUtterance.rate = rate;
    this.currentUtterance.pitch = 1.0;

    // Estimate total speech duration: ~65ms per character at 1x speed, adjusted by rate
    const charRateMs = 65;
    this.estimatedDurationMs = Math.max(1500, (text.length * charRateMs) / rate);
    this.pausedElapsedMs = 0;
    this.playbackStartTime = Date.now();

    // Update active player states
    this.activePlayerText.set(text);
    this.activePlayerLang.set(targetLangCode);
    this.isPlayerVisible.set(true);
    this.isPlaying.set(true);
    this.isPaused.set(false);
    this.playbackProgress.set(0);
    this.elapsedTime.set('0:00');
    this.totalTime.set(this.formatTime(this.estimatedDurationMs));
    this.stateService.setWorkflowState(AppWorkflowState.PLAYING);

    // Track word boundary events for real-time calibration when available
    this.currentUtterance.onboundary = (event: SpeechSynthesisEvent) => {
      if ((event.name === 'word' || event.charIndex > 0) && text.length > 0) {
        const charPct = Math.min(99, Math.round((event.charIndex / text.length) * 100));
        if (charPct > this.playbackProgress()) {
          this.playbackProgress.set(charPct);
          // Calibrate elapsed time to match word position
          const calibratedElapsed = Math.round((charPct / 100) * this.estimatedDurationMs);
          this.elapsedTime.set(this.formatTime(calibratedElapsed));
        }
      }
    };

    // Start smooth timer-based progress tracking (updates every 100ms)
    this.startProgressTimer();

    this.currentUtterance.onend = () => {
      console.log(`${LOG_PREFIXES.ACTION} Speech playback completed.`);
      this.stopProgressTimer();
      this.playbackProgress.set(100);
      this.elapsedTime.set(this.totalTime());
      this.isPlaying.set(false);
      this.isPaused.set(false);
      this.stateService.setWorkflowState(AppWorkflowState.IDLE);
    };

    this.currentUtterance.onerror = (err) => {
      console.warn(`${LOG_PREFIXES.HARDWARE} Native speech error:`, err);
      this.stopProgressTimer();
      this.isPlaying.set(false);
      this.isPaused.set(false);
      this.stateService.setWorkflowState(AppWorkflowState.IDLE);
    };

    this.currentUtterance.onpause = () => {
      this.handlePauseState();
    };

    this.currentUtterance.onresume = () => {
      this.handleResumeState();
    };

    window.speechSynthesis.speak(this.currentUtterance);
  }

  /**
   * Starts a smooth 100ms interval timer to update progress bar and elapsed time
   */
  private startProgressTimer(): void {
    this.stopProgressTimer();
    this.progressInterval = setInterval(() => {
      // Guard against running when paused or not playing
      if (this.isPaused() || !this.isPlaying()) {
        return;
      }

      const elapsed = this.pausedElapsedMs + (Date.now() - this.playbackStartTime);
      const pct = Math.min(99, Math.round((elapsed / this.estimatedDurationMs) * 100));
      
      // Only advance progress forward
      if (pct > this.playbackProgress()) {
        this.playbackProgress.set(pct);
      }
      this.elapsedTime.set(this.formatTime(elapsed));
    }, 100);
  }

  /**
   * Stops the progress timer interval immediately
   */
  private stopProgressTimer(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Internal helper to record pause timing & freeze progress
   */
  private handlePauseState(): void {
    if (this.isPlaying()) {
      this.pausedElapsedMs += Math.max(0, Date.now() - this.playbackStartTime);
    }
    this.stopProgressTimer();
    this.isPaused.set(true);
    this.isPlaying.set(false);
  }

  /**
   * Internal helper to resume timing
   */
  private handleResumeState(): void {
    this.playbackStartTime = Date.now();
    this.startProgressTimer();
    this.isPaused.set(false);
    this.isPlaying.set(true);
  }

  /**
   * Formats milliseconds into M:SS display string
   */
  private formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Pauses active speech synthesis
   */
  pauseSpeech(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.pause();
      } catch (err) {
        console.warn(`${LOG_PREFIXES.HARDWARE} Speech pause error:`, err);
      }
      this.handlePauseState();
      console.log(`${LOG_PREFIXES.ACTION} Audio paused ⏸️ (frozen at ${this.playbackProgress()}%)`);
    }
  }

  /**
   * Resumes paused speech synthesis
   */
  resumeSpeech(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (this.isPaused()) {
        try {
          window.speechSynthesis.resume();
        } catch (err) {
          console.warn(`${LOG_PREFIXES.HARDWARE} Speech resume error:`, err);
        }
        this.handleResumeState();
        console.log(`${LOG_PREFIXES.ACTION} Audio resumed ▶️ (continuing from ${this.playbackProgress()}%)`);
      } else {
        const text = this.activePlayerText();
        const lang = this.activePlayerLang();
        if (text) {
          this.playNativeSpeech(text, lang, this.playbackRate());
        }
      }
    }
  }

  /**
   * Replays current speech from 0%
   */
  replaySpeech(text?: string, targetLangCode?: string): void {
    const speechText = text || this.activePlayerText();
    const lang = targetLangCode || this.activePlayerLang();
    if (!speechText) return;

    console.log(`${LOG_PREFIXES.ACTION} Audio replay triggered 🔄`);
    this.playNativeSpeech(speechText, lang, this.playbackRate());
  }

  /**
   * Cycles playback speed (0.8x ➔ 1.0x ➔ 1.25x ➔ 1.5x)
   */
  cyclePlaybackRate(): number {
    const current = this.playbackRate();
    let nextRate = 1.0;

    if (current === 1.0) nextRate = 1.25;
    else if (current === 1.25) nextRate = 1.5;
    else if (current === 1.5) nextRate = 0.8;
    else nextRate = 1.0;

    this.playbackRate.set(nextRate);
    console.log(`${LOG_PREFIXES.ACTION} Playback speed set to: ${nextRate}x`);

    // If actively playing, restart with new rate
    if (this.isPlaying()) {
      this.playNativeSpeech(this.activePlayerText(), this.activePlayerLang(), nextRate);
    }

    return nextRate;
  }

  /**
   * Dismisses and closes the sticky bottom audio dock
   */
  dismissPlayer(): void {
    this.stopPlayback(true);
  }

  /**
   * Halts any active audio or speech synthesis stream immediately
   */
  stopPlayback(hidePlayer: boolean = true): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }

    if (this.currentAudioUrl) {
      try {
        URL.revokeObjectURL(this.currentAudioUrl);
      } catch {}
      this.currentAudioUrl = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    this.stopProgressTimer();
    this.isPlaying.set(false);
    this.isPaused.set(false);

    if (hidePlayer) {
      this.isPlayerVisible.set(false);
      this.playbackProgress.set(0);
      this.elapsedTime.set('0:00');
    }

    if (this.stateService.currentState === AppWorkflowState.PLAYING) {
      this.stateService.setWorkflowState(AppWorkflowState.IDLE);
    }
  }

  /**
   * Evaluates STT output to filter out non-verbal audio events ([background noise], [music], etc.)
   * and silence hallucinations. Returns clean spoken text or empty string "" if only noise was detected.
   */
  sanitizeAndValidateSpeechTranscript(
    raw: string, 
    words?: Array<{ type?: string; text?: string }>
  ): string {
    if (!raw || !raw.trim()) return '';

    let text = raw.trim();

    // 1. If all individual words are tagged as 'audio_event' (ElevenLabs Scribe metadata), discard as ambient noise
    if (words && words.length > 0) {
      const speechWords = words.filter(w => w.type !== 'audio_event' && w.text && !w.text.match(/^\[.*\]$/));
      if (speechWords.length === 0) {
        console.log(`${LOG_PREFIXES.ACTION} Filtered out non-speech audio events from ElevenLabs: "${raw}"`);
        return '';
      }
    }

    // 2. Remove bracketed acoustic events: [background noise], [silence], [music], [applause], [cough], [laughter], [throat-clearing], [cheering], [sigh], [snort], [whispering], [blank_audio], [ambient sound], etc.
    text = text.replace(/\[\s*(background noise|noise|silence|blank_audio|blank|music|applause|laughter|cough|sigh|throat-clearing|cheering|snort|snicker|ambient sound|static|crying|gasp|screaming|cheers)\s*\]/gi, '').trim();

    // 3. Remove generic bracketed single tags like "[background noise]" or parenthesized "(background noise)"
    text = text.replace(/^\[[\w\s_-]+\]$/gi, '').trim();
    text = text.replace(/^\([\w\s_-]+\)$/gi, '').trim();

    // 4. Filter known Whisper phantom hallucinations on silence
    const phantomSilencePhrases = [
      'thank you.',
      'thank you',
      'thanks for watching!',
      'thanks for watching.',
      'thanks for watching',
      'subtitles by the amara.org community',
      'subtitles by',
      'subscribe to my channel',
      'you'
    ];

    if (phantomSilencePhrases.includes(text.toLowerCase())) {
      console.log(`${LOG_PREFIXES.ACTION} Filtered out Whisper silence hallucination: "${text}"`);
      return '';
    }

    return text.trim();
  }

  /**
   * Executes Cloud STT via Whisper
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

    const formData = new FormData();
    const fileExt = audioBlob.type.includes('mp4') ? 'speech.mp4' : 'speech.webm';
    formData.append('file', audioBlob, fileExt);
    formData.append('model', model);
    if (languageCode) {
      formData.append('language', languageCode);
    }
    formData.append('response_format', 'json');
    formData.append('temperature', '0.0');

    const headers = new HttpHeaders({
      Authorization: `Bearer ${apiKey.trim()}`
    });

    try {
      const response = await firstValueFrom(
        this.http.post<WhisperTranscriptionResponse>(endpoint, formData, { headers })
      );

      const latency = Date.now() - startTime;
      const rawTranscript = (response?.text || '').trim();
      const transcript = this.sanitizeAndValidateSpeechTranscript(rawTranscript);

      if (!transcript) {
        console.log(`${LOG_PREFIXES.NETWORK} STT output was empty or non-speech noise ("${rawTranscript}"). Latency: ${latency}ms`);
        return '';
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
   * Executes Cloud STT via ElevenLabs Scribe
   */
  private async executeElevenLabsStt(audioBlob: Blob, languageCode: string, apiKey: string): Promise<string> {
    const startTime = Date.now();
    console.log(`${LOG_PREFIXES.NETWORK} Dispatching ElevenLabs Scribe STT request (${audioBlob.size} bytes)...`);

    const formData = new FormData();
    const fileExt = audioBlob.type.includes('mp4') ? 'speech.mp4' : 'speech.webm';
    formData.append('file', audioBlob, fileExt);
    formData.append('model_id', AI_MODELS.ELEVENLABS_STT_MODEL);
    if (languageCode) {
      formData.append('language_code', languageCode);
    }

    const headers = new HttpHeaders({
      'xi-api-key': apiKey.trim()
    });

    try {
      const response = await firstValueFrom(
        this.http.post<{ text: string; words?: Array<{ type?: string; text?: string }> }>(API_ENDPOINTS.ELEVENLABS_STT, formData, { headers })
      );

      const latency = Date.now() - startTime;
      const rawTranscript = (response?.text || '').trim();
      const transcript = this.sanitizeAndValidateSpeechTranscript(rawTranscript, response?.words);

      if (!transcript) {
        console.log(`${LOG_PREFIXES.NETWORK} ElevenLabs Scribe output was empty or non-speech noise ("${rawTranscript}"). Latency: ${latency}ms`);
        return '';
      }

      console.log(`${LOG_PREFIXES.NETWORK} ElevenLabs STT Transcription received in ${latency}ms: "${transcript}"`);
      return transcript;
    } catch (err) {
      console.warn(`${LOG_PREFIXES.NETWORK} ElevenLabs STT request error:`, err);
      throw err;
    }
  }

  /**
   * Executes LLM Chat Completion for translation with conversational prompt
   */
  private async executeCloudTranslation(
    text: string,
    sourceName: string,
    targetName: string,
    targetLangCode: string,
    endpoint: string,
    model: string,
    apiKey: string,
    providerName: string
  ): Promise<string> {
    const startTime = Date.now();
    console.log(
      `${LOG_PREFIXES.NETWORK} Dispatching LLM Translation [Provider: ${providerName}, Model: ${model}, ${sourceName} ➔ ${targetName}]`
    );

    const systemPrompt = `You are a real-time voice translator for spoken walkie-talkie conversations.
Translate the user's speech from ${sourceName} into natural, everyday conversational ${targetName} (${targetLangCode}).

CRITICAL VOICE TRANSLATION RULES:
1. NATURAL SPOKEN LANGUAGE: Translate using simple, clear, and commonly spoken everyday words that any native speaker easily understands. Avoid overly formal, literary, complex textbook terms, or stiff literal word-for-word translation (for Hindi, use natural everyday spoken Hindi/Hindustani, avoiding difficult archaic or Sanskritized vocabulary like 'प्रतिस्पर्धी' when natural phrasing like 'कड़ा मुकाबला' or 'बड़ा कॉम्पिटिशन' fits spoken conversation).
2. CONTEXTUAL & GRAMMATICAL ACCURACY: Translate the complete meaning, intent, and context naturally with flawless spoken grammar and smooth conversational flow.
3. COMPLETE TRANSLATION: Translate the entire input completely without omitting any sentences, ideas, or details.
4. DIRECT SPEECH OUTPUT ONLY: Output ONLY the raw translated text in ${targetName}. Do NOT include quotes, markdown formatting, notes, explanations, or <think> tags.
5. NATURAL PUNCTUATION: Use natural punctuation (commas, periods, question marks) so it sounds fluent and expressive when spoken aloud by text-to-speech.`;

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.1,
      max_tokens: 2048
    };

    const headers = new HttpHeaders({
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    });

    try {
      const response = await firstValueFrom(
        this.http.post<ChatCompletionResponse>(endpoint, body, { headers })
      );

      const latency = Date.now() - startTime;
      const rawContent = response?.choices?.[0]?.message?.content || '';
      const translation = this.cleanTranslationOutput(rawContent);

      console.log(
        `${LOG_PREFIXES.NETWORK} LLM Translation received in ${latency}ms: "${translation}" (Model: ${model})`
      );
      return translation;
    } catch (error) {
      // If Groq returned model_not_found or failed, try remaining candidates sequentially
      if (providerName === 'GROQ') {
        console.warn(`${LOG_PREFIXES.NETWORK} Groq model [${model}] failed, cycling through alternate models...`);
        for (const candidate of GROQ_LLM_CANDIDATES) {
          if (candidate === model) continue;

          try {
            console.log(`${LOG_PREFIXES.NETWORK} Attempting Groq fallback model: [${candidate}]...`);
            body['model'] = candidate;
            const retryRes = await firstValueFrom(
              this.http.post<ChatCompletionResponse>(endpoint, body, { headers })
            );
            const rawContent = retryRes?.choices?.[0]?.message?.content || '';
            const translation = this.cleanTranslationOutput(rawContent);

            const latency = Date.now() - startTime;
            console.log(`${LOG_PREFIXES.NETWORK} Groq fallback model [${candidate}] succeeded in ${latency}ms: "${translation}"`);
            // Cache successful model for future translations
            this.apiConfigService.setResolvedGroqModel(candidate);
            return translation;
          } catch (retryErr) {
            console.warn(`${LOG_PREFIXES.NETWORK} Fallback model [${candidate}] failed:`, retryErr);
          }
        }
      }

      const latency = Date.now() - startTime;
      console.error(`${LOG_PREFIXES.NETWORK} All LLM translation attempts failed after ${latency}ms:`, error);
      throw new Error(this.i18nService.get('errors.llmFailed'));
    }
  }

  /**
   * Cleans and sanitizes LLM translation output for flawless voice synthesis
   */
  private cleanTranslationOutput(raw: string): string {
    if (!raw) return '';
    let text = raw.trim();

    // 1. Strip complete <think>...</think> blocks
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // 2. Strip unclosed <think> tags (if model was cut off mid-thought)
    if (text.includes('<think>')) {
      const parts = text.split('</think>');
      text = parts.length > 1 ? parts[parts.length - 1].trim() : text.replace(/<think>[\s\S]*/gi, '').trim();
    }

    // 3. Strip accidental markdown code blocks
    text = text.replace(/^```[a-zA-Z]*\n?([\s\S]*?)```$/g, '$1').trim();

    // 4. Strip accidental surrounding quotes
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      text = text.slice(1, -1).trim();
    }

    // 5. Strip prefixes like "Translation: ", "Hindi: ", "Spanish: "
    text = text.replace(/^(Translation|Translated text|Hindi|Spanish|French|German|English):\s*/i, '').trim();

    return text;
  }

  /**
   * Sandbox simulation mode when user has not entered an API key
   */
  private async executeSandboxStt(languageCode: string, audioBlob: Blob): Promise<string> {
    console.log(
      `${LOG_PREFIXES.NETWORK} Sandbox STT mode active (no API key configured). Processing binary payload (${audioBlob.size} bytes)...`
    );

    await new Promise(resolve => setTimeout(resolve, 800));

    const sampleTranscriptions: Record<string, string> = {
      en: 'Hello, how are you doing today?',
      es: 'Hola, ¿cómo estás hoy?',
      fr: 'Bonjour, comment allez-vous aujourd\'hui ?',
      de: 'Hallo, wie geht es Ihnen heute?',
      hi: 'नमस्ते, आज आप कैसे हैं?',
      ja: 'こんにちは、今日の調子はいかがですか？',
      zh: '你好，你今天过得怎么样？'
    };

    const transcript = sampleTranscriptions[languageCode] || `Spoken input captured in [${languageCode.toUpperCase()}].`;
    console.log(`${LOG_PREFIXES.NETWORK} [Sandbox STT] Transcribed text: "${transcript}"`);
    return transcript;
  }

  private async executeSandboxTranslation(text: string, targetLangCode: string): Promise<string> {
    console.log(`${LOG_PREFIXES.NETWORK} Sandbox LLM translation active...`);
    await new Promise(resolve => setTimeout(resolve, 600));

    const sampleTranslations: Record<string, string> = {
      es: '¡Hola! ¿Cómo estás hoy?',
      fr: 'Bonjour ! Comment allez-vous aujourd\'hui ?',
      de: 'Hallo! Wie geht es Ihnen heute?',
      hi: 'नमस्ते! आज आप कैसे हैं?',
      ja: 'こんにちは！ 今日の調子はいかがですか？',
      zh: '你好！ 你今天过得怎么样？',
      en: 'Hello! How are you doing today?'
    };

    const translation = sampleTranslations[targetLangCode] || `[${targetLangCode.toUpperCase()}]: ${text}`;
    console.log(`${LOG_PREFIXES.NETWORK} [Sandbox LLM] Translated text: "${translation}"`);
    return translation;
  }
}
