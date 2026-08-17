import { Injectable, signal, inject } from '@angular/core';
import { AUDIO_CONFIG, LOG_PREFIXES } from '../../utils/constants';
import { I18nService } from './i18n.service';

export interface AudioRecordingResult {
  blob: Blob;
  durationMs: number;
  mimeType: string;
}

@Injectable({
  providedIn: 'root'
})
export class AudioRecordingService {
  private readonly i18nService = inject(I18nService);

  // Real-time audio volume level (0 - 100) emitted for waveform visualization
  readonly volumeLevel = signal<number>(0);

  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingStartTime = 0;
  private selectedMimeType = 'audio/webm';

  // Web Audio API analysis
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private animationFrameId: number | null = null;

  /**
   * Checks whether the current environment is a Secure Context (HTTPS or localhost)
   */
  isSecureContext(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.isSecureContext === true ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
  }

  /**
   * Validates if the browser supports native media devices and MediaRecorder
   */
  isSupported(): boolean {
    if (!this.isSecureContext()) return false;
    const hasMediaDevices = !!(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
    const hasMediaRecorder = typeof window !== 'undefined' && 'MediaRecorder' in window;
    return hasMediaDevices && hasMediaRecorder;
  }

  /**
   * Resolves the highest quality supported audio MIME type for the user's browser
   */
  private getBestSupportedMimeType(): string {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
      return 'audio/webm';
    }

    for (const candidate of AUDIO_CONFIG.MIME_TYPE_CANDIDATES) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        console.log(`${LOG_PREFIXES.HARDWARE} Selected supported MIME type: ${candidate}`);
        return candidate;
      }
    }

    return 'audio/webm';
  }

  /**
   * Requests microphone access, initializes MediaRecorder, and starts audio analysis
   */
  async startRecording(): Promise<void> {
    if (!this.isSecureContext()) {
      const errorMsg = this.i18nService.get('errors.insecureContext');
      console.error(`${LOG_PREFIXES.HARDWARE} ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (!this.isSupported()) {
      const errorMsg = this.i18nService.get('errors.hardwareError');
      console.error(`${LOG_PREFIXES.HARDWARE} Browser does not support MediaRecorder or getUserMedia`);
      throw new Error(errorMsg);
    }

    this.audioChunks = [];
    this.selectedMimeType = this.getBestSupportedMimeType();

    try {
      console.log(`${LOG_PREFIXES.HARDWARE} Requesting microphone access from navigator.mediaDevices...`);
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log(`${LOG_PREFIXES.HARDWARE} Microphone stream acquired. Active tracks:`, this.mediaStream.getAudioTracks().length);

      // Initialize MediaRecorder
      const options: MediaRecorderOptions = { mimeType: this.selectedMimeType };
      this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Start recording with timeslice chunk intervals
      this.mediaRecorder.start(AUDIO_CONFIG.TIMESLICE_MS);
      this.recordingStartTime = Date.now();
      console.log(`${LOG_PREFIXES.HARDWARE} MediaRecorder started [state: ${this.mediaRecorder.state}]`);

      // Initialize AudioContext & AnalyserNode for volume visualization
      this.setupVolumeAnalysis(this.mediaStream);
    } catch (error: unknown) {
      this.teardownHardware();
      const domError = error as DOMException;

      if (domError.name === 'NotAllowedError' || domError.name === 'PermissionDeniedError') {
        const msg = this.i18nService.get('errors.micPermissionDenied');
        console.warn(`${LOG_PREFIXES.HARDWARE} User denied microphone permission:`, domError);
        throw new Error(msg);
      } else if (domError.name === 'NotFoundError' || domError.name === 'DevicesNotFoundError') {
        const msg = this.i18nService.get('errors.noMicFound');
        console.warn(`${LOG_PREFIXES.HARDWARE} No microphone device found:`, domError);
        throw new Error(msg);
      } else {
        const msg = this.i18nService.get('errors.hardwareError');
        console.error(`${LOG_PREFIXES.HARDWARE} Unexpected hardware error:`, error);
        throw new Error(msg);
      }
    }
  }

  /**
   * Stops recording, releases hardware tracks immediately, and returns the assembled Audio Blob
   */
  stopRecording(): Promise<AudioRecordingResult | null> {
    return new Promise((resolve) => {
      const durationMs = Date.now() - this.recordingStartTime;

      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.teardownHardware();
        resolve(null);
        return;
      }

      // Guard: Ignore micro-clicks shorter than threshold
      if (durationMs < AUDIO_CONFIG.MIN_RECORDING_DURATION_MS) {
        console.warn(`${LOG_PREFIXES.HARDWARE} Recording discarded: duration (${durationMs}ms) below threshold (${AUDIO_CONFIG.MIN_RECORDING_DURATION_MS}ms)`);
        this.teardownHardware();
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: this.selectedMimeType });
        console.log(
          `${LOG_PREFIXES.HARDWARE} Recording assembled: Blob { size: ${audioBlob.size} bytes, type: "${audioBlob.type}", duration: ${(durationMs / 1000).toFixed(2)}s }`
        );

        // Crucial: Release all hardware tracks immediately
        this.teardownHardware();

        resolve({
          blob: audioBlob,
          durationMs,
          mimeType: this.selectedMimeType
        });
      };

      try {
        this.mediaRecorder.stop();
        console.log(`${LOG_PREFIXES.HARDWARE} MediaRecorder stop() called`);
      } catch (err) {
        console.error(`${LOG_PREFIXES.HARDWARE} Error stopping MediaRecorder:`, err);
        this.teardownHardware();
        resolve(null);
      }
    });
  }

  /**
   * Cancels and cleans up recording immediately
   */
  cancelRecording(): void {
    console.log(`${LOG_PREFIXES.HARDWARE} Recording cancelled by user`);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.teardownHardware();
  }

  /**
   * Connects AnalyserNode to stream and samples volume amplitude at 60fps
   */
  private setupVolumeAnalysis(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = AUDIO_CONFIG.FFT_SIZE;
      this.analyserNode.smoothingTimeConstant = AUDIO_CONFIG.SMOOTHING_TIME_CONSTANT;

      source.connect(this.analyserNode);

      const bufferLength = this.analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!this.analyserNode) return;

        this.analyserNode.getByteFrequencyData(dataArray);
        
        // Calculate average amplitude
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        
        this.volumeLevel.set(normalized);
        this.animationFrameId = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.warn(`${LOG_PREFIXES.HARDWARE} Could not initialize audio volume analyzer:`, err);
    }
  }

  /**
   * Crucial Hardware Teardown:
   * 1. Iterates through every MediaStreamTrack and calls track.stop() to turn off browser mic indicator
   * 2. Closes AudioContext
   * 3. Cancels animation frames
   * 4. Resets volume level to 0
   */
  private teardownHardware(): void {
    // Stop all audio tracks
    if (this.mediaStream) {
      const tracks = this.mediaStream.getTracks();
      tracks.forEach((track) => {
        track.stop();
        console.log(`${LOG_PREFIXES.HARDWARE} MediaStreamTrack stopped: [kind: ${track.kind}, label: "${track.label}"]`);
      });
      this.mediaStream = null;
    }

    // Stop volume analysis
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    this.analyserNode = null;
    this.mediaRecorder = null;
    this.volumeLevel.set(0);

    console.log(`${LOG_PREFIXES.HARDWARE} Hardware teardown complete. Browser microphone released.`);
  }
}
