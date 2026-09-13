// ==============================================================================
// DigitalMandi — Frontend Quality Inspection & Grading Service
// Normalizes and validates API responses between Backend / ML Service & UI
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

export interface QualityParameterDetail {
  measured: number;
  standardLimit?: number;
  thresholdA?: number;
  thresholdB?: number;
  excess?: number;
  status: string;
}

export interface QualityParameterAnalysis {
  moisture?: QualityParameterDetail;
  foreignMatter?: QualityParameterDetail;
  damagedGrains?: QualityParameterDetail;
  brokenGrains?: QualityParameterDetail;
  [key: string]: unknown;
}

export interface QualityInspectionDTO {
  id: string;
  bookingId: string;
  bookingNumber?: string;
  farmerProfileId?: string;
  farmerName?: string;
  farmerPhone?: string;
  cropId?: string;
  cropName?: string;
  cropCode?: string;
  procurementCenterId?: string;
  centerName?: string;
  inspectorId?: string | null;
  inspectorName?: string | null;
  sampleReference: string;
  inspectionTimestamp: string;
  moisturePercentage: number;
  standardMoistureLimit: number;
  isMoisturePass: boolean;
  excessMoisturePercentage: number;
  foreignMatterPercentage?: number;
  damagedGrainsPercentage?: number;
  brokenGrainsPercentage?: number;
  aiPredictedGrade?: string;
  aiConfidenceScore?: number;
  aiModelVersion?: string;
  aiInferenceStatus?: string;
  finalGrade: string;
  isHumanVerified: boolean;
  isGradeOverridden: boolean;
  overrideReason?: string;
  deductionType?: string;
  deductionPercentage: number;
  totalDeductionPercentage: number;
  deductionAmountPerQuintal: number;
  effectiveRatePerQuintal?: number;
  lockedMspRate?: number;
  status: string;
  qualityStatus: string;
  recommendation?: string;
  parameterAnalysis?: QualityParameterAnalysis | null;
  inspectorRemarks?: string;
  evidenceImageUrl?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  createdAt: string;
}

/**
 * Robust normalization layer that safely transforms raw backend responses
 * (whether returned directly as DTO or wrapped in { data: ... }) into a
 * strictly typed, resilient QualityInspectionDTO.
 */
