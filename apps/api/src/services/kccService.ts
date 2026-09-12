// ==============================================================================
// KisanFlow — Kisan Credit Card (KCC) Service
// Advisory lookup and farmer credit verification orchestrator.
// ==============================================================================

import { KCCAdvisoryDTO, KCCVerificationResultDTO, ProviderIntegrationItem } from '@kisanflow/types';
import { IKCCProvider, defaultKCCProvider } from '../providers/kccProvider.ts';

export class KCCService {
  private provider: IKCCProvider;

  constructor(provider: IKCCProvider = defaultKCCProvider) {
    this.provider = provider;
  }

  public async getAdvisories(filters?: {
    state?: string;
    district?: string;
    crop?: string;
    category?: string;
    search?: string;
    limit?: number;
  }): Promise<KCCAdvisoryDTO[]> {
    return this.provider.getAdvisories(filters);
  }

  public async verifyKCC(kccNumber: string): Promise<KCCVerificationResultDTO> {
    return this.provider.verifyKCC(kccNumber);
  }

  public getProviderStatus(): ProviderIntegrationItem {
    return this.provider.getProviderStatus();
  }
}

export const defaultKCCService = new KCCService();
