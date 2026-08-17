import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

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

  readonly bars = Array.from({ length: 8 }, (_, i) => i);
}
