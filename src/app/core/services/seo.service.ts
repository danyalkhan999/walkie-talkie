import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { SEO_DEFAULTS, LOG_PREFIXES } from '../../utils/constants';

export interface SeoConfig {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  /**
   * Updates page title, meta description, and OpenGraph/Twitter social cards
   */
  updateSeo(config: SeoConfig = {}): void {
    const title = config.title || SEO_DEFAULTS.TITLE_WALKIE_TALKIE;
    const description = config.description || SEO_DEFAULTS.DESCRIPTION_WALKIE_TALKIE;
    const url = config.url || (typeof window !== 'undefined' ? window.location.href : '');

    this.titleService.setTitle(title);

    // Update standard description
    this.metaService.updateTag({ name: 'description', content: description });

    // OpenGraph Meta Tags
    this.metaService.updateTag({ property: 'og:title', content: title });
    this.metaService.updateTag({ property: 'og:description', content: description });
    this.metaService.updateTag({ property: 'og:type', content: 'website' });
    this.metaService.updateTag({ property: 'og:site_name', content: SEO_DEFAULTS.SITE_NAME });
    if (url) {
      this.metaService.updateTag({ property: 'og:url', content: url });
    }

    // Twitter Card Meta Tags
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: title });
    this.metaService.updateTag({ name: 'twitter:description', content: description });

    console.log(`${LOG_PREFIXES.SEO} Updated page meta: [Title: "${title}"]`);
  }
}
