// ==============================================================================
// KisanFlow — Operator Digital Weighbridge & Procurement Finalization Modal
// Gross / Tare Weighment, Dry-run Preview, and Automated Settlement Voucher
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  Scale,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  TrendingDown,
  Landmark,
} from 'lucide-react';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Badge } from '../ui/Badge.tsx';
import {
  previewWeighment,
  recordWeighment,
  WeighmentPreviewResult,
} from '../../services/weighmentService.ts';
import { createSettlement } from '../../services/settlementService.ts';

interface WeighmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  onWeighmentCompleted: () => void;
}

export const WeighmentModal: React.FC<WeighmentModalProps> = ({
  isOpen,
  onClose,
  booking,
  onWeighmentCompleted,
}) => {
  const [grossWeight, setGrossWeight] = useState<string>('7500'); // 7500 kg
  const [tareWeight, setTareWeight] = useState<string>('2500'); // 2500 kg -> Net 5000 kg (50 Qtl)
  const [preview, setPreview] = useState<WeighmentPreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch preview on weight change
  useEffect(() => {
    if (isOpen && booking) {
      const g = parseFloat(grossWeight);
      const t = parseFloat(tareWeight);
      if (g > t && t > 0) {
        setLoadingPreview(true);
        previewWeighment({
          bookingId: booking.id,
          grossWeightKg: g,
          tareWeightKg: t,
        })
          .then((res) => {
            setPreview(res);
            setError(null);
          })
          .catch((err) => setError(err.message))
          .finally(() => setLoadingPreview(false));
      }
    }
  }, [isOpen, booking, grossWeight, tareWeight]);

  if (!isOpen || !booking) return null;

  const handleFinalize = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const g = parseFloat(grossWeight);
      const t = parseFloat(tareWeight);
      if (isNaN(g) || isNaN(t) || g <= t) {
        throw new Error('Gross weight must be strictly greater than tare weight.');
      }

      // 1. Record weighment
      await recordWeighment({
        bookingId: booking.id,
        grossWeightKg: g,
        tareWeightKg: t,
        weighbridgeId: 'WB-KAR-01',
      });

      // 2. Generate authoritative procurement settlement voucher
      await createSettlement(booking.id).catch((err) => {
        console.warn('Settlement already initialized or generated:', err);
      });

      onWeighmentCompleted();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record weighment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Scale className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">Digital Weighbridge Station</h3>
              <p className="text-[11px] text-neutral-400">
                Calibrated Weighment & Authoritative Settlement Calculation
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Booking / Farmer Bar */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex justify-between text-xs">
            <div>
              <span className="text-neutral-500">Booking:</span>{' '}
              <span className="font-mono font-bold text-neutral-900">{booking.bookingReference}</span>
            </div>
            <div>
              <span className="text-neutral-500">Crop:</span>{' '}
              <span className="font-semibold text-neutral-900">{booking.crop?.name}</span>
            </div>
            <div>
              <span className="text-neutral-500">Locked MSP:</span>{' '}
              <span className="font-bold text-emerald-700">₹{booking.lockedMspRate} / Qtl</span>
            </div>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Gross Weight (Loaded Vehicle kg)
              </label>
              <Input
                type="number"
                value={grossWeight}
                onChange={(e) => setGrossWeight(e.target.value)}
                placeholder="e.g. 7500"
              />
              <span className="text-[10px] text-neutral-400">Vehicle + Cargo</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Tare Weight (Empty Vehicle kg)
              </label>
              <Input
                type="number"
                value={tareWeight}
                onChange={(e) => setTareWeight(e.target.value)}
                placeholder="e.g. 2500"
              />
              <span className="text-[10px] text-neutral-400">Tare certificate verified</span>
            </div>
          </div>

          {/* Authoritative Dry-run Preview */}
          {preview ? (
            <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <span className="font-bold text-emerald-950">Authoritative Calculation Preview</span>
                <Badge variant="success">Backend Verified</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-neutral-600">Net Weight:</span>
                  <div className="text-base font-black text-neutral-900">
                    {preview.netWeightQuintals} Quintals{' '}
                    <span className="text-xs font-normal text-neutral-500">({preview.netWeightKg} kg)</span>
                  </div>
                </div>

                <div>
                  <span className="text-neutral-600">Effective Rate:</span>
                  <div className="text-base font-bold text-emerald-800">
                    ₹{preview.effectiveRatePerQuintal} / Qtl
                  </div>
                </div>
              </div>

              {preview.deductionPercentage > 0 && (
                <div className="flex justify-between text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                  <span>Quality / Moisture Deduction ({preview.deductionPercentage}%):</span>
                  <span>- ₹{preview.qualityDeductionTotal.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-emerald-200 pt-2 text-sm font-black text-emerald-950">
                <span>Final Statutory Payable:</span>
                <span>₹{preview.netPayableAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-neutral-400">
              {loadingPreview ? 'Calculating dry-run preview...' : 'Enter valid gross and tare weight'}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleFinalize}
              disabled={submitting || !preview}
            >
              <FileCheck className="w-4 h-4 mr-1" />
              <span>{submitting ? 'Generating Settlement...' : 'Certify Weighment & Settle'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
