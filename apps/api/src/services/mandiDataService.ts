// ==============================================================================
// KisanFlow — Mandi Data Service
// Commodity APMC market price discovery service using Open Data (data.gov.in)
// ==============================================================================

import { MandiPriceResponseDTO, ProviderIntegrationItem } from '@kisanflow/types';
import { IMandiDataProvider, defaultMandiDataProvider } from '../providers/mandiDataProvider.ts';

export class MandiDataService {
  private provider: IMandiDataProvider;

  constructor(provider: IMandiDataProvider = defaultMandiDataProvider) {
    this.provider = provider;
  }

  public async getMandiPrices(filters?: {
    commodity?: string;
    state?: string;
    district?: string;
    market?: string;
    limit?: number;
  }): Promise<MandiPriceResponseDTO> {
    return this.provider.getMandiPrices(filters);
  }

  public async getMandiPriceByCommodity(commodity: string): Promise<MandiPriceResponseDTO> {
    return this.provider.getMandiPrices({ commodity });
  }

  public getProviderStatus(): ProviderIntegrationItem {
    const isConfigured = this.provider.isConfigured();
    return {
      name: 'Mandi Price Discovery (eNAM alternative)',
      serviceType: 'Agricultural Commodity Market Pricing',
      status: isConfigured ? 'REAL' : 'NOT_CONFIGURED',
      provider: isConfigured ? 'data.gov.in (Government Open Data)' : 'Authentic Mandi Benchmark Fallback',
      requiresApiKey: true,
      isConfigured,
      endpointUrl: 'https://api.data.gov.in',
      description: isConfigured
        ? 'Live wholesale APMC mandi price telemetry queried from official data.gov.in datasets.'
        : 'Open Data API key or Mandi resource ID is unconfigured. Serving verified APMC benchmark prices with explicit simulation flags.',
    };
  }
}

export const defaultMandiDataService = new MandiDataService();
