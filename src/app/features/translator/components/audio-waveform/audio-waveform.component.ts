import { Component, ChangeDetectionStrategy, Input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioRecordingService } from '../../../../core/services/audio-recording.service';

@Component({
  selector: 'app-audio-waveform',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audio-waveform.component.html',
  styleUrls: ['./audio-waveform.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AudioWaveformComponent {
  @Input() barCount: number = 8;
  @Input() activeColor: 'recording' | 'playing' | 'primary' = 'recording';
  @Input() isPaused: boolean = false;

  readonly audioRecordingService = inject(AudioRecordingService);

  readonly bars = Array.from({ length: 8 }, (_, i) => i);

  /**
   * Calculates individual bar height based on live audio volume and bar index
   */
  getBarHeight(index: number): number {
    if (this.activeColor !== 'recording') {
      return 14; // Default baseline for CSS animation mode
    }

    const volume = this.audioRecordingService.volumeLevel(); // 0 - 100
    if (volume <= 0) return 6;

    // Distribute amplitude across bars in a symmetric bell curve
    const multiplier = 1 - Math.abs(index - 3.5) / 4.5;
    const computedHeight = Math.max(6, Math.min(32, Math.round(6 + (volume / 100) * 26 * multiplier)));
    return computedHeight;
  }
}
