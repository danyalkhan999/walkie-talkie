import { Component, ChangeDetectionStrategy, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../../../core/services/state.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { AudioRecordingService } from '../../../../core/services/audio-recording.service';
import { VoicePipelineService } from '../../../../core/services/voice-pipeline.service';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { AudioWaveformComponent } from '../audio-waveform/audio-waveform.component';
import { AppWorkflowState, LOG_PREFIXES, APP_TIMINGS } from '../../../../utils/constants';

@Component({
  selector: 'app-translator-workspace',
  standalone: true,
  imports: [
    CommonModule,
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

  // Toast feedback state
  readonly showCopyToast = signal<boolean>(false);
  private copyToastTimer: ReturnType<typeof setTimeout> | null = null;
  private downstreamTimer: ReturnType<typeof setTimeout> | null = null;

  // Press-and-Hold vs Click-to-Toggle gesture tracking
  private pointerDownTime = 0;
  private isPointerDown = false;

  ngOnDestroy(): void {
    // Teardown hardware if component is destroyed while recording
    this.audioRecordingService.cancelRecording();
    if (this.downstreamTimer) clearTimeout(this.downstreamTimer);
  }

  /**
   * Handles button click / tap toggle
   */
  async handleButtonClick(): Promise<void> {
    const currentState = this.stateService.currentState;
    console.log(`${LOG_PREFIXES.ACTION} Push-to-Talk clicked. Current state: [${currentState.toUpperCase()}]`);

    if (currentState === AppWorkflowState.IDLE) {
      await this.startCapture();
    } else if (currentState === AppWorkflowState.RECORDING) {
      await this.stopCapture();
    } else if (currentState === AppWorkflowState.ERROR) {
      this.stateService.clearError();
      await this.startCapture();
    }
  }

  /**
   * Pointer down (mousedown / touchstart) for Hold-to-Talk
   */
  async onPointerDown(event: MouseEvent | TouchEvent): Promise<void> {
    // Only primary mouse button or touch
    if (event instanceof MouseEvent && event.button !== 0) return;

    this.isPointerDown = true;
    this.pointerDownTime = Date.now();

    if (this.stateService.currentState === AppWorkflowState.IDLE) {
      await this.startCapture();
    }
  }

  /**
   * Pointer up (mouseup / touchend) for Hold-to-Talk
   */
  async onPointerUp(): Promise<void> {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;

    const holdDuration = Date.now() - this.pointerDownTime;
    // If user held for > 400ms, treat as hold-to-talk release
    if (holdDuration > 400 && this.stateService.currentState === AppWorkflowState.RECORDING) {
      console.log(`${LOG_PREFIXES.ACTION} Hold-to-Talk released after ${holdDuration}ms`);
      await this.stopCapture();
    }
  }

  /**
   * Pointer leaves button boundary while holding
   */
  async onPointerLeave(): Promise<void> {
    if (this.isPointerDown) {
      this.isPointerDown = false;
      const holdDuration = Date.now() - this.pointerDownTime;
      if (holdDuration > 400 && this.stateService.currentState === AppWorkflowState.RECORDING) {
        console.log(`${LOG_PREFIXES.ACTION} Pointer left button boundary, stopping recording`);
        await this.stopCapture();
      }
    }
  }

  /**
   * Initiates real microphone audio capture
   */
  private async startCapture(): Promise<void> {
    try {
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
   * Stops real microphone audio capture and dispatches to STT VoicePipeline
   */
  private async stopCapture(): Promise<void> {
    try {
      console.log(`${LOG_PREFIXES.ACTION} Stopping audio recording...`);
      const result = await this.audioRecordingService.stopRecording();

      if (result && result.blob && result.blob.size > 0) {
        console.log(
          `${LOG_PREFIXES.HARDWARE} Audio capture successful: Blob { size: ${result.blob.size} bytes, type: "${result.mimeType}", duration: ${(result.durationMs / 1000).toFixed(2)}s }`
        );
        
        // Activity 3: The Network Layer (STT Integration)
        this.stateService.setWorkflowState(AppWorkflowState.PROCESSING);
        this.stateService.setCapturedAudioBlob(result.blob);
        this.stateService.setTranslatedText('');

        const sourceLang = this.stateService.currentSourceLanguage;
        const transcript = await this.voicePipelineService.transcribeAudio(result.blob, sourceLang);
        
        console.log(`${LOG_PREFIXES.ACTION} Spoken words successfully transcribed: "${transcript}"`);
        this.stateService.setRecordedText(transcript);

        // Simulated downstream translation preview (Activity 4 will connect real LLM & TTS)
        this.runDownstreamPreview(transcript);
      } else {
        console.log(`${LOG_PREFIXES.HARDWARE} Recording was discarded or empty.`);
        this.stateService.setWorkflowState(AppWorkflowState.IDLE);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : this.i18nService.get('errors.hardwareError');
      this.stateService.setError(errorMsg);
    }
  }

  /**
   * Downstream preview until Activity 4 connects real LLM translation & TTS audio playback
   */
  private runDownstreamPreview(transcript: string): void {
    if (this.downstreamTimer) clearTimeout(this.downstreamTimer);

    this.downstreamTimer = setTimeout(() => {
      const targetLang = this.stateService.currentTargetLanguage;
      const previewText = `[Translation in ${targetLang.toUpperCase()}]: ${transcript}`;
      
      this.stateService.setTranslatedText(previewText);
      this.stateService.setWorkflowState(AppWorkflowState.PLAYING);

      this.downstreamTimer = setTimeout(() => {
        if (this.stateService.currentState === AppWorkflowState.PLAYING) {
          this.stateService.setWorkflowState(AppWorkflowState.IDLE);
          console.log(`${LOG_PREFIXES.ACTION} Pipeline cycle finished. Returned to IDLE.`);
        }
      }, APP_TIMINGS.SIMULATED_PLAYBACK_MS);
    }, 1200);
  }

  /**
   * Swaps Source and Target languages
   */
  swapLanguages(): void {
    console.log(`${LOG_PREFIXES.ACTION} Swap languages button clicked`);
    this.stateService.swapLanguages();
  }

  /**
   * Plays the translated audio
   */
  playOutputAudio(text: string): void {
    console.log(`${LOG_PREFIXES.ACTION} Play audio output clicked for text: "${text}"`);
    this.stateService.setWorkflowState(AppWorkflowState.PLAYING);

    setTimeout(() => {
      if (this.stateService.currentState === AppWorkflowState.PLAYING) {
        this.stateService.setWorkflowState(AppWorkflowState.IDLE);
        console.log(`${LOG_PREFIXES.ACTION} Audio playback ended. Returned to IDLE`);
      }
    }, APP_TIMINGS.SIMULATED_PLAYBACK_MS);
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

      // Temporary toast feedback
      if (this.copyToastTimer) clearTimeout(this.copyToastTimer);
      this.showCopyToast.set(true);
      this.copyToastTimer = setTimeout(() => {
        this.showCopyToast.set(false);
      }, APP_TIMINGS.TOAST_NOTIFICATION_MS);
    } catch (err) {
      console.error(`${LOG_PREFIXES.ACTION} Failed to copy to clipboard:`, err);
    }
  }

  dismissError(): void {
    console.log(`${LOG_PREFIXES.ACTION} Error alert dismissed by user`);
    this.stateService.clearError();
  }
}
