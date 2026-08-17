import { Injectable, signal, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { AppTheme, DEFAULT_THEME, STORAGE_KEYS, LOG_PREFIXES } from '../../utils/constants';
import { getLocalStorageItem, setLocalStorageItem } from '../../utils/storage.utils';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  // Stored preference
  private readonly themeSignal = signal<AppTheme>(
    getLocalStorageItem<AppTheme>(STORAGE_KEYS.THEME, DEFAULT_THEME)
  );

  readonly currentTheme = this.themeSignal.asReadonly();

  constructor() {
    // Apply theme whenever signal changes
    effect(() => {
      const theme = this.themeSignal();
      this.applyThemeToDOM(theme);
    });

    // Listen for OS system theme changes if set to system
    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (this.themeSignal() === AppTheme.SYSTEM) {
          const resolved = e.matches ? AppTheme.DARK : AppTheme.LIGHT;
          this.document.documentElement.setAttribute('data-theme', resolved);
          console.log(`${LOG_PREFIXES.THEME} System theme changed. Resolved to: ${resolved}`);
        }
      });
    }
  }

  /**
   * Toggles between Light and Dark themes directly
   */
  toggleTheme(): void {
    const nextTheme = this.themeSignal() === AppTheme.DARK ? AppTheme.LIGHT : AppTheme.DARK;
    this.setTheme(nextTheme);
  }

  /**
   * Explicitly sets the theme and persists to storage
   */
  setTheme(theme: AppTheme): void {
    if (this.themeSignal() === theme) return;
    
    console.log(`${LOG_PREFIXES.THEME} Theme changed to: ${theme}`);
    this.themeSignal.set(theme);
    setLocalStorageItem(STORAGE_KEYS.THEME, theme);
  }

  private applyThemeToDOM(theme: AppTheme): void {
    let resolvedTheme: 'light' | 'dark' = 'dark';

    if (theme === AppTheme.SYSTEM) {
      const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolvedTheme = prefersDark ? 'dark' : 'light';
    } else {
      resolvedTheme = theme === AppTheme.LIGHT ? 'light' : 'dark';
    }

    this.document.documentElement.setAttribute('data-theme', resolvedTheme);
    console.log(`${LOG_PREFIXES.THEME} DOM data-theme updated to: ${resolvedTheme}`);
  }
}
