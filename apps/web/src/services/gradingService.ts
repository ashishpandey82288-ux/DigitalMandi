// ==============================================================================
// KisanFlow — Frontend Quality Inspection & Grading Service
// ==============================================================================

import { apiClient } from './apiClient.ts';

export interface CreateInspectionPayload {
  bookingId: string;
  moisturePercentage: number;
  foreignMatterPercentage?: number;
  damagedGrainsPercentage?: number;
  brokenGrainsPercentage?: number;
  sampleImageUrl?: string;
  remarks?: string;
  overrideGrade?: string;
}

export interface QualityInspectionDTO {
  id: string;
  bookingId: string;
  inspectorId: string;
  sampleReference: string;
  moisturePercentage: number;
  standardMoistureLimit: number;
  foreignMatterPercentage: number;
  damagedGrainsPercentage: number;
  brokenGrainsPercentage: number;
  aiPredictedGrade: string;
  aiConfidenceScore: number;
  aiModelVersion: string;
  aiInferenceStatus: string;
  finalGrade: string;
  isGradeOverridden: boolean;
  overrideReason?: string;
  totalDeductionPercentage: number;
  deductionAmountPerQuintal: number;
  qualityStatus: string;
  parameterAnalysis?: any;
  inspectorRemarks?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
}

export async function createQualityInspection(payload: CreateInspectionPayload): Promise<QualityInspectionDTO> {
  const res = await apiClient.post('/grading', payload);
  return res.data.data;
}

export async function getQualityInspectionByBooking(bookingId: string): Promise<QualityInspectionDTO | null> {
  try {
    const res = await apiClient.get(`/grading/booking/${bookingId}`);
    return res.data.data;
  } catch {
    return null;
  }
}

export async function verifyQualityInspection(
  inspectionId: string,
  payload: { finalGrade: string; overrideReason?: string; remarks?: string }
): Promise<QualityInspectionDTO> {
  const res = await apiClient.put(`/grading/${inspectionId}/verify`, payload);
  return res.data.data;
}

export async function listQualityInspections(): Promise<QualityInspectionDTO[]> {
  const res = await apiClient.get('/grading');
  return res.data.data || [];
}
