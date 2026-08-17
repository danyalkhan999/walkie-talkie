import { Component, ChangeDetectionStrategy, Input, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { StateService } from '../../../../core/services/state.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { SUPPORTED_LANGUAGES, LanguageOption, LOG_PREFIXES } from '../../../../utils/constants';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './language-selector.component.html',
  styleUrls: ['./language-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LanguageSelectorComponent {
  @Input({ required: true }) type!: 'source' | 'target';

  readonly stateService = inject(StateService);
  readonly i18nService = inject(I18nService);

  readonly languages = SUPPORTED_LANGUAGES;
  readonly isOpen = signal<boolean>(false);
  readonly searchQuery = signal<string>('');

  // Reactive signals connected to the StateService observables
  private readonly sourceLangSignal = toSignal(this.stateService.sourceLanguage$, {
    initialValue: this.stateService.currentSourceLanguage
  });

  private readonly targetLangSignal = toSignal(this.stateService.targetLanguage$, {
    initialValue: this.stateService.currentTargetLanguage
  });

  // Dynamically computes current selected code based on 'source' or 'target' type
  readonly currentSelectedCode = computed<string>(() => {
    return this.type === 'source' ? this.sourceLangSignal() : this.targetLangSignal();
  });

  // Dynamically computes the selected language object
  readonly selectedLanguage = computed<LanguageOption>(() => {
    const code = this.currentSelectedCode();
    return this.languages.find(l => l.code === code) || this.languages[0];
  });

  readonly filteredLanguages = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.languages;
    return this.languages.filter(lang => 
      lang.name.toLowerCase().includes(query) ||
      lang.nativeName.toLowerCase().includes(query) ||
      lang.code.toLowerCase().includes(query)
    );
  });

  toggleDropdown(): void {
    this.isOpen.update(open => !open);
    if (this.isOpen()) {
      this.searchQuery.set('');
    }
  }

  closeDropdown(): void {
    this.isOpen.set(false);
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
  }

  selectLanguage(lang: LanguageOption): void {
    if (this.type === 'source') {
      this.stateService.setSourceLanguage(lang.code);
    } else {
      this.stateService.setTargetLanguage(lang.code);
    }

    console.log(`${LOG_PREFIXES.ACTION} [${this.type.toUpperCase()}] Language selected: ${lang.name} (${lang.code})`);
    this.isOpen.set(false);
  }
}
