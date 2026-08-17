import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';
import { SeoService } from '../../core/services/seo.service';
import { ApiConfigService } from '../../core/services/api-config.service';
import { SEO_DEFAULTS } from '../../utils/constants';

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './guide.component.html',
  styleUrls: ['./guide.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GuideComponent implements OnInit {
  readonly i18nService = inject(I18nService);
  readonly seoService = inject(SeoService);
  readonly apiConfigService = inject(ApiConfigService);

  readonly sections = [
    { id: 'about', labelKey: 'guide.aboutTitle', icon: 'bi-info-circle-fill' },
    { id: 'quickstart', labelKey: 'guide.quickstartTitle', icon: 'bi-lightning-charge-fill' },
    { id: 'api-setup', labelKey: 'guide.apiSetupTitle', icon: 'bi-key-fill' },
    { id: 'controls', labelKey: 'guide.controlsTitle', icon: 'bi-mic-fill' },
    { id: 'security', labelKey: 'guide.securityTitle', icon: 'bi-shield-lock-fill' }
  ];

  ngOnInit(): void {
    this.seoService.updateSeo({
      title: SEO_DEFAULTS.TITLE_GUIDE,
      description: SEO_DEFAULTS.DESCRIPTION_GUIDE
    });
  }

  scrollToSection(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  openSettings(): void {
    this.apiConfigService.openDrawer();
  }
}
