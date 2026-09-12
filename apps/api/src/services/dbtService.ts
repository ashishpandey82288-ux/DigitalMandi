// ==============================================================================
// KisanFlow — DBT Service (Simulation Adapter Orchestrator)
// ==============================================================================

import { PaymentDTO, ProviderIntegrationItem } from '@kisanflow/types';
import { IDBTProvider, defaultDBTProvider } from '../providers/dbtProvider.ts';
import { PaymentService, InitiatePaymentParams } from './paymentService.ts';

export class DBTService {
  private dbtProvider: IDBTProvider;
  private paymentService: PaymentService;

  constructor(provider: IDBTProvider = defaultDBTProvider) {
    this.dbtProvider = provider;
    this.paymentService = new PaymentService(provider);
  }

  /**
   * Authoritative DBT disbursement initiation
   */
  public async initiateDisbursement(params: InitiatePaymentParams): Promise<PaymentDTO> {
    return this.paymentService.initiatePayment({
      ...params,
      paymentMethod: 'DBT_PFMS',
      metadata: {
        ...params.metadata,
        dbtMode: 'SIMULATION',
        dbtProvider: 'INTERNAL_DBT_SIMULATOR',
      },
    });
  }

  /**
   * Retry failed disbursement
   */
  public async retryDisbursement(paymentId: string, actorId?: string, actorRole?: string): Promise<PaymentDTO> {
    return this.paymentService.retryPayment(paymentId, { actorId, actorRole });
  }

  /**
   * Get provider status
   */
  public getProviderStatus(): ProviderIntegrationItem {
    return this.dbtProvider.getProviderStatus();
  }
}

export const defaultDBTService = new DBTService();
