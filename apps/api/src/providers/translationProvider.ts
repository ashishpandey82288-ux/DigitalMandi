// ==============================================================================
// KisanFlow — Multilingual Translation Provider (Gemini AI Implementation)
// Replaces external Bhashini integration with Gemini-based translation service.
// Strict server-side security: GEMINI_API_KEY is never leaked to browser client.
// ==============================================================================

import { GoogleGenAI } from '@google/genai';
import { TranslationResponseDTO, SupportedLanguageDTO } from '@kisanflow/types';
import { env } from '../config/env.ts';

export const SUPPORTED_LANGUAGES: SupportedLanguageDTO[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
];

export interface ITranslationProvider {
  name: string;
  translate(text: string, targetLanguage: string, sourceLanguage?: string): Promise<TranslationResponseDTO>;
  isConfigured(): boolean;
  getSupportedLanguages(): SupportedLanguageDTO[];
}

/**
 * Common agricultural glossary dictionary for rapid deterministic offline fallback
 */
const COMMON_AGRI_TERMS: Record<string, Record<string, string>> = {
  hi: {
    'Procurement Center': 'खरीद केंद्र',
    'Farmer': 'किसान',
    'Minimum Support Price': 'न्यूनतम समर्थन मूल्य (MSP)',
    'Moisture Content': 'नमी की मात्रा',
    'Booking Confirmed': 'बुकिंग की पुष्टि हुई',
    'Wheat': 'गेहूं',
    'Paddy': 'धान',
    'Mustard': 'सरसों',
    'Payment Disbursed': 'भुगतान वितरित किया गया',
    'Direct Benefit Transfer': 'प्रत्यक्ष लाभ अंतरण (DBT)',
    'Quality Inspection': 'गुणवत्ता निरीक्षण',
    'Weighment': 'तौल',
    'Gate Token': 'गेट टोकन',
  },
  pa: {
    'Procurement Center': 'ਖਰੀਦ ਕੇਂਦਰ',
    'Farmer': 'ਕਿਸਾਨ',
    'Minimum Support Price': 'ਘੱਟੋ-ਘੱਟ ਸਮਰਥਨ ਮੁੱਲ (MSP)',
    'Moisture Content': 'ਨਮੀ ਦੀ ਮਾਤਰਾ',
    'Booking Confirmed': 'ਬੁਕਿੰਗ ਦੀ ਪੁਸ਼ਟੀ ਹੋਈ',
    'Wheat': 'ਕਣਕ',
    'Paddy': 'ਝੋਨਾ',
    'Mustard': 'ਸਰ੍ਹੋਂ',
    'Payment Disbursed': 'ਭੁਗਤਾਨ ਜਾਰੀ ਕੀਤਾ ਗਿਆ',
    'Direct Benefit Transfer': 'ਸਿੱਧਾ ਲਾਭ ਤਬਾਦਲਾ (DBT)',
  },
  mr: {
    'Procurement Center': 'खरेदी केंद्र',
    'Farmer': 'शेतकरी',
    'Minimum Support Price': 'किमान आधारभूत किंमत (MSP)',
    'Moisture Content': 'ओलाव्याचे प्रमाण',
    'Booking Confirmed': 'नोंदणी निश्चित झाली',
    'Wheat': 'गहू',
    'Paddy': 'धान/भात',
    'Mustard': 'मोहरी',
  },
};

export class GeminiTranslationProvider implements ITranslationProvider {
  public name = 'gemini';
  private aiClient: GoogleGenAI | null = null;
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (this.apiKey) {
      try {
        this.aiClient = new GoogleGenAI({
          apiKey: this.apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
      } catch (err) {
        console.warn('⚠️ Could not initialize Gemini client:', err);
        this.aiClient = null;
      }
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public getSupportedLanguages(): SupportedLanguageDTO[] {
    return SUPPORTED_LANGUAGES;
  }

  public async translate(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'en'
  ): Promise<TranslationResponseDTO> {
    // 1. Validation: text presence
    if (!text || typeof text !== 'string' || !text.trim()) {
      const err: any = new Error('Input text is required for translation');
      err.statusCode = 400;
      err.code = 'INVALID_INPUT_TEXT';
      throw err;
    }

    const trimmed = text.trim();

    // 2. Validation: length ceiling
    if (trimmed.length > 5000) {
      const err: any = new Error('Input text exceeds maximum allowable limit of 5,000 characters');
      err.statusCode = 400;
      err.code = 'INPUT_TEXT_TOO_LONG';
      throw err;
    }

    // 3. Validation: target language
    const targetLangObj = SUPPORTED_LANGUAGES.find(
      (l) => l.code.toLowerCase() === targetLanguage.toLowerCase()
    );
    if (!targetLangObj) {
      const err: any = new Error(
        `Unsupported target language code "${targetLanguage}". Supported languages: ${SUPPORTED_LANGUAGES.map((l) => l.code).join(', ')}`
      );
      err.statusCode = 400;
      err.code = 'UNSUPPORTED_LANGUAGE';
      throw err;
    }

    // If source and target are identical, return as is
    if (sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()) {
      return {
        translatedText: trimmed,
        sourceLanguage,
        targetLanguage,
        provider: 'fallback',
        characterCount: trimmed.length,
        translatedAt: new Date().toISOString(),
      };
    }

    // 4. If Gemini is not configured, fall back to offline agricultural dictionary or passthrough
    if (!this.aiClient || !this.apiKey) {
      return this.fallbackTranslate(trimmed, targetLanguage, sourceLanguage, 'Gemini API key is not configured');
    }

    // 5. Invoke Gemini with strict system instruction
    try {
      const prompt = `You are a professional agricultural domain translation system for the Indian procurement platform KisanFlow.
Translate the following text accurately into ${targetLangObj.name} (${targetLangObj.nativeName}).
Maintain all technical terms, MSP figures, crop varieties, weights in quintals, UTR codes, and tokens intact.
Only return the translated text without extra explanation or formatting quotation marks.

Original text:
${trimmed}`;

      const response = await this.aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      const translatedText = response.text?.trim() || trimmed;

      return {
        translatedText,
        sourceLanguage,
        targetLanguage,
        provider: 'gemini',
        characterCount: trimmed.length,
        translatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      console.warn('⚠️ Gemini translation error, applying fallback:', err?.message);
      return this.fallbackTranslate(trimmed, targetLanguage, sourceLanguage, err?.message);
    }
  }

  private fallbackTranslate(
    text: string,
    targetLanguage: string,
    sourceLanguage: string,
    _reason: string
  ): TranslationResponseDTO {
    // Check known agricultural terms
    const dict = COMMON_AGRI_TERMS[targetLanguage];
    let translated = text;

    if (dict) {
      for (const [english, local] of Object.entries(dict)) {
        if (text.toLowerCase() === english.toLowerCase()) {
          translated = local;
          break;
        }
      }
    }

    return {
      translatedText: translated,
      sourceLanguage,
      targetLanguage,
      provider: 'fallback',
      characterCount: text.length,
      translatedAt: new Date().toISOString(),
    };
  }
}

export const defaultTranslationProvider = new GeminiTranslationProvider();
