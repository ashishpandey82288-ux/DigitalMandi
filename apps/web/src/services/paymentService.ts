// ==============================================================================
// KisanFlow — Frontend Payment & DBT Service
// ==============================================================================

import { apiClient } from './apiClient.ts';

export interface PaymentDTO {
  id: string;
  settlementId: string;
  farmerProfileId: string;
  paymentReference: string;
  amount: number;
  paymentMethod: string;
  status: string;
  dbtBatchId?: string;
  pfmsTransactionId?: string;
  utrNumber?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  idempotencyKey: string;
  failureReason?: string;
  retryCount: number;
  paidAt?: string;
  createdAt: string;
  settlement?: any;
}

export async function initiatePayment(settlementId: string): Promise<PaymentDTO> {
  const res = await apiClient.post('/payments', { settlementId });
  return res.data.data;
}

export async function retryPayment(paymentId: string): Promise<PaymentDTO> {
  const res = await apiClient.post(`/payments/${paymentId}/retry`);
  return res.data.data;
}

export async function getPaymentsByFarmer(farmerId: string): Promise<PaymentDTO[]> {
  const res = await apiClient.get(`/payments/farmer/${farmerId}`);
  return res.data.data || [];
}

export async function listPayments(): Promise<PaymentDTO[]> {
  const res = await apiClient.get('/payments');
  return res.data.data?.payments || res.data.data || [];
}
