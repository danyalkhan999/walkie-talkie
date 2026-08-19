import { Component, ChangeDetectionStrategy, inject, signal, OnDestroy, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { StateService } from '../../../../core/services/state.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { AudioRecordingService } from '../../../../core/services/audio-recording.service';
import { VoicePipelineService } from '../../../../core/services/voice-pipeline.service';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { AudioWaveformComponent } from '../audio-waveform/audio-waveform.component';
import { AppWorkflowState, LOG_PREFIXES, APP_TIMINGS, SUPPORTED_LANGUAGES } from '../../../../utils/constants';

@Component({
  selector: 'app-translator-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LanguageSelectorComponent,
    AudioWaveformComponent
  ],
  templateUrl: './translator-workspace.component.html',
  styleUrls: ['./translator-workspace.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TranslatorWorkspaceComponent implements OnDestroy {
  readonly stateService = inject(StateService);
  readonly i18nService = inject(I18nService);
  readonly audioRecordingService = inject(AudioRecordingService);
  readonly voicePipelineService = inject(VoicePipelineService);

  readonly AppWorkflowState = AppWorkflowState;

  // Editable Input Canvas Model
  readonly inputText = signal<string>('');

  // Toast feedback state
  readonly showCopyToast = signal<boolean>(false);
  private copyToastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly showNoiseToast = signal<boolean>(false);
  private noiseToastTimer: ReturnType<typeof setTimeout> | null = null;

  // Gesture tracking
  private pointerDownTime = 0;
  private isPointerDown = false;

  // Language change tracking for auto-re-translation
  private previousSourceLang = '';
  private previousTargetLang = '';
  private langSub: Subscription = new Subscription();

  constructor() {
    // 1. Sync speech-to-text transcripts into the editable input text model
    this.langSub.add(
      this.stateService.recordedText$.subscribe((text) => {
        if (text !== this.inputText()) {
          this.inputText.set(text || '');
        }
      })
    );

    // 2. Auto-re-translate when Source Language or Target Language changes
    this.previousSourceLang = this.stateService.currentSourceLanguage;
    this.previousTargetLang = this.stateService.currentTargetLanguage;

    this.langSub.add(
      this.stateService.sourceLanguage$.subscribe((source) => {
        if (this.previousSourceLang && this.previousSourceLang !== source) {
          this.previousSourceLang = source;
          this.onLanguageAutoTranslate();
        } else {
          this.previousSourceLang = source;
        }
      })
    );

    this.langSub.add(
      this.stateService.targetLanguage$.subscribe((target) => {
        if (this.previousTargetLang && this.previousTargetLang !== target) {
          this.previousTargetLang = target;
          this.onLanguageAutoTranslate();
        } else {
          this.previousTargetLang = target;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.langSub.unsubscribe();
    this.audioRecordingService.cancelRecording();
    this.voicePipelineService.stopPlayback(true);
  }

  /**
   * Keyboard shortcut (Ctrl+Enter / Cmd+Enter) for rapid translation
   */
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.manualTranslate();
    }
  }

  /**
   * Handles user typing or editing in the FROM card
   */
  onInputTextChange(value: string): void {
    this.inputText.set(value);
    this.stateService.setRecordedText(value);
  }

  /**
   * Clears the input text and dismisses target text and player dock
   */
  clearInputText(): void {
    this.inputText.set('');
    this.stateService.setRecordedText('');
    this.stateService.setTranslatedText('');
    this.voicePipelineService.dismissPlayer();
    console.log(`${LOG_PREFIXES.ACTION} Cleared input text`);
  }

  /**
   * Triggers manual translation of the current input text
   */
  async manualTranslate(): Promise<void> {
    const text = this.inputText().trim();
    if (!text) return;

    console.log(`${LOG_PREFIXES.ACTION} Manual translation triggered for: "${text}"`);
    this.voicePipelineService.stopPlayback(false);
    this.stateService.clearError();
    this.stateService.setWorkflowState(AppWorkflowState.PROCESSING);

    try {
      const sourceLang = this.stateService.currentSourceLanguage;
      const targetLang = this.stateService.currentTargetLanguage;

      const translated = await this.voicePipelineService.translateText(text, sourceLang, targetLang);
      this.stateService.setTranslatedText(translated);

      // Automatically speak translation and elevate the sticky player dock
      await this.voicePipelineService.speakTranslation(translated, targetLang);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : this.i18nService.get('errors.llmFailed');
      this.stateService.setError(errorMsg);
    }
  }

  /**
   * Automatically re-translates existing text when language selector changes
   */
  private onLanguageAutoTranslate(): void {
    const text = this.inputText().trim();
    if (text && this.stateService.currentState !== AppWorkflowState.RECORDING) {
      console.log(`${LOG_PREFIXES.ACTION} Auto-re-translating existing text on language change...`);
      this.manualTranslate();
    }
  }

  /**
   * Handles button click / tap toggle
   */
  async handleButtonClick(): Promise<void> {
    const currentState = this.stateService.currentState;
    console.log(`${LOG_PREFIXES.ACTION} Push-to-Talk clicked. Current state: [${currentState.toUpperCase()}]`);

    if (currentState === AppWorkflowState.IDLE || currentState === AppWorkflowState.PLAYING) {
      await this.startCapture();
    } else if (currentState === AppWorkflowState.RECORDING) {
      await this.stopCapture();
    } else if (currentState === AppWorkflowState.ERROR) {
      this.stateService.clearError();
      await this.startCapture();
    }
  }

  /**
   * Pointer down for Hold-to-Talk
   */
  async onPointerDown(event: MouseEvent | TouchEvent): Promise<void> {
    if (event instanceof MouseEvent && event.button !== 0) return;

    this.isPointerDown = true;
    this.pointerDownTime = Date.now();

    if (this.stateService.currentState === AppWorkflowState.PLAYING) {
      this.voicePipelineService.stopPlayback(false);
    }

    if (this.stateService.currentState === AppWorkflowState.IDLE) {
      await this.startCapture();
    }
  }

  /**
   * Pointer up for Hold-to-Talk
   */
  async onPointerUp(): Promise<void> {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;

    const holdDuration = Date.now() - this.pointerDownTime;
    if (holdDuration > 400 && this.stateService.currentState === AppWorkflowState.RECORDING) {
      console.log(`${LOG_PREFIXES.ACTION} Hold-to-Talk released after ${holdDuration}ms`);
      await this.stopCapture();
    }
  }

  async onPointerLeave(): Promise<void> {
    if (this.isPointerDown) {
      this.isPointerDown = false;
      const holdDuration = Date.now() - this.pointerDownTime;
      if (holdDuration > 400 && this.stateService.currentState === AppWorkflowState.RECORDING) {
        await this.stopCapture();
      }
    }
  }

  /**
   * Initiates real microphone audio capture
   */
  private async startCapture(): Promise<void> {
    try {
      this.voicePipelineService.stopPlayback(false);
      this.stateService.clearError();
      this.stateService.setWorkflowState(AppWorkflowState.REQUESTING_PERMISSION);
      
      await this.audioRecordingService.startRecording();
      this.stateService.setWorkflowState(AppWorkflowState.RECORDING);
      console.log(`${LOG_PREFIXES.ACTION} Microphone hot. Recording live voice audio...`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : this.i18nService.get('errors.hardwareError');
      this.stateService.setError(errorMsg);
    }
  }

  /**
   * Stops real microphone audio capture and orchestrates the full STT -> LLM -> TTS pipeline
   */
  private async stopCapture(): Promise<void> {
    try {
      console.log(`${LOG_PREFIXES.ACTION} Stopping audio recording...`);
      const result = await this.audioRecordingService.stopRecording();

      if (result && result.blob && result.blob.size > 0) {
        this.stateService.setWorkflowState(AppWorkflowState.PROCESSING);
        this.stateService.setCapturedAudioBlob(result.blob);

        const sourceLang = this.stateService.currentSourceLanguage;
        const targetLang = this.stateService.currentTargetLanguage;

        // 1. Transcribe & Filter Noise Gate
        const transcript = await this.voicePipelineService.transcribeAudio(result.blob, sourceLang);

        // If audio was pure ambient noise or non-speech events, exit cleanly without calling LLM
        if (!transcript || !transcript.trim()) {
          console.log(`${LOG_PREFIXES.ACTION} No spoken speech detected in audio (ambient noise discarded). Returning to IDLE.`);
          this.stateService.setWorkflowState(AppWorkflowState.IDLE);
          this.triggerNoiseToast();
          return;
        }

        this.inputText.set(transcript);
        this.stateService.setRecordedText(transcript);

        // 2. Translate
        const translatedText = await this.voicePipelineService.translateText(transcript, sourceLang, targetLang);
        this.stateService.setTranslatedText(translatedText);

        // 3. Speak & activate sticky player dock
        await this.voicePipelineService.speakTranslation(translatedText, targetLang);
      } else {
        this.stateService.setWorkflowState(AppWorkflowState.IDLE);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : this.i18nService.get('errors.hardwareError');
      this.stateService.setError(errorMsg);
    }
  }

  /**
   * Swaps Source and Target languages
   */
  swapLanguages(): void {
    console.log(`${LOG_PREFIXES.ACTION} Swap languages button clicked`);
    this.voicePipelineService.stopPlayback(false);
    this.stateService.swapLanguages();
  }

  /**
   * Audio Player Actions
   */
  togglePlayPause(): void {
    if (this.voicePipelineService.isPlaying()) {
      this.voicePipelineService.pauseSpeech();
    } else {
      this.voicePipelineService.resumeSpeech();
    }
  }

  replayAudio(): void {
    this.voicePipelineService.replaySpeech();
  }

  cyclePlaybackSpeed(): void {
    this.voicePipelineService.cyclePlaybackRate();
  }

  dismissPlayer(): void {
    this.voicePipelineService.dismissPlayer();
  }

  /**
   * Copies the translated text to the user's clipboard
   */
  async copyToClipboard(text: string): Promise<void> {
    if (!text) return;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      console.log(`${LOG_PREFIXES.ACTION} Copied text to clipboard: "${text}"`);

      if (this.copyToastTimer) clearTimeout(this.copyToastTimer);
      this.showCopyToast.set(true);
      this.copyToastTimer = setTimeout(() => {
        this.showCopyToast.set(false);
      }, APP_TIMINGS.TOAST_NOTIFICATION_MS);
    } catch (err) {
      console.error(`${LOG_PREFIXES.ACTION} Failed to copy to clipboard:`, err);
    }
  }

  getTargetLangFlag(): string {
    const code = this.stateService.currentTargetLanguage;
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
    return lang?.flag || '🌐';
  }

  getTargetLangName(): string {
    const code = this.stateService.currentTargetLanguage;
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
    return lang?.name || code.toUpperCase();
  }

  triggerNoiseToast(): void {
    if (this.noiseToastTimer) clearTimeout(this.noiseToastTimer);
    this.showNoiseToast.set(true);
    this.noiseToastTimer = setTimeout(() => {
      this.showNoiseToast.set(false);
    }, APP_TIMINGS.TOAST_NOTIFICATION_MS);
  }

  dismissError(): void {
    this.stateService.clearError();
  }
}
