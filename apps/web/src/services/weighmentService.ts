// ==============================================================================
// KisanFlow — Frontend Weighment Service
// ==============================================================================

import { apiClient } from './apiClient.ts';

export interface WeighmentDTO {
  id: string;
  bookingId: string;
  weighbridgeOperatorId: string;
  ticketNumber: string;
  grossWeightKg: number;
  tareWeightKg: number;
  netWeightKg: number;
  netWeightQuintals: number;
  baseMspRate: number;
  effectiveRatePerQuintal: number;
  moistureDeductionAmount: number;
  qualityDeductionAmount: number;
  netPayableAmount: number;
  calibrationCertificate?: string;
  createdAt: string;
}

export interface WeighmentPreviewResult {
  netWeightKg: number;
  netWeightQuintals: number;
  baseMspRate: number;
  effectiveRatePerQuintal: number;
  deductionPercentage: number;
  grossPayableAmount: number;
  qualityDeductionTotal: number;
  netPayableAmount: number;
}

export async function previewWeighment(payload: {
  bookingId: string;
  grossWeightKg: number;
  tareWeightKg: number;
}): Promise<WeighmentPreviewResult> {
  const res = await apiClient.post('/weighments/preview', payload);
  return res.data.data;
}

export async function recordWeighment(payload: {
  bookingId: string;
  grossWeightKg: number;
  tareWeightKg: number;
  weighbridgeId?: string;
  notes?: string;
}): Promise<WeighmentDTO> {
  const res = await apiClient.post('/weighments', payload);
  return res.data.data;
}

export async function getWeighmentByBooking(bookingId: string): Promise<WeighmentDTO | null> {
  try {
    const res = await apiClient.get(`/weighments/booking/${bookingId}`);
    return res.data.data;
  } catch {
    return null;
  }
}
