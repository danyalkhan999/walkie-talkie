# AI Agent Execution Guide: The "Walkie-Talkie" Translator

## Project Overview
This project is a Client-Side Rendered (CSR) Angular application that functions as a real-time, voice-to-voice translation walkie-talkie. It uses a purely native browser implementation for audio capture and an asynchronous API pipeline (STT -> LLM -> TTS) for processing. 

**Core Objective:** Master the browser's `MediaRecorder` API, binary data handling (`Blob` / `FormData`), and complex asynchronous state management using RxJS.

## Strict Architectural Constraints
1. **Framework:** Angular (CSR only). **DO NOT enable SSR or SSG.**
2. **Hardware APIs:** Use native `navigator.mediaDevices.getUserMedia` and `MediaRecorder`. **DO NOT use third-party libraries for microphone capture.**
3. **State Management:** Use RxJS `BehaviorSubject` to drive a strict UI state machine. 
4. **UI/UX:** Single-component architecture centered around a semantic "Push-to-Talk" button. The UI must instantly reflect the internal state without waiting for network delays. Clean SVG iconography and semantic colors only.

## Global State Machine Definition
The UI must react strictly to these states emitted by the services:
* `IDLE`: Ready. Microphone icon, dimmed.
* `REQUESTING_PERMISSION`: Waiting for user to approve browser prompt. Pulsing UI.
* `RECORDING`: Microphone hot. Waveform animation, active accent color.
* `PROCESSING`: Audio chunk sent to network. Loading spinner.
* `PLAYING`: TTS response playing. Speaker icon, playing animation.
* `ERROR`: Critical failure (permissions denied, API timeout). Warning state.

---

## Execution Plan: Activity-Based Learning

The agent must execute this project strictly in the following sequential activities. Do not move to the next activity until the current one is completely functional and bulletproof.

### Activity 1: The UI and State Foundation
**Goal:** Build the single interactive component and the RxJS state skeleton.
1. Generate a standalone Angular component for the Walkie-Talkie interface.
2. Implement the UI layout based on the "Lovable" prompt specs (Centered card, Source/Target language dropdowns, giant multi-state button).
3. Create a basic `StateService` using a `BehaviorSubject` to mock the state transitions.
4. Wire the UI component to react visually to the mocked state transitions (ensuring clean CSS/SVG updates per state).
*Verification:* Clicking the button cycles through the states perfectly with zero lag.

### Activity 2: The Hardware Layer (Audio Capture)
**Goal:** Master the `MediaRecorder` API and prevent memory leaks.
1. Create `AudioRecordingService`.
2. Implement a method to request `audio: true` from `navigator.mediaDevices`.
3. Initialize the `MediaRecorder`. 
4. Capture audio data chunks in the `ondataavailable` event.
5. On `stop()`, assemble the chunks into a `Blob` (type: `audio/webm` or `audio/wav`).
6. **Crucial:** Implement a teardown method that iterates through all `MediaStream` tracks and calls `.stop()` to release the microphone hardware and turn off the browser's red recording indicator.
*Verification:* Holding the UI button turns on the mic, releasing it logs a `Blob` to the console, and the browser mic indicator immediately turns off.

### Activity 3: The Network Layer (STT Integration)
**Goal:** Handle binary data payloads and async network requests.
1. Create `VoicePipelineService`.
2. Take the `Blob` generated from Activity 2 and append it to a `FormData` object.
3. Construct an HTTP request to an STT API (e.g., OpenAI Whisper).
4. Update the RxJS state to `PROCESSING` while the request is in flight.
5. Extract the transcribed text from the API response and log it.
*Verification:* Spoken words are successfully logged as a text string in the browser console. 

### Activity 4: The Brain and The Voice (LLM & TTS)
**Goal:** Complete the pipeline and handle audio playback.
1. Extend `VoicePipelineService` to send the transcribed text and the selected Target Language to an LLM endpoint (e.g., GPT-4o-mini) for translation.
2. Chain the translated text response into a TTS API request (e.g., ElevenLabs or OpenAI TTS).
3. The TTS API will return an audio buffer/blob.
4. Load this blob into an HTML5 `Audio` object.
5. Change state to `PLAYING`, play the audio, and listen for the `ended` event to return the state back to `IDLE`.
*Verification:* User speaks in English, waits a few seconds, and the application speaks back in Spanish.

## Final Review Check
* Does the app handle a user denying microphone permissions gracefully?
* Is there any lingering audio track memory leak when the component is destroyed?
* Does the UI state transition instantly on button press/release?
