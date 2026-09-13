// ==============================================================================
// KisanFlow — Operator Quality Inspection & AI Grading Modal
// AI/CV analysis + Human Quality Inspector Certified Review
// ==============================================================================

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Scale,
  RefreshCw,
  Camera,
  Layers,
} from 'lucide-react';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Badge } from '../ui/Badge.tsx';
import {
  createQualityInspection,
  verifyQualityInspection,
  QualityInspectionDTO,
} from '../../services/gradingService.ts';

interface InspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  onInspectionCompleted: () => void;
}

export const InspectionModal: React.FC<InspectionModalProps> = ({
  isOpen,
  onClose,
  booking,
  onInspectionCompleted,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form parameters
  const [moisture, setMoisture] = useState<string>('12.4');
  const [foreignMatter, setForeignMatter] = useState<string>('1.2');
  const [damagedGrains, setDamagedGrains] = useState<string>('1.5');
  const [brokenGrains, setBrokenGrains] = useState<string>('2.0');
  const [remarks, setRemarks] = useState<string>('Sample drawn uniformly from top, middle and bottom sacks.');

  // Result state
  const [inspectionResult, setInspectionResult] = useState<QualityInspectionDTO | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifiedGrade, setVerifiedGrade] = useState<string>('GRADE_A');
  const [verifiedRemarks, setVerifiedRemarks] = useState<string>('Conforms to statutory FAQ Agmarknet tolerances.');

  if (!isOpen || !booking) return null;

  const handleRunAiGrading = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await createQualityInspection({
        bookingId: booking.id,
        moisturePercentage: parseFloat(moisture),
        foreignMatterPercentage: parseFloat(foreignMatter),
        damagedGrainsPercentage: parseFloat(damagedGrains),
        brokenGrainsPercentage: parseFloat(brokenGrains),
        remarks,
      });

      if (!res || !res.aiPredictedGrade) {
        setError('AI assessment unavailable — manual inspection required.');
        return;
      }

      setInspectionResult(res);
      setVerifiedGrade(res.finalGrade || res.aiPredictedGrade || 'GRADE_A');
      setIsVerifying(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Quality inspection service temporarily unavailable.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeVerification = async () => {
    if (!inspectionResult) return;
    setError(null);
    setLoading(true);
    try {
      await verifyQualityInspection(inspectionResult.id, {
        finalGrade: verifiedGrade,
        remarks: verifiedRemarks,
      });
      onInspectionCompleted();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to certify quality grade');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base font-bold">AI Computer Vision Quality Inspection</h3>
              <p className="text-[11px] text-emerald-300">
                Booking #{booking.bookingReference} • {booking.crop?.name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-emerald-300 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Booking Summary Strip */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-neutral-500">Farmer:</span>{' '}
              <span className="font-bold text-neutral-900">{booking.farmerProfile?.fullName || 'Farmer'}</span>
            </div>
            <div>
              <span className="text-neutral-500">Lot Quantity:</span>{' '}
              <span className="font-bold text-neutral-900">{booking.quantityQuintals} Qtl</span>
            </div>
            <div>
              <span className="text-neutral-500">Std Moisture Limit:</span>{' '}
              <span className="font-bold text-emerald-700">{booking.crop?.standardMoistureLimit || 12.0}%</span>
            </div>
          </div>

          {!isVerifying ? (
            /* Parameter Inputs */
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Moisture (%) <span className="text-rose-600">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={moisture}
                    onChange={(e) => setMoisture(e.target.value)}
                  />
                  <span className="text-[10px] text-neutral-400">Target &le; 12.0%</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Foreign Matter (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={foreignMatter}
                    onChange={(e) => setForeignMatter(e.target.value)}
                  />
                  <span className="text-[10px] text-neutral-400">Ref: &le; 2.0%</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Damaged Grains (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={damagedGrains}
                    onChange={(e) => setDamagedGrains(e.target.value)}
                  />
                  <span className="text-[10px] text-neutral-400">Ref: &le; 3.0%</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Broken Grains (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={brokenGrains}
                    onChange={(e) => setBrokenGrains(e.target.value)}
                  />
                  <span className="text-[10px] text-neutral-400">Ref: &le; 4.0%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Sampling Notes / Moisture Meter Calibration Ref
                </label>
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Grain moisture meter Cal. #8392"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
                <div className="flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span>Optical Camera & DigitalMandi ML Quality Engine Ready</span>
                </div>
                <Badge variant="info">Agmarknet FAQ</Badge>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <Button variant="secondary" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRunAiGrading}
                  disabled={loading}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  <span>{loading ? 'Running Optical Model...' : 'Execute AI CV Assessment'}</span>
                </Button>
              </div>
            </div>
          ) : (
            /* AI Results & Human Certification */
            <div className="space-y-4">
              {/* Distinct AI Prediction Box */}
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                      AI Computer Vision Model Prediction
                    </span>
                  </div>
                  <Badge variant={inspectionResult?.aiConfidenceScore && inspectionResult.aiConfidenceScore >= 0.85 ? "success" : "warning"}>
                    Confidence: {inspectionResult?.aiConfidenceScore !== undefined ? `${Math.round(inspectionResult.aiConfidenceScore * 100)}%` : 'Assessed'}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs bg-white/80 p-3 rounded-lg border border-emerald-200">
                  <div>
                    <span className="text-neutral-500">Predicted Grade:</span>
                    <div className="font-bold text-emerald-800 text-sm">
                      {inspectionResult?.aiPredictedGrade ? inspectionResult.aiPredictedGrade.replace('_', ' ') : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-500">Moisture Deduction:</span>
                    <div className="font-bold text-neutral-800">
                      {inspectionResult?.totalDeductionPercentage ?? 0}%
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-500">Model Version:</span>
                    <div className="font-mono text-[11px] text-neutral-700 truncate" title={inspectionResult?.aiModelVersion}>
                      {inspectionResult?.aiModelVersion || 'DigitalMandi-GrainVision-Wheat-v1.0'}
                    </div>
                  </div>
                </div>

                {/* Display Inference Status & Statutory Recommendation if available */}
                {(inspectionResult?.recommendation || inspectionResult?.aiInferenceStatus) && (
                  <div className="mt-2 pt-2 border-t border-emerald-200/60 flex items-start space-x-2 text-[11px] text-emerald-900">
                    <div className="flex-1">
                      <span className="font-semibold">AI Assessment: </span>
                      <span>{inspectionResult?.recommendation || `Status: ${inspectionResult?.aiInferenceStatus}`}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Human Inspector Certification Form */}
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-neutral-900 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-neutral-700" />
                  <span>Certified Human Quality Inspector Review</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1">
                      Final Certified Grade
                    </label>
                    <select
                      value={verifiedGrade}
                      onChange={(e) => setVerifiedGrade(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 p-2 text-xs bg-white text-neutral-900"
                    >
                      <option value="FAQ">FAQ (Fair Average Quality - 100% MSP)</option>
                      <option value="GRADE_A">Grade A (Premium)</option>
                      <option value="GRADE_B">Grade B (Standard FAQ)</option>
                      <option value="BELOW_FAQ">Below FAQ (Subject to Deduction)</option>
                      <option value="REJECTED">Rejected (Excessive Moisture / Defects)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1">
                      Inspector Verification Remarks
                    </label>
                    <Input
                      value={verifiedRemarks}
                      onChange={(e) => setVerifiedRemarks(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsVerifying(false)}
                >
                  Modify Parameters
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleFinalizeVerification}
                  disabled={loading}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  <span>{loading ? 'Certifying...' : 'Finalize Quality Certification'}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
