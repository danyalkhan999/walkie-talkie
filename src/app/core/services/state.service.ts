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

  // Error State
  private readonly errorMessageSubject = new BehaviorSubject<string | null>(null);
  readonly errorMessage$: Observable<string | null> = this.errorMessageSubject.asObservable();

  // Internal timer reference for simulation
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
   * Activity 1: Simulates the complete pipeline cycle for UI verification
   */
  simulateMockWorkflow(): void {
    if (this.simulationTimer) {
      clearTimeout(this.simulationTimer);
    }

    if (this.currentState === AppWorkflowState.IDLE) {
      // Step 1: Start Recording
      console.log(`${LOG_PREFIXES.ACTION} [Mock Simulation] User pressed Push-to-Talk (Start Recording)`);
      this.setWorkflowState(AppWorkflowState.RECORDING);
      this.recordedTextSubject.next('Hello, how are you doing today?');
      this.translatedTextSubject.next('');
    } else if (this.currentState === AppWorkflowState.RECORDING) {
      // Step 2: Stop Recording -> Processing
      console.log(`${LOG_PREFIXES.ACTION} [Mock Simulation] User released Push-to-Talk (Stop Recording)`);
      this.setWorkflowState(AppWorkflowState.PROCESSING);

      // Step 3: Transition to Playing
      this.simulationTimer = setTimeout(() => {
        const mockTranslations: Record<string, string> = {
          es: '¡Hola! ¿Cómo estás hoy?',
          fr: 'Bonjour, comment allez-vous aujourd\'hui ?',
          de: 'Hallo, wie geht es Ihnen heute?',
          hi: 'नमस्ते, आज आप कैसे हैं?',
          ja: 'こんにちは、今日の調子はいかがですか？',
          zh: '你好，你今天过得怎么样？'
        };

        const targetLang = this.targetLanguageSubject.value;
        const translated = mockTranslations[targetLang] || `[Translation in ${targetLang}] Hello, how are you doing today?`;
        
        this.translatedTextSubject.next(translated);
        this.setWorkflowState(AppWorkflowState.PLAYING);
        console.log(`${LOG_PREFIXES.ACTION} [Mock Simulation] Pipeline finished. Playing output: "${translated}"`);

        // Step 4: Back to Idle
        this.simulationTimer = setTimeout(() => {
          this.setWorkflowState(AppWorkflowState.IDLE);
          console.log(`${LOG_PREFIXES.ACTION} [Mock Simulation] Audio finished. Back to IDLE`);
        }, APP_TIMINGS.SIMULATED_PLAYBACK_MS);
      }, APP_TIMINGS.SIMULATED_PROCESSING_MS);
    } else if (this.currentState === AppWorkflowState.PLAYING) {
      console.log(`${LOG_PREFIXES.ACTION} [Mock Simulation] Interrupted playback`);
      this.setWorkflowState(AppWorkflowState.IDLE);
    }
  }
}
