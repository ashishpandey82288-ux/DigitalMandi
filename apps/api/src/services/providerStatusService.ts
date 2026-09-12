// ==============================================================================
// KisanFlow — Centralized Provider Status Service
// Tracks health and connectivity mode across all external integrations:
// REAL, SIMULATION, MOCK, NOT_CONFIGURED, UNAVAILABLE, EXISTING_CONFIGURATION
// Strictly avoids misrepresenting simulation as live government infrastructure.
// ==============================================================================

import { ProviderStatusResponseDTO } from '@kisanflow/types';
import { defaultWeatherService } from './weatherService.ts';
import { defaultTranslationService } from './translationService.ts';
import { defaultMandiDataService } from './mandiDataService.ts';
import { defaultDBTService } from './dbtService.ts';
import { defaultKCCService } from './kccService.ts';
import { env } from '../config/env.ts';

export class ProviderStatusService {
  public getStatus(): ProviderStatusResponseDTO {
    const isRazorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_ID.trim().length > 0);

    return {
      timestamp: new Date().toISOString(),
      providers: {
        weather: defaultWeatherService.getProviderStatus(),
        translation: defaultTranslationService.getProviderStatus(),
        mandi: defaultMandiDataService.getProviderStatus(),
        dbt: defaultDBTService.getProviderStatus(),
        kcc: defaultKCCService.getProviderStatus(),
        dilrmp: {
          name: 'Land Cadastral Verification (DILRMP)',
          serviceType: 'RoR & Ownership Validation',
          status: 'EXISTING_CONFIGURATION',
          provider: 'DILRMP Official Cadastral API (NIC)',
          requiresApiKey: false,
          isConfigured: true,
          endpointUrl: env.DILRMP_API_URL,
          description: 'Official Digital India Land Records Modernization Programme integration for parcel yield verification. Configuration preserved untouched.',
        },
        razorpay: {
          name: 'Commercial Payment Gateway (UPI/Cards)',
          serviceType: 'Farmer Commercial Collections & Fees',
          status: isRazorpayConfigured ? 'REAL' : 'NOT_CONFIGURED',
          provider: 'Razorpay PG',
          requiresApiKey: true,
          isConfigured: isRazorpayConfigured,
          description: isRazorpayConfigured
            ? 'Live commercial payment gateway configured with merchant API keys.'
            : 'Merchant keys unconfigured; payments route through DBT simulation.',
        },
      },
    };
  }
}

export const defaultProviderStatusService = new ProviderStatusService();
