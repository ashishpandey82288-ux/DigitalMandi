// ==============================================================================
// DigitalMandi — Register Cultivated Crop Modal
// Connects Land Parcels with Crop Master for Statutory MSP Procurement Eligibility
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sprout,
  MapPin,
  ShieldCheck,
  AlertCircle,
  Plus,
  ChevronDown,
  Info,
  Loader2,
  Calendar,
  Scale,
} from 'lucide-react';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Badge } from '../ui/Badge.tsx';
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
  onOpenAddFarm?: () => void;
  initialFarms?: FarmDTO[];
  initialCrops?: CropMasterDTO[];
}

export const RegisterCropModal: React.FC<RegisterCropModalProps> = ({
  isOpen,
  onClose,
  onCropRegistered,
  onOpenAddFarm,
  initialFarms,
  initialCrops,
}) => {
  // Data state
  const [farms, setFarms] = useState<FarmDTO[]>(initialFarms || []);
  const [crops, setCrops] = useState<CropMasterDTO[]>(initialCrops || []);
  const [loadingData, setLoadingData] = useState<boolean>(!initialFarms || initialFarms.length === 0);
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
    setLoadingData(true);
    setLoadError(null);
    setSubmitError(null);

    Promise.all([
      getFarmerFarms().catch(() => [] as FarmDTO[]),
      getCrops().catch(() => [] as CropMasterDTO[]),
    ])
      .then(([farmsData, cropsData]) => {
        if (!isMounted) return;
        setFarms(farmsData);
        setCrops(cropsData);

        // Auto-select first farm if available and none selected
        if (farmsData.length > 0 && !selectedFarmId) {
          setSelectedFarmId(farmsData[0].id);
        }
        // Auto-select first crop if available and none selected
        if (cropsData.length > 0 && !selectedCropId) {
          setSelectedCropId(cropsData[0].id);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err instanceof Error ? err.message : 'Unable to load farm parcels. Please try again.');
      })
      .finally(() => {
        if (isMounted) setLoadingData(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Keep selection valid if farms list updates
  useEffect(() => {
    if (farms.length > 0 && !selectedFarmId) {
      setSelectedFarmId(farms[0].id);
    }
  }, [farms, selectedFarmId]);

  // Selected farm details
  const selectedFarm = useMemo(() => {
    return farms.find((f) => f.id === selectedFarmId) || null;
  }, [farms, selectedFarmId]);

  // Selected crop details
  const selectedCrop = useMemo(() => {
    return crops.find((c) => c.id === selectedCropId) || null;
  }, [crops, selectedCropId]);

  // Cultivated area validation
  const areaValidation = useMemo(() => {
    if (!cultivatedArea.trim()) {
      return { isValid: false, error: null }; // Clean empty state
    }
    const val = parseFloat(cultivatedArea);
    if (isNaN(val) || val <= 0) {
      return { isValid: false, error: 'Cultivated area must be greater than 0 acres.' };
    }
    if (selectedFarm) {
      const maxArea = Number(selectedFarm.totalAreaAcres || 0);
      if (maxArea > 0 && val > maxArea) {
        return {
          isValid: false,
          error: `Cultivated area cannot exceed the selected farm parcel's available area (${maxArea.toFixed(2)} Acres).`,
        };
      }
    }
    return { isValid: true, error: null };
  }, [cultivatedArea, selectedFarm]);

  // Expected yield validation
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
      Boolean(selectedFarmId) &&
      Boolean(selectedCropId) &&
      Boolean(season) &&
      areaValidation.isValid &&
      yieldValidation.isValid &&
      !isSubmitting &&
      !loadingData
    );
  }, [selectedFarmId, selectedCropId, season, areaValidation.isValid, yieldValidation.isValid, isSubmitting, loadingData]);

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedFarmId) {
      setSubmitError('Please select a registered farm parcel.');
      return;
    }
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

    setIsSubmitting(true);
    try {
      const payload = {
        farmId: selectedFarmId,
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
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]">
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
                Link crop cultivation to certified land parcels for statutory MSP procurement
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
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
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

          <form onSubmit={handleSubmit} id="register-crop-form" className="space-y-5">
            {/* STEP 1: Land Parcel & Crop Selection */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-neutral-800 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>Land Parcel & Crop Catalog</span>
              </div>

              {/* Farm Parcel Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Select Farm Parcel <span className="text-rose-500">*</span>
                </label>

                {loadingData ? (
                  <div className="w-full px-3.5 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-500 flex items-center space-x-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>Loading your registered land parcels...</span>
                  </div>
                ) : farms.length === 0 ? (
                  <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-xl text-xs text-amber-900 space-y-2.5">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">No farm parcels registered yet</span>
                        <span className="text-[11px] text-amber-800">
                          You need at least one registered land parcel to record cultivated crops for MSP procurement.
                        </span>
                      </div>
                    </div>
                    {onOpenAddFarm && (
                      <div className="pt-1">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={onOpenAddFarm}
                          className="text-xs flex items-center space-x-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Register Land Parcel</span>
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <select
                        id="farm-parcel-select"
                        value={selectedFarmId}
                        onChange={(e) => setSelectedFarmId(e.target.value)}
                        className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 pr-10 text-xs sm:text-sm bg-white text-neutral-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-600 appearance-none cursor-pointer transition-all"
                      >
                        <option value="">Select Farm Parcel...</option>
                        {farms.map((farm) => (
                          <option key={farm.id} value={farm.id}>
                            {farm.farmName} • {Number(farm.totalAreaAcres || 0).toFixed(2)} Acres • {farm.village || 'Primary Plot'} ({farm.verificationStatus || 'Verified'})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3.5 top-3 pointer-events-none" />
                    </div>

                    {/* Selected Farm Information Card */}
                    {selectedFarm && (
                      <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 text-xs text-neutral-700 flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <div>
                            <span className="font-bold text-emerald-950 block sm:inline">
                              {selectedFarm.farmName}
                            </span>
                            <span className="text-[11px] text-neutral-600 sm:ml-2">
                              {selectedFarm.village ? `${selectedFarm.village}, ` : ''}{selectedFarm.district || 'Karnal'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px]">
                          <span className="text-neutral-600">
                            Available Area: <strong className="text-neutral-900">{Number(selectedFarm.totalAreaAcres || 0).toFixed(2)} Acres</strong>
                          </span>
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                            <ShieldCheck className="w-3 h-3 text-emerald-700" />
                            <span>{selectedFarm.verificationStatus || 'DILRMP Verified'}</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2-Column Crop and Season Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Crop Selection */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Crop <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="crop-select"
                      value={selectedCropId}
                      onChange={(e) => setSelectedCropId(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 pr-10 text-xs sm:text-sm bg-white text-neutral-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-600 appearance-none cursor-pointer transition-all"
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
                </div>

                {/* Season Selection */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Agricultural Season <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="season-select"
                      value={season}
                      onChange={(e) => setSeason(e.target.value as 'KHARIF' | 'RABI' | 'ZAID')}
                      className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 pr-10 text-xs sm:text-sm bg-white text-neutral-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-600 appearance-none cursor-pointer transition-all"
                    >
                      <option value="RABI">Rabi (Winter)</option>
                      <option value="KHARIF">Kharif (Monsoon)</option>
                      <option value="ZAID">Zaid (Summer)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3.5 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 2: Cultivation Details */}
            <div className="space-y-3 pt-2 border-t border-neutral-100">
              <div className="flex items-center space-x-2 text-xs font-bold text-neutral-800 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>Cultivation & Harvest Yield Estimates</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Cultivated Area Input */}
                <div>
                  <Input
                    id="cultivated-area-input"
                    label="Cultivated Area (Acres) *"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedFarm ? String(selectedFarm.totalAreaAcres) : undefined}
                    value={cultivatedArea}
                    onChange={(e) => setCultivatedArea(e.target.value)}
                    placeholder="e.g. 2.50"
                    error={areaValidation.error || undefined}
                    helperText={
                      selectedFarm
                        ? `Maximum ${Number(selectedFarm.totalAreaAcres || 0).toFixed(2)} acres available for this parcel`
                        : 'Select a farm parcel first to validate available acreage'
                    }
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
              </div>

              {/* Informative Guidance Banner */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 text-[11px] text-neutral-600 flex items-start space-x-2">
                <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                <span>
                  Registered crops will automatically receive an official MSP lock upon harvest scheduling and become eligible for direct payment transfer (DBT) to your linked bank account.
                </span>
              </div>
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
