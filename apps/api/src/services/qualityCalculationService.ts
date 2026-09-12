// ==============================================================================
// KisanFlow — Quality Deduction Engine & Procurement Calculation Service
// Implements statutory MSP protection, moisture tolerance & grade calculations
// ==============================================================================

import { CropQualityGrade } from '@prisma/client';
import { DeductionType, ProcurementCalculationSnapshotDTO } from '@kisanflow/types';

export interface QualityCalculationInput {
  lockedMspRate: number;
  standardMoistureLimit: number;
  measuredMoisturePercentage: number;
  grade: CropQualityGrade;
  isHumanOverride?: boolean;
  customDeductionPercentage?: number;
}

export interface QualityCalculationResult {
  lockedMspRate: number;
  standardMoistureLimit: number;
  measuredMoisturePercentage: number;
  isMoisturePass: boolean;
  excessMoisturePercentage: number;
  grade: CropQualityGrade;
  deductionType: DeductionType;
  moistureDeductionPercentage: number;
  gradeDeductionPercentage: number;
  totalDeductionPercentage: number;
  deductionAmountPerQuintal: number;
  effectiveRatePerQuintal: number;
  isEligibleForProcurement: boolean;
  ineligibilityReason?: string;
  statutoryRuleApplied: string;
}

export interface WeighmentCalculationInput {
  grossWeightQuintals: number;
  tareWeightQuintals: number;
  effectiveRatePerQuintal: number;
  lockedMspRate: number;
  qualityGrade: CropQualityGrade;
  deductionType: DeductionType;
  deductionValue: number;
}

export interface WeighmentCalculationResult {
  grossWeightQuintals: number;
  tareWeightQuintals: number;
  netWeightQuintals: number;
  lockedMspRate: number;
  effectiveRatePerQuintal: number;
  deductionAmountTotal: number;
  finalPayableAmount: number;
  snapshot: ProcurementCalculationSnapshotDTO;
}

/**
 * Calculates quality deductions while strictly preserving the immutable locked MSP rate
 */
export function calculateQualityDeduction(input: QualityCalculationInput): QualityCalculationResult {
  const lockedMsp = Number(Number(input.lockedMspRate).toFixed(2));
  const standardLimit = Number(Number(input.standardMoistureLimit).toFixed(2));
  const measuredMoisture = Number(Number(input.measuredMoisturePercentage).toFixed(2));

  const isMoisturePass = measuredMoisture <= standardLimit;
  const excessMoisture = isMoisturePass ? 0 : Number((measuredMoisture - standardLimit).toFixed(2));

  // 1. Calculate statutory moisture deduction (1% deduction per 1% excess moisture)
  let moistureDeductionPercentage = 0;
  if (excessMoisture > 0) {
    moistureDeductionPercentage = Number(excessMoisture.toFixed(2));
  }

  // 2. Calculate grade-specific deduction
  let gradeDeductionPercentage = 0;
  let deductionType: DeductionType = 'PERCENTAGE';
  let isEligible = true;
  let ineligibilityReason: string | undefined;

  switch (input.grade) {
    case CropQualityGrade.GRADE_A:
      gradeDeductionPercentage = 0;
      break;
    case CropQualityGrade.GRADE_B:
      gradeDeductionPercentage = 2.0; // 2% statutory FAQ deduction
      break;
    case CropQualityGrade.GRADE_C:
      gradeDeductionPercentage = 5.0; // 5% standard tolerance deduction
      break;
    case CropQualityGrade.BELOW_FAQ:
      if (excessMoisture > 5.0) {
        deductionType = 'REJECTION';
        isEligible = false;
        ineligibilityReason = `Excess moisture (${measuredMoisture}%) exceeds maximum statutory permissible FAQ ceiling (${standardLimit + 5}%).`;
      } else {
        gradeDeductionPercentage = 10.0; // Sub-FAQ distress procurement waiver
      }
      break;
    default:
      gradeDeductionPercentage = 0;
  }

  if (input.customDeductionPercentage !== undefined && input.isHumanOverride) {
    gradeDeductionPercentage = Number(input.customDeductionPercentage);
  }

  const totalDeductionPercentage = Number((moistureDeductionPercentage + gradeDeductionPercentage).toFixed(2));
  const deductionAmountPerQuintal = Number(((lockedMsp * totalDeductionPercentage) / 100).toFixed(2));
  const effectiveRatePerQuintal = Number(Math.max(0, lockedMsp - deductionAmountPerQuintal).toFixed(2));

  const statutoryRuleApplied =
    `Locked MSP: ₹${lockedMsp}/qtl | Grade: ${input.grade} (${gradeDeductionPercentage}%) ` +
    `| Moisture: ${measuredMoisture}% (Limit: ${standardLimit}%, Excess: ${excessMoisture}%, Ded: ${moistureDeductionPercentage}%) ` +
    `| Total Deduction: ${totalDeductionPercentage}% (₹${deductionAmountPerQuintal}/qtl) ` +
    `| Effective Rate: ₹${effectiveRatePerQuintal}/qtl`;

  return {
    lockedMspRate: lockedMsp,
    standardMoistureLimit: standardLimit,
    measuredMoisturePercentage: measuredMoisture,
    isMoisturePass,
    excessMoisturePercentage: excessMoisture,
    grade: input.grade,
    deductionType,
    moistureDeductionPercentage,
    gradeDeductionPercentage,
    totalDeductionPercentage,
    deductionAmountPerQuintal,
    effectiveRatePerQuintal,
    isEligibleForProcurement: isEligible,
    ineligibilityReason,
    statutoryRuleApplied,
  };
}

/**
 * Validates weighment values and computes final net weight and payable amount
 */
export function calculateWeighment(input: WeighmentCalculationInput, bookingId = ''): WeighmentCalculationResult {
  const gross = Number(Number(input.grossWeightQuintals).toFixed(2));
  const tare = Number(Number(input.tareWeightQuintals).toFixed(2));

  if (gross <= 0) {
    throw new Error('Gross weight must be greater than zero quintals.');
  }

  if (tare < 0) {
    throw new Error('Tare weight cannot be negative.');
  }

  if (gross <= tare) {
    throw new Error(`Gross weight (${gross} qtl) must be strictly greater than tare weight (${tare} qtl).`);
  }

  const netWeightQuintals = Number((gross - tare).toFixed(2));
  const effectiveRate = Number(Number(input.effectiveRatePerQuintal).toFixed(2));
  const lockedMsp = Number(Number(input.lockedMspRate).toFixed(2));

  const totalWithoutDeduction = Number((netWeightQuintals * lockedMsp).toFixed(2));
  const finalPayableAmount = Number((netWeightQuintals * effectiveRate).toFixed(2));
  const deductionAmountTotal = Number((totalWithoutDeduction - finalPayableAmount).toFixed(2));

  const snapshot: ProcurementCalculationSnapshotDTO = {
    bookingId,
    lockedMSP: lockedMsp,
    qualityGrade: input.qualityGrade,
    deductionType: input.deductionType,
    deductionValue: input.deductionValue,
    effectiveRate,
    grossWeight: gross,
    tareWeight: tare,
    netWeight: netWeightQuintals,
    finalAmount: finalPayableAmount,
    calculatedAt: new Date().toISOString(),
  };

  return {
    grossWeightQuintals: gross,
    tareWeightQuintals: tare,
    netWeightQuintals,
    lockedMspRate: lockedMsp,
    effectiveRatePerQuintal: effectiveRate,
    deductionAmountTotal,
    finalPayableAmount,
    snapshot,
  };
}
