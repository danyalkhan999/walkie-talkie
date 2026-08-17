# Angular Architecture & Design Standards

This document establishes the mandatory architectural rules, coding standards, and best practices for building scalable, high-performance, and maintainable Angular applications.

---

## 1. Project & Directory Structure

Organize the codebase following a modular, domain-driven structure:

```
src/app/
├── core/                  # Singleton services, interceptors, guards (app-wide single instance)
│   ├── interceptors/
│   └── services/
├── features/              # Feature modules / domain components (e.g., walkie-talkie)
│   └── walkie-talkie/
│       ├── components/    # Presentational sub-components (if any)
│       ├── services/      # Feature-specific services
│       └── walkie-talkie.component.ts
├── shared/                # Shared reusable UI components, directives, pipes, modals
│   ├── components/
│   ├── modal/
│   └── ui/
├── utils/                 # Pure helper functions, storage wrappers, constants
│   ├── constants.ts       # Global and feature-level constant values
│   └── storage.utils.ts   # Safe storage helper wrappers
├── models/                # TypeScript interfaces, types, enums
│   └── state.types.ts
└── styles/                # Global style variables and theme tokens
    └── variables.scss
```

---

## 2. Component Design Principles

### 2.1 Standalone Components by Default
- Build all new components, directives, and pipes as **Standalone** (`standalone: true` or default in modern Angular).
- Import only the specific dependencies required in the `imports` array.

### 2.2 Container (Smart) vs. Presentational (Dumb) Components
- **Container Components**: Manage state, inject services, and handle business logic / orchestrations.
- **Presentational Components**: Purely visual. Receive data via inputs (`@Input()` or `input()`), emit user actions via outputs (`@Output()` or `output()`), and have no direct service/network side-effects.

### 2.3 `ChangeDetectionStrategy.OnPush`
- Always apply `changeDetection: ChangeDetectionStrategy.OnPush` across all components to ensure predictable rendering and maximum performance.
- Rely on Observables with the `async` pipe or Angular Signals for reactive view updates.

### 2.4 Modern Control Flow
- Use modern Angular control flow syntax (`@if`, `@for`, `@switch`) instead of legacy structural directives (`*ngIf`, `*ngFor`, `*ngSwitch`).
- Always provide a unique tracking key for loops (e.g., `@for (item of items; track item.id)`).

---

## 3. State Management & Reactivity

### 3.1 Unidirectional Data Flow
- State flows down, actions flow up.
- Never directly mutate service state objects in components. Expose read-only `Observable`s (e.g., `asObservable()`) or `Signal`s to the view.

### 3.2 Subscription Hygiene & Memory Leak Prevention
- **Avoid manual `.subscribe()`** in components whenever possible; prefer the `async` pipe in templates.
- If a manual subscription is strictly necessary:
  - Use `takeUntilDestroyed()` (using `DestroyRef`) or `takeUntil(this.destroy$)` in `ngOnDestroy()`.
  - Always clean up external event listeners, timers (`setInterval`/`setTimeout`), and hardware connections.

---

## 4. Hardware & Resource Lifecycle Rules (Audio / Media)

### 4.1 Strict Hardware Release
- When capturing microphone audio via `navigator.mediaDevices.getUserMedia`:
  - Iteratively stop all active tracks (`track.stop()`) immediately upon recording completion or cancellation.
  - Release hardware references on component destruction (`ngOnDestroy`).
- Do not leave background audio recording streams alive.

### 4.2 Safe Cleanup Checklist
- Audio Elements / Buffers: Pause and detach `srcObject` / `src` on teardown.
- MediaRecorder: Ensure `recorder.state !== 'inactive'` before calling `.stop()`.

---

## 5. Styling & Design Token Standards

### 5.1 No Hardcoded Design Values
- **Never hardcode** colors (hex/rgb), spacing units (px), font sizes, borders, or shadow values directly inside component `.scss` files.
- Declare all design values as semantic CSS variables inside `src/styles/variables.scss` (e.g., `--color-primary`, `--spacing-md`, `--radius-lg`).

### 5.2 Micro Frontend (MFE) / Shared UI Mirroring
- Whenever a design token is defined in a feature/MFE `variables.scss`, mirror the same token in the shared UI library’s `global.scss`.
- Use standard CSS variables inside component stylesheets:
  ```scss
  .talk-button {
    background-color: var(--color-accent);
    padding: var(--spacing-md);
    border-radius: var(--radius-full);
  }
  ```

---

## 6. Internationalization (i18n) & Constant Management

### 6.1 Zero Hardcoded Strings (i18n)
- All user-facing labels, tooltips, error messages, and button texts must be retrieved from the i18n JSON files via a centralized labels store or translation pipe.
- When creating a new key, add corresponding entries for all supported languages.

### 6.2 Zero Magic Numbers / Magic Strings (Constants)
- All constant values (API endpoints, default timeouts, state keys, language definitions, audio configuration settings) must reside in `src/app/utils/constants.ts`.

### 6.3 Secure Storage Utilities
- Never invoke native `localStorage.setItem` or `sessionStorage.getItem` directly.
- Always use `getLocalStorageItem()` and `setLocalStorageItem()` from `src/app/utils/storage.utils.ts` to guarantee type safety, serialization handling, and SSR/environment safety.

---

## 7. Error Handling & Accessibility (a11y)

### 7.1 Graceful Failure Handling
- Hardware permission denial (e.g., user blocked microphone), network errors, and API timeouts must trigger distinct, user-friendly `ERROR` states with recovery actions (e.g., "Retry permission", "Check connection").

### 7.2 Semantic HTML & Accessibility
- Use semantic HTML tags (`<button>`, `<main>`, `<section>`, `<select>`).
- Add descriptive `aria-label` attributes to icon-only buttons (such as the Push-to-Talk button).
- Ensure focus states are accessible and keyboard navigable.
