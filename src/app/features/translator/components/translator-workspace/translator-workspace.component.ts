import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../../../core/services/state.service';
import { I18nService } from '../../../../core/services/i18n.service';
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
export class TranslatorWorkspaceComponent {
  readonly stateService = inject(StateService);
  readonly i18nService = inject(I18nService);

  readonly AppWorkflowState = AppWorkflowState;

  // Toast feedback state
  readonly showCopyToast = signal<boolean>(false);
  private copyToastTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Toggles the Push-to-Talk recording action
   */
  toggleRecording(): void {
    const currentState = this.stateService.currentState;
    console.log(`${LOG_PREFIXES.ACTION} Push-to-Talk clicked. Current state: ${currentState}`);

    // In Activity 1, we use the simulated state cycle to verify UI transitions
    this.stateService.simulateMockWorkflow();
  }

  /**
   * Swaps Source and Target languages
   */
  swapLanguages(): void {
    console.log(`${LOG_PREFIXES.ACTION} Swap languages button clicked`);
    this.stateService.swapLanguages();
  }

  /**
   * Plays the translated audio (simulated in Activity 1)
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

      // Trigger temporary toast feedback
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
