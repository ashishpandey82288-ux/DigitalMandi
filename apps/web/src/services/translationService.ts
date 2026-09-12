// ==============================================================================
// KisanFlow Web — Translation Service Client (Gemini Multilingual via Backend)
// ==============================================================================

import { apiClient } from './apiClient.ts';
import { ApiResponse, TranslationResponseDTO, SupportedLanguageDTO } from '@kisanflow/types';

export const translationService = {
  async translate(text: string, targetLanguage: string, sourceLanguage: string = 'en'): Promise<TranslationResponseDTO> {
    const res = await apiClient.post<ApiResponse<TranslationResponseDTO>>('/translation/translate', {
      text,
      targetLanguage,
      sourceLanguage,
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Translation failed');
    }
    return res.data.data;
  },

  async getLanguages(): Promise<SupportedLanguageDTO[]> {
    const res = await apiClient.get<ApiResponse<SupportedLanguageDTO[]>>('/translation/languages');
    if (!res.data.success || !res.data.data) {
      return [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
        { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
        { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
      ];
    }
    return res.data.data;
  },
};
