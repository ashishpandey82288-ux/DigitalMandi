// ==============================================================================
// KisanFlow — Frontend Settlement Service
// ==============================================================================

import { apiClient } from './apiClient.ts';

export interface SettlementDTO {
  id: string;
  bookingId: string;
  farmerProfileId: string;
  procurementCenterId: string;
  settlementReference: string;
  procuredQuantityQuintals: number;
  baseRatePerQuintal: number;
  effectiveRatePerQuintal: number;
  grossAmount: number;
  totalDeductions: number;
  netPayableAmount: number;
  status: string;
  settledAt?: string;
  createdAt: string;
  booking?: any;
  payments?: any[];
}

export async function createSettlement(bookingId: string): Promise<SettlementDTO> {
  const res = await apiClient.post('/settlements', { bookingId });
  return res.data.data;
}

export async function getSettlementByBooking(bookingId: string): Promise<SettlementDTO | null> {
  try {
    const res = await apiClient.get(`/settlements/booking/${bookingId}`);
    return res.data.data;
  } catch {
    return null;
  }
}

export async function listSettlements(): Promise<SettlementDTO[]> {
  const res = await apiClient.get('/settlements');
  return res.data.data?.settlements || res.data.data || [];
}
