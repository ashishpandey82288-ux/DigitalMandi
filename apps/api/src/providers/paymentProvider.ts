// ==============================================================================
// KisanFlow — Payment Provider Interface & Deterministic Mock Provider
// Supports Direct Benefit Transfer (DBT) via PFMS, UPI, and Simulated Payment Gateways
// Strictly differentiates between SIMULATED test executions and REAL bank transfers
// ==============================================================================

import crypto from 'crypto';

export interface PaymentInitiationRequest {
  settlementId: string;
  settlementReference: string;
  bookingId?: string;
  farmerProfileId: string;
  farmerName: string;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  amount: number;
  currency: string;
  paymentMethod: string;
  idempotencyKey?: string | null;
  simulateFailure?: boolean;
  simulateFailureReason?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PaymentExecutionResult {
  success: boolean;
  status: 'SUCCESS' | 'FAILED';
  providerTransactionId: string;
  isSimulated: boolean;
  providerName: string;
  failureReason?: string | null;
  processedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface IPaymentProvider {
  name: string;
  isSimulated: boolean;
  processPayment(request: PaymentInitiationRequest): Promise<PaymentExecutionResult>;
}

/**
 * Mock DBT / PFMS Payment Provider
 * Deterministic test mock for automated verification of payment lifecycle and edge cases.
 */
export class MockPaymentProvider implements IPaymentProvider {
  public name = 'MOCK_PFMS_DBT_PROVIDER';
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
        providerTransactionId: `UTR-MOCK-FAIL-${timestamp}-${entropy}`,
        isSimulated: true,
        providerName: this.name,
        failureReason,
        processedAt,
        metadata: {
          simulated: true,
          providerMode: 'TEST_SANDBOX',
          settlementReference: request.settlementReference,
          farmerProfileId: request.farmerProfileId,
          amount: request.amount,
          currency: request.currency,
          channel: 'PFMS_DIRECT_BENEFIT_TRANSFER',
          gatewayErrorCode: 'PFMS_ERR_602',
          gatewayErrorMessage: failureReason,
        },
      };
    }

    return {
      success: true,
      status: 'SUCCESS',
      providerTransactionId: `UTR-MOCK-DBT-${timestamp}-${entropy}`,
      isSimulated: true,
      providerName: this.name,
      failureReason: null,
      processedAt,
      metadata: {
        simulated: true,
        providerMode: 'TEST_SANDBOX',
        settlementReference: request.settlementReference,
        farmerProfileId: request.farmerProfileId,
        amount: request.amount,
        currency: request.currency,
        channel: 'PFMS_DIRECT_BENEFIT_TRANSFER',
        bankReferenceNumber: `PFMS-REF-${timestamp}-${entropy}`,
        clearingTimestamp: processedAt.toISOString(),
      },
    };
  }
}

// Default singleton provider instance for Phase 4A
export const defaultPaymentProvider = new MockPaymentProvider();
