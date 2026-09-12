// ==============================================================================
// KisanFlow — Smart Procurement Booking Wizard
// Multi-step reservation: Crop -> Center -> Date -> 90-min Slot -> Quantity -> MSP Lock
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Calendar,
  Clock,
  Building2,
  Sprout,
  Scale,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Truck,
} from 'lucide-react';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Badge } from '../ui/Badge.tsx';
import { getCenters, getCenterSlots, ProcurementCenterDTO, BookingSlotDTO } from '../../services/centerService.ts';
import { createBooking, BookingDTO } from '../../services/bookingService.ts';

interface BookingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmerCrops: any[];
  onBookingCreated: (booking: BookingDTO) => void;
}

export const BookingWizardModal: React.FC<BookingWizardModalProps> = ({
  isOpen,
  onClose,
  farmerCrops,
  onBookingCreated,
}) => {
  const [step, setStep] = useState<number>(1);
  const [centers, setCenters] = useState<ProcurementCenterDTO[]>([]);
  const [slots, setSlots] = useState<BookingSlotDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [selectedCropId, setSelectedCropId] = useState<string>('');
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // default tomorrow
    return d.toISOString().split('T')[0];
  });
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('50');
  const [vehicleType, setVehicleType] = useState<'TRACTOR_TROLLEY' | 'SMALL_TRUCK' | 'LARGE_TRUCK' | 'OTHER'>('TRACTOR_TROLLEY');
  const [vehicleNumber, setVehicleNumber] = useState<string>('HR-05-AB-1234');
  const [driverName, setDriverName] = useState<string>('Ramesh Kumar');
  const [driverPhone, setDriverPhone] = useState<string>('9876543210');

  // Load centers on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError(null);
      if (farmerCrops.length > 0 && !selectedCropId) {
        setSelectedCropId(farmerCrops[0].id);
      }
      getCenters()
        .then((data) => {
          setCenters(data);
          if (data.length > 0 && !selectedCenterId) {
            setSelectedCenterId(data[0].id);
          }
        })
        .catch((err) => setError(err.message));
    }
  }, [isOpen, farmerCrops]);

  // Load slots when center or date changes
  useEffect(() => {
    if (selectedCenterId && selectedDate) {
      setLoading(true);
      getCenterSlots(selectedCenterId, selectedDate)
        .then((data) => {
          setSlots(data);
          if (data.length > 0) {
            setSelectedSlotId(data[0].id);
          }
        })
        .catch(() => setSlots([]))
        .finally(() => setLoading(false));
    }
  }, [selectedCenterId, selectedDate]);

  if (!isOpen) return null;

  const currentCrop = farmerCrops.find((c) => c.id === selectedCropId);
  const currentCenter = centers.find((c) => c.id === selectedCenterId);
  const currentSlot = slots.find((s) => s.id === selectedSlotId);

  // Authoritative MSP rate from crop relation
  const mspRate = currentCrop?.crop?.currentMSP?.ratePerQuintal || 2275;
  const numQuantity = parseFloat(quantity) || 0;
  const estimatedPayout = numQuantity * mspRate;

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!selectedCropId || !selectedCenterId || !selectedSlotId || !numQuantity) {
        throw new Error('Please fill in all mandatory booking fields.');
      }

      const booking = await createBooking({
        farmerCropId: selectedCropId,
        procurementCenterId: selectedCenterId,
        bookingSlotId: selectedSlotId,
        bookingDate: selectedDate,
        quantityQuintals: numQuantity,
        vehicleType,
        vehicleNumber,
        driverName,
        driverPhone,
      });

      onBookingCreated(booking);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Smart Mandi Slot Booking</h3>
              <p className="text-[11px] text-neutral-400">Guaranteed MSP Lock & Virtual Token Reservation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between text-xs">
          <div className={`font-semibold ${step >= 1 ? 'text-emerald-700' : 'text-neutral-400'}`}>
            1. Crop & Center
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <div className={`font-semibold ${step >= 2 ? 'text-emerald-700' : 'text-neutral-400'}`}>
            2. Date & 90-min Slot
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <div className={`font-semibold ${step >= 3 ? 'text-emerald-700' : 'text-neutral-400'}`}>
            3. Quantity & Vehicle
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <div className={`font-semibold ${step >= 4 ? 'text-emerald-700' : 'text-neutral-400'}`}>
            4. Review & Lock
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Select Crop & Center */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  Select Registered Cultivated Crop
                </label>
                {farmerCrops.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    No registered crop records found. Please register your crop first.
                  </div>
                ) : (
                  <select
                    value={selectedCropId}
                    onChange={(e) => setSelectedCropId(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 p-2.5 text-sm bg-white text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {farmerCrops.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.crop?.name || 'Crop'} ({c.season}) — {c.cultivatedArea} Acres on {c.farm?.farmName || 'Farm'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  Select Government Procurement Center
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {centers.map((center) => (
                    <label
                      key={center.id}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        selectedCenterId === center.id
                          ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                          : 'border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="center"
                          checked={selectedCenterId === center.id}
                          onChange={() => setSelectedCenterId(center.id)}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <div className="font-bold text-neutral-900">{center.name}</div>
                          <div className="text-[11px] text-neutral-500">
                            Code: <span className="font-mono">{center.centerCode}</span> • {center.district}, {center.state}
                          </div>
                        </div>
                      </div>
                      <Badge variant="success">Daily Cap: {center.dailyCapacityQuintals} Qtl</Badge>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Select Date & 90-min Slot */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  Delivery Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 p-2.5 text-sm bg-white text-neutral-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-neutral-800">
                    Select 90-Minute Unloading Slot
                  </label>
                  <span className="text-[11px] text-neutral-500">Real-time Bay Capacity</span>
                </div>

                {loading ? (
                  <div className="py-8 text-center text-xs text-neutral-500">Loading slots...</div>
                ) : slots.length === 0 ? (
                  <div className="p-4 bg-neutral-50 rounded-xl text-center text-xs text-neutral-500">
                    No slots configured for this date. Defaulting to standard 09:00 - 10:30 slot.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {slots.map((s) => {
                      const isAvail = (s.availableCapacityQuintals || 0) > 0;
                      return (
                        <label
                          key={s.id}
                          className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col justify-between transition-all ${
                            selectedSlotId === s.id
                              ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                              : isAvail
                              ? 'border-neutral-200 hover:bg-neutral-50'
                              : 'opacity-50 border-neutral-200 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-neutral-900">
                              {s.slotStartTime} - {s.slotEndTime}
                            </span>
                            <input
                              type="radio"
                              name="slot"
                              checked={selectedSlotId === s.id}
                              onChange={() => isAvail && setSelectedSlotId(s.id)}
                              disabled={!isAvail}
                              className="text-emerald-600 focus:ring-emerald-500"
                            />
                          </div>
                          <div className="mt-2 text-[10px] text-neutral-600 flex justify-between">
                            <span>Available:</span>
                            <span className="font-semibold text-emerald-700">
                              {s.availableCapacityQuintals} / {s.maxCapacityQuintals} Qtl
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Quantity & Vehicle Info */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Expected Delivery Quantity (Quintals)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quintals e.g. 50"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-neutral-400 font-medium">Quintals</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  1 Quintal = 100 kg. Max single booking allocation: 500 Quintals.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Vehicle Type
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e: any) => setVehicleType(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 p-2 text-xs bg-white text-neutral-900"
                  >
                    <option value="TRACTOR_TROLLEY">Tractor Trolley</option>
                    <option value="SMALL_TRUCK">Small Truck (Pickup)</option>
                    <option value="LARGE_TRUCK">Heavy Commercial Truck</option>
                    <option value="OTHER">Other Transport</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Vehicle Registration #
                  </label>
                  <Input
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="e.g. HR-05-AB-1234"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Driver / Operator Name
                  </label>
                  <Input
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Driver Mobile Contact
                  </label>
                  <Input
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Review & Lock MSP */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <span className="font-semibold text-emerald-950">Statutory MSP Price Guarantee</span>
                  <span className="text-base font-black text-emerald-800">₹{mspRate} / Qtl</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Crop:</span>
                  <span className="font-bold text-neutral-900">{currentCrop?.crop?.name || 'Selected Crop'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Center:</span>
                  <span className="font-bold text-neutral-900">{currentCenter?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Date & Slot:</span>
                  <span className="font-bold text-neutral-900">
                    {selectedDate} ({currentSlot?.slotStartTime || '09:00'} - {currentSlot?.slotEndTime || '10:30'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Quantity:</span>
                  <span className="font-bold text-neutral-900">{numQuantity} Quintals</span>
                </div>
                <div className="flex justify-between border-t border-emerald-200 pt-2 text-sm font-bold text-emerald-950">
                  <span>Estimated Total Payout:</span>
                  <span>₹{estimatedPayout.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-[11px] text-neutral-600 space-y-1">
                <div className="flex items-center text-emerald-800 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Statutory Direct Benefit Transfer (DBT) Assured
                </div>
                <p>
                  Upon gate check-in, moisture verification, and weighment certification, DBT disbursement will be executed directly to your PM-Kisan linked account within statutory timelines.
                </p>
              </div>
            </div>
          )}

          {/* Footer Nav Controls */}
          <div className="flex justify-between pt-4 border-t border-neutral-200">
            {step > 1 ? (
              <Button variant="secondary" size="sm" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span>Back</span>
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={onClose}>
                <span>Cancel</span>
              </Button>
            )}

            {step < 4 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 && (!selectedCropId || !selectedCenterId)}
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={loading}
              >
                <span>{loading ? 'Locking MSP...' : 'Confirm & Generate Gate Pass'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
