// ==============================================================================
// KisanFlow — Translation Service
// Multilingual orchestration with Gemini AI and offline fallback protection.
// ==============================================================================

import { TranslationResponseDTO, SupportedLanguageDTO, ProviderIntegrationItem } from '@kisanflow/types';
import { ITranslationProvider, defaultTranslationProvider } from '../providers/translationProvider.ts';

export class TranslationService {
  private provider: ITranslationProvider;

  constructor(provider: ITranslationProvider = defaultTranslationProvider) {
    this.provider = provider;
  }

  public async translate(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<TranslationResponseDTO> {
    return this.provider.translate(text, targetLanguage, sourceLanguage);
  }

  public getSupportedLanguages(): SupportedLanguageDTO[] {
    return this.provider.getSupportedLanguages();
  }

  public getProviderStatus(): ProviderIntegrationItem {
    const isKeySet = this.provider.isConfigured();
    return {
      name: 'Multilingual Translation',
      serviceType: 'AI Translation & Regional Localization',
      status: isKeySet ? 'REAL' : 'NOT_CONFIGURED',
      provider: isKeySet ? 'Gemini 3.8 Flash' : 'Offline Agricultural Fallback',
      requiresApiKey: true,
      isConfigured: isKeySet,
      description: isKeySet
        ? 'High-speed neural translation powered by Gemini 3.8 Flash for 12 Indian regional languages.'
        : 'Gemini API key is not configured. Falling back to built-in agricultural dictionary and passthrough.',
    };
  }
}

export const defaultTranslationService = new TranslationService();