export function normalizeQualityInspection(raw: unknown): QualityInspectionDTO {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Quality inspection failed: Empty or invalid response received from server.');
  }

  const record = raw as Record<string, unknown>;

  // Safely unwrap { data: ... } if present, or consume record directly
  const data: Record<string, unknown> =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : record;

  if (!data || typeof data !== 'object') {
    throw new Error('Quality inspection failed: Invalid payload structure.');
  }

  const otherParams = (data.otherQualityParameters as Record<string, unknown>) || {};
  const deductionPct = Number(data.deductionPercentage ?? data.totalDeductionPercentage ?? 0);
  const statusStr = String(data.status ?? data.qualityStatus ?? 'PENDING');
  const isHuman = Boolean(data.isHumanVerified ?? data.isGradeOverridden ?? false);

  // Derive honest confidence score if available
  let confidence: number | undefined;
  if (data.aiConfidenceScore !== undefined && data.aiConfidenceScore !== null) {
    const rawConf = Number(data.aiConfidenceScore);
    if (!isNaN(rawConf) && rawConf >= 0 && rawConf <= 1.0) {
      confidence = rawConf;
    }
  }

  // Derive predicted grade
  const predictedGrade = data.aiPredictedGrade ? String(data.aiPredictedGrade) : undefined;

  return {
    id: String(data.id || ''),
    bookingId: String(data.bookingId || ''),
    bookingNumber: data.bookingNumber ? String(data.bookingNumber) : undefined,
    farmerProfileId: data.farmerProfileId ? String(data.farmerProfileId) : undefined,
    farmerName: data.farmerName ? String(data.farmerName) : undefined,
    farmerPhone: data.farmerPhone ? String(data.farmerPhone) : undefined,
    cropId: data.cropId ? String(data.cropId) : undefined,
    cropName: data.cropName ? String(data.cropName) : undefined,
    cropCode: data.cropCode ? String(data.cropCode) : undefined,
    procurementCenterId: data.procurementCenterId ? String(data.procurementCenterId) : undefined,
    centerName: data.centerName ? String(data.centerName) : undefined,
    inspectorId: data.inspectorId ? String(data.inspectorId) : null,
    inspectorName: data.inspectorName ? String(data.inspectorName) : null,
    sampleReference: String(data.sampleReference || 'SMP-DIGITALMANDI'),
    inspectionTimestamp: String(data.inspectionTimestamp || new Date().toISOString()),
    moisturePercentage: Number(data.moisturePercentage ?? 0),
    standardMoistureLimit: Number(data.standardMoistureLimit ?? 12.0),
    isMoisturePass: Boolean(data.isMoisturePass ?? (Number(data.moisturePercentage ?? 0) <= Number(data.standardMoistureLimit ?? 12.0))),
    excessMoisturePercentage: Number(data.excessMoisturePercentage ?? Math.max(0, Number(data.moisturePercentage ?? 0) - Number(data.standardMoistureLimit ?? 12.0))),
    foreignMatterPercentage: data.foreignMatterPercentage !== undefined ? Number(data.foreignMatterPercentage) : undefined,
    damagedGrainsPercentage: data.damagedGrainsPercentage !== undefined ? Number(data.damagedGrainsPercentage) : undefined,
    brokenGrainsPercentage: data.brokenGrainsPercentage !== undefined ? Number(data.brokenGrainsPercentage) : undefined,
    aiPredictedGrade: predictedGrade,
    aiConfidenceScore: confidence,
    aiModelVersion: data.aiModelVersion ? String(data.aiModelVersion) : undefined,
    aiInferenceStatus: data.aiInferenceStatus ? String(data.aiInferenceStatus) : undefined,
    finalGrade: String(data.finalGrade || predictedGrade || 'FAQ'),
    isHumanVerified: isHuman,
    isGradeOverridden: isHuman,
    overrideReason: data.reviewRemarks ? String(data.reviewRemarks) : (data.overrideReason ? String(data.overrideReason) : undefined),
    deductionType: data.deductionType ? String(data.deductionType) : undefined,
    deductionPercentage: deductionPct,
    totalDeductionPercentage: deductionPct,
    deductionAmountPerQuintal: Number(data.deductionAmountPerQuintal ?? 0),
    effectiveRatePerQuintal: data.effectiveRatePerQuintal !== undefined ? Number(data.effectiveRatePerQuintal) : undefined,
    lockedMspRate: data.lockedMspRate !== undefined ? Number(data.lockedMspRate) : undefined,
    status: statusStr,
    qualityStatus: statusStr,
    recommendation: otherParams.recommendation ? String(otherParams.recommendation) : (data.remarks ? String(data.remarks) : undefined),
    parameterAnalysis: (otherParams.analysis as QualityParameterAnalysis) || (data.parameterAnalysis as QualityParameterAnalysis) || null,
    inspectorRemarks: data.reviewRemarks ? String(data.reviewRemarks) : (data.remarks ? String(data.remarks) : undefined),
    evidenceImageUrl: data.evidenceImageUrl ? String(data.evidenceImageUrl) : null,
    verifiedAt: data.verifiedAt ? String(data.verifiedAt) : null,
    verifiedBy: data.verifiedByUserId ? String(data.verifiedByUserId) : (data.verifiedBy ? String(data.verifiedBy) : null),
    createdAt: String(data.createdAt || new Date().toISOString()),
  };
}

export async function createQualityInspection(payload: CreateInspectionPayload): Promise<QualityInspectionDTO> {
  const res = await apiClient.post('/grading', payload);
  return normalizeQualityInspection(res.data);
}

export async function getQualityInspectionByBooking(bookingId: string): Promise<QualityInspectionDTO | null> {
  try {
    const res = await apiClient.get(`/grading/booking/${bookingId}`);
    if (!res.data) return null;
    return normalizeQualityInspection(res.data);
  } catch {
    return null;
  }
}

export async function verifyQualityInspection(
  inspectionId: string,
  payload: { finalGrade: string; overrideReason?: string; remarks?: string }
): Promise<QualityInspectionDTO> {
  const res = await apiClient.put(`/grading/${inspectionId}/verify`, payload);
  return normalizeQualityInspection(res.data);
}

export async function listQualityInspections(): Promise<QualityInspectionDTO[]> {
  const res = await apiClient.get('/grading');
  const rawList = Array.isArray(res.data)
    ? res.data
    : Array.isArray((res.data as Record<string, unknown>)?.data)
    ? ((res.data as Record<string, unknown>).data as unknown[])
    : [];
  return rawList.map(normalizeQualityInspection);
}
