// ==============================================================================
// DigitalMandi — Register Cultivated Crop Modal
// Direct Cultivated Crop Registration for Statutory MSP Procurement Eligibility
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sprout,
  AlertCircle,
  ChevronDown,
  Info,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import {
  getFarmerFarms,
  getCrops,
  registerFarmerCrop,
  FarmDTO,
  CropMasterDTO,
} from '../../services/cropService.ts';

export interface RegisterCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCropRegistered: () => void;
  initialFarms?: FarmDTO[];
  initialCrops?: CropMasterDTO[];
}

export const RegisterCropModal: React.FC<RegisterCropModalProps> = ({
  isOpen,
  onClose,
  onCropRegistered,
  initialFarms,
  initialCrops,
}) => {
  // Data state
  const [farms, setFarms] = useState<FarmDTO[]>(initialFarms || []);
  const [crops, setCrops] = useState<CropMasterDTO[]>(initialCrops || []);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [selectedCropId, setSelectedCropId] = useState<string>('');
  const [season, setSeason] = useState<'RABI' | 'KHARIF' | 'ZAID'>('RABI');
  const [cultivatedArea, setCultivatedArea] = useState<string>('');
  const [expectedYield, setExpectedYield] = useState<string>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load farms & master crops on mount/open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setSubmitError(null);
    setLoadError(null);

    if (initialFarms && initialFarms.length > 0) {
      setFarms(initialFarms);
      if (!selectedFarmId) setSelectedFarmId(initialFarms[0].id);
    }
    if (initialCrops && initialCrops.length > 0) {
      setCrops(initialCrops);
      if (!selectedCropId) setSelectedCropId(initialCrops[0].id);
    }

    const needsFarms = !initialFarms || initialFarms.length === 0;
    const needsCrops = !initialCrops || initialCrops.length === 0;

    if (needsFarms || needsCrops) {
      setLoadingData(true);
      Promise.all([
        needsFarms ? getFarmerFarms().catch(() => [] as FarmDTO[]) : Promise.resolve(initialFarms || []),
        needsCrops ? getCrops().catch(() => [] as CropMasterDTO[]) : Promise.resolve(initialCrops || []),
      ])
        .then(([farmsData, cropsData]) => {
          if (!isMounted) return;
          setFarms(farmsData);
          setCrops(cropsData);

          if (farmsData.length > 0 && !selectedFarmId) {
            setSelectedFarmId(farmsData[0].id);
          }
          if (cropsData.length > 0 && !selectedCropId) {
            setSelectedCropId(cropsData[0].id);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setLoadError(err instanceof Error ? err.message : 'Unable to load crop data. Please try again.');
        })
        .finally(() => {
          if (isMounted) setLoadingData(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, initialFarms, initialCrops]);

  // Keep farm selection updated in background
  useEffect(() => {
    if (farms.length > 0 && !selectedFarmId) {
      setSelectedFarmId(farms[0].id);
    }
  }, [farms, selectedFarmId]);

  // Keep crop selection updated
  useEffect(() => {
    if (crops.length > 0 && !selectedCropId) {
      setSelectedCropId(crops[0].id);
    }
  }, [crops, selectedCropId]);

  // Cultivated area validation: area > 0
  const areaValidation = useMemo(() => {
    if (!cultivatedArea.trim()) {
      return { isValid: false, error: null };
    }
    const val = parseFloat(cultivatedArea);
    if (isNaN(val) || val <= 0) {
      return { isValid: false, error: 'Cultivated area must be greater than 0 acres.' };
    }
    return { isValid: true, error: null };
  }, [cultivatedArea]);

  // Expected yield validation: yield > 0
  const yieldValidation = useMemo(() => {
    if (!expectedYield.trim()) {
      return { isValid: false, error: null };
    }
    const val = parseFloat(expectedYield);
    if (isNaN(val) || val <= 0) {
      return { isValid: false, error: 'Please enter a valid expected yield greater than 0 quintals.' };
    }
    return { isValid: true, error: null };
  }, [expectedYield]);

  // Form submittability
  const canSubmit = useMemo(() => {
    return (
      Boolean(selectedCropId) &&
      Boolean(season) &&
      areaValidation.isValid &&
      yieldValidation.isValid &&
      !isSubmitting &&
      !loadingData
    );
  }, [selectedCropId, season, areaValidation.isValid, yieldValidation.isValid, isSubmitting, loadingData]);

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedCropId) {
      setSubmitError('Please select an eligible crop from the catalog.');
      return;
    }
    if (!areaValidation.isValid) {
      setSubmitError(areaValidation.error || 'Please enter a valid cultivated area.');
      return;
    }
    if (!yieldValidation.isValid) {
      setSubmitError(yieldValidation.error || 'Please enter a valid expected yield.');
      return;
    }

    const farmId = selectedFarmId || (farms.length > 0 ? farms[0].id : '');
    if (!farmId) {
      setSubmitError(
        'Mandi regulations require an active land record associated with your farmer profile. No registered land parcel was found for this account. Please contact mandi administration.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        farmId,
        cropId: selectedCropId,
        season,
        cultivatedArea: parseFloat(cultivatedArea),
        expectedYield: parseFloat(expectedYield),
      };

      await registerFarmerCrop(payload);

      // Reset form
      setCultivatedArea('');
      setExpectedYield('');
      onCropRegistered();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to register crop cultivation. Please try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-neutral-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/90 text-white flex items-center justify-center shadow-xs">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Register Cultivated Crop
              </h3>
              <p className="text-[11px] text-neutral-400">
                Register your seasonal crop to access statutory MSP procurement
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* General Submit Error */}
          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{submitError}</div>
            </div>
          )}

          {/* Data Loading Error */}
          {loadError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{loadError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} id="register-crop-form" className="space-y-4">
            {/* Crop Selection */}
            <div>
              <label htmlFor="crop-select" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Crop <span className="text-rose-500">*</span>
              </label>
              {loadingData && crops.length === 0 ? (
                <div className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-500 flex items-center space-x-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  <span>Loading crops catalog...</span>
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="crop-select"
                    value={selectedCropId}
                    onChange={(e) => setSelectedCropId(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 pr-10 text-xs sm:text-sm bg-white text-neutral-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-600 appearance-none cursor-pointer transition-all"
                    required
                  >
                    <option value="">Select Crop...</option>
                    {crops.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3.5 top-3 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Season Selection */}
            <div>
              <label htmlFor="season-select" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Season <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="season-select"
                  value={season}
                  onChange={(e) => setSeason(e.target.value as 'KHARIF' | 'RABI' | 'ZAID')}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 pr-10 text-xs sm:text-sm bg-white text-neutral-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-600 appearance-none cursor-pointer transition-all"
                  required
                >
                  <option value="RABI">Rabi (Winter)</option>
                  <option value="KHARIF">Kharif (Monsoon)</option>
                  <option value="ZAID">Zaid (Summer)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Cultivated Area Input */}
            <div>
              <Input
                id="cultivated-area-input"
                label="Cultivated Area (Acres) *"
                type="number"
                step="0.01"
                min="0.01"
                value={cultivatedArea}
                onChange={(e) => setCultivatedArea(e.target.value)}
                placeholder="e.g. 2.50"
                error={areaValidation.error || undefined}
                helperText="Enter the cultivated land area in acres"
                required
              />
            </div>

            {/* Expected Yield Input */}
            <div>
              <Input
                id="expected-yield-input"
                label="Expected Yield (Quintals) *"
                type="number"
                step="0.1"
                min="0.1"
                value={expectedYield}
                onChange={(e) => setExpectedYield(e.target.value)}
                placeholder="e.g. 45"
                error={yieldValidation.error || undefined}
                helperText="Enter your estimated harvest quantity in quintals"
                required
              />
            </div>

            {/* Informative Guidance Banner */}
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 text-[11px] text-neutral-600 flex items-start space-x-2">
              <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
              <span>
                Registered crops will receive an official MSP lock upon harvest scheduling and become eligible for direct payment transfer (DBT).
              </span>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end space-x-2.5 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="register-crop-form"
            variant="primary"
            size="sm"
            disabled={!canSubmit}
            className="text-xs min-w-[140px]"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Registering Crop...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-1.5">
                <Sprout className="w-3.5 h-3.5" />
                <span>Register Crop</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
