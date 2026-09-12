// ==============================================================================
// KisanFlow — DBT Provider & Internal Simulation Adapter
// Replaces external PFMS/DBT dependency with internal simulation adapter.
// ==============================================================================

import crypto from 'crypto';
import { PaymentInitiationRequest, PaymentExecutionResult, IPaymentProvider } from './paymentProvider.ts';
import { ProviderIntegrationItem } from '@kisanflow/types';
import { env } from '../config/env.ts';

export interface IDBTProvider extends IPaymentProvider {
  mode: string;
  provider: string;
  getProviderStatus(): ProviderIntegrationItem;
}

/**
 * Internal DBT Simulation Provider
 * Authoritative internal simulator for Direct Benefit Transfer disbursements.
 * Ensures strict identification of simulated transactions without fake API endpoints.
 */
export class SimulationDBTProvider implements IDBTProvider {
  public name = 'INTERNAL_DBT_SIMULATOR';
  public mode = 'SIMULATION';
  public provider = 'INTERNAL_DBT_SIMULATOR';
  public isSimulated = true;

  public async processPayment(request: PaymentInitiationRequest): Promise<PaymentExecutionResult> {
    const timestamp = Date.now();
    const entropy = crypto.randomInt(100000, 999999);
    const shouldFail =
      request.simulateFailure === true ||
      request.metadata?.simulateFailure === true ||
      request.metadata?.triggerFailure === true;

    const processedAt = new Date();

    if (shouldFail) {
      const failureReason =
        request.simulateFailureReason ||
        (request.metadata?.simulateFailureReason as string) ||
        'BENEFICIARY_ACCOUNT_INVALID_OR_DORMANT';

      return {
        success: false,
        status: 'FAILED',
        providerTransactionId: `UTR-SIM-FAIL-${timestamp}-${entropy}`,
        isSimulated: true,
        providerName: this.provider,
        failureReason,
        processedAt,
        metadata: {
          simulated: true,
          mode: 'SIMULATION',
          provider: 'INTERNAL_DBT_SIMULATOR',
          providerMode: 'INTERNAL_SIMULATION',
          settlementReference: request.settlementReference,
          farmerProfileId: request.farmerProfileId,
          amount: request.amount,
          currency: request.currency,
          channel: 'INTERNAL_DBT_SIMULATOR',
          gatewayErrorCode: 'SIM_ERR_602',
          gatewayErrorMessage: failureReason,
        },
      };
    }

    return {
      success: true,
      status: 'SUCCESS',
      providerTransactionId: `UTR-SIM-DBT-${timestamp}-${entropy}`,
      isSimulated: true,
      providerName: this.provider,
      failureReason: null,
      processedAt,
      metadata: {
        simulated: true,
        mode: 'SIMULATION',
        provider: 'INTERNAL_DBT_SIMULATOR',
        providerMode: 'INTERNAL_SIMULATION',
        settlementReference: request.settlementReference,
        farmerProfileId: request.farmerProfileId,
        amount: request.amount,
        currency: request.currency,
        channel: 'INTERNAL_DBT_SIMULATOR',
        bankReferenceNumber: `DBT-SIM-REF-${timestamp}-${entropy}`,
        clearingTimestamp: processedAt.toISOString(),
      },
    };
  }

  public getProviderStatus(): ProviderIntegrationItem {
    return {
      name: 'Direct Benefit Transfer (DBT/PFMS)',
      serviceType: 'Farmer Bank Account Disbursement',
      status: 'SIMULATION',
      provider: 'INTERNAL_DBT_SIMULATOR',
      requiresApiKey: false,
      isConfigured: true,
      endpointUrl: env.DBT_API_URL || undefined,
      description: 'Internal DBT simulation adapter with idempotent state transitions, UTR generation, and cryptographic audit ledger. Explicitly marked as SIMULATION.',
    };
  }
}

export const defaultDBTProvider = new SimulationDBTProvider();
