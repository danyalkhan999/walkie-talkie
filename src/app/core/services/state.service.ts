import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { 
  AppWorkflowState, 
  DEFAULT_SOURCE_LANGUAGE, 
  DEFAULT_TARGET_LANGUAGE, 
  STORAGE_KEYS, 
  LOG_PREFIXES, 
  APP_TIMINGS 
} from '../../utils/constants';
import { getLocalStorageItem, setLocalStorageItem } from '../../utils/storage.utils';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  // Workflow State Machine (BehaviorSubject)
  private readonly workflowStateSubject = new BehaviorSubject<AppWorkflowState>(AppWorkflowState.IDLE);
  readonly workflowState$: Observable<AppWorkflowState> = this.workflowStateSubject.asObservable();

  // Language States
  private readonly sourceLanguageSubject = new BehaviorSubject<string>(
    getLocalStorageItem<string>(STORAGE_KEYS.SOURCE_LANGUAGE, DEFAULT_SOURCE_LANGUAGE)
  );
  readonly sourceLanguage$: Observable<string> = this.sourceLanguageSubject.asObservable();

  private readonly targetLanguageSubject = new BehaviorSubject<string>(
    getLocalStorageItem<string>(STORAGE_KEYS.TARGET_LANGUAGE, DEFAULT_TARGET_LANGUAGE)
  );
  readonly targetLanguage$: Observable<string> = this.targetLanguageSubject.asObservable();

  // Content States
  private readonly recordedTextSubject = new BehaviorSubject<string>('');
  readonly recordedText$: Observable<string> = this.recordedTextSubject.asObservable();

  private readonly translatedTextSubject = new BehaviorSubject<string>('');
  readonly translatedText$: Observable<string> = this.translatedTextSubject.asObservable();

  // Audio Blob Buffer (Binary captured payload)
  private readonly capturedAudioBlobSubject = new BehaviorSubject<Blob | null>(null);
  readonly capturedAudioBlob$: Observable<Blob | null> = this.capturedAudioBlobSubject.asObservable();

  // Error State
  private readonly errorMessageSubject = new BehaviorSubject<string | null>(null);
  readonly errorMessage$: Observable<string | null> = this.errorMessageSubject.asObservable();

  // Internal timer reference for mock pipeline
  private simulationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    console.log(`${LOG_PREFIXES.STATE} Initialized with state: ${this.workflowStateSubject.value}`);
  }

  get currentState(): AppWorkflowState {
    return this.workflowStateSubject.value;
  }

  get currentSourceLanguage(): string {
    return this.sourceLanguageSubject.value;
  }

  get currentTargetLanguage(): string {
    return this.targetLanguageSubject.value;
  }

  get latestAudioBlob(): Blob | null {
    return this.capturedAudioBlobSubject.value;
  }

  /**
   * Transitions the workflow to a new state and logs the transition
   */
  setWorkflowState(newState: AppWorkflowState): void {
    const previous = this.workflowStateSubject.value;
    if (previous === newState) return;

    console.log(`${LOG_PREFIXES.STATE} Transitioning from [${previous.toUpperCase()}] -> [${newState.toUpperCase()}]`);
    this.workflowStateSubject.next(newState);
  }

  /**
   * Sets the source language and persists preference
   */
  setSourceLanguage(langCode: string): void {
    if (this.sourceLanguageSubject.value === langCode) return;
    
    console.log(`${LOG_PREFIXES.ACTION} Source language changed to: ${langCode}`);
    this.sourceLanguageSubject.next(langCode);
    setLocalStorageItem(STORAGE_KEYS.SOURCE_LANGUAGE, langCode);
  }

  /**
   * Sets the target language and persists preference
   */
  setTargetLanguage(langCode: string): void {
    if (this.targetLanguageSubject.value === langCode) return;
    
    console.log(`${LOG_PREFIXES.ACTION} Target language changed to: ${langCode}`);
    this.targetLanguageSubject.next(langCode);
    setLocalStorageItem(STORAGE_KEYS.TARGET_LANGUAGE, langCode);
  }

  /**
   * Swaps source and target languages
   */
  swapLanguages(): void {
    const currentSource = this.sourceLanguageSubject.value;
    const currentTarget = this.targetLanguageSubject.value;

    console.log(`${LOG_PREFIXES.ACTION} Swapped languages: ${currentSource} <-> ${currentTarget}`);
    
    this.sourceLanguageSubject.next(currentTarget);
    this.targetLanguageSubject.next(currentSource);

    setLocalStorageItem(STORAGE_KEYS.SOURCE_LANGUAGE, currentTarget);
    setLocalStorageItem(STORAGE_KEYS.TARGET_LANGUAGE, currentSource);

    // Swap texts if any exist
    const currentRecorded = this.recordedTextSubject.value;
    const currentTranslated = this.translatedTextSubject.value;
    if (currentRecorded || currentTranslated) {
      this.recordedTextSubject.next(currentTranslated);
      this.translatedTextSubject.next(currentRecorded);
    }
  }

  setRecordedText(text: string): void {
    this.recordedTextSubject.next(text);
  }

  setTranslatedText(text: string): void {
    this.translatedTextSubject.next(text);
  }

  setCapturedAudioBlob(blob: Blob | null): void {
    this.capturedAudioBlobSubject.next(blob);
  }

  setError(message: string | null): void {
    if (message) {
      console.warn(`${LOG_PREFIXES.STATE} Error reported: ${message}`);
      this.errorMessageSubject.next(message);
      this.setWorkflowState(AppWorkflowState.ERROR);
    } else {
      this.errorMessageSubject.next(null);
      if (this.currentState === AppWorkflowState.ERROR) {
        this.setWorkflowState(AppWorkflowState.IDLE);
      }
    }
  }

  clearError(): void {
    this.setError(null);
  }

  /**
   * Activity 2 pipeline: Simulates translation after real audio blob is captured
   */
  processRecordedAudio(blob: Blob, durationMs: number): void {
    this.setCapturedAudioBlob(blob);
    this.setWorkflowState(AppWorkflowState.PROCESSING);
    this.setRecordedText('Voice input captured successfully (' + (durationMs / 1000).toFixed(1) + 's).');
    this.setTranslatedText('');

    if (this.simulationTimer) clearTimeout(this.simulationTimer);

    // Activity 2 simulation of downstream pipeline (STT/LLM will replace this in Act 3/4)
    this.simulationTimer = setTimeout(() => {
      const mockTranslations: Record<string, string> = {
        es: '¡Hola! Entrada de voz procesada con éxito.',
        fr: 'Bonjour ! Entrée vocale traitée avec succès.',
        de: 'Hallo! Spracheingabe erfolgreich verarbeitet.',
        hi: 'नमस्ते! ध्वनि इनपुट सफलतापूर्वक संसाधित हुआ।',
        ja: 'こんにちは！ 音声入力が正常に処理されました。',
        zh: '你好！ 语音输入处理成功。'
      };

      const targetLang = this.targetLanguageSubject.value;
      const translated = mockTranslations[targetLang] || `[${targetLang.toUpperCase()}] Voice processed (${blob.size} bytes).`;
      
      this.setTranslatedText(translated);
      this.setWorkflowState(AppWorkflowState.PLAYING);
      console.log(`${LOG_PREFIXES.ACTION} Playback started for audio translation.`);

      this.simulationTimer = setTimeout(() => {
        if (this.currentState === AppWorkflowState.PLAYING) {
          this.setWorkflowState(AppWorkflowState.IDLE);
          console.log(`${LOG_PREFIXES.ACTION} Audio output finished. Returned to IDLE.`);
        }
      }, APP_TIMINGS.SIMULATED_PLAYBACK_MS);
    }, APP_TIMINGS.SIMULATED_PROCESSING_MS);
  }
}
