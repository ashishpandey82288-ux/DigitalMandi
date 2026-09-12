// ==============================================================================
// KisanFlow — Operator Transport & Logistics Dispatch Modal
// Manages Vehicle Assignment, Gate Passes, and Real-time Depot Dispatch
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  Truck,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  Send,
} from 'lucide-react';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Badge } from '../ui/Badge.tsx';
import {
  createTransportRequest,
  assignVehicle,
  dispatchTransport,
  getTransporters,
  getVehicles,
  getDrivers,
  getDestinations,
  TransportRequestDTO,
} from '../../services/transportService.ts';

interface TransportModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  onTransportUpdated: () => void;
}

export const TransportModal: React.FC<TransportModalProps> = ({
  isOpen,
  onClose,
  booking,
  onTransportUpdated,
}) => {
  const [transporters, setTransporters] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);

  const [selectedTransporterId, setSelectedTransporterId] = useState<string>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedDestId, setSelectedDestId] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        getTransporters(),
        getVehicles(),
        getDrivers(),
        getDestinations(),
      ])
        .then(([t, v, d, dest]) => {
          setTransporters(t);
          setVehicles(v);
          setDrivers(d);
          setDestinations(dest);
          if (t.length > 0) setSelectedTransporterId(t[0].id);
          if (v.length > 0) setSelectedVehicleId(v[0].id);
          if (d.length > 0) setSelectedDriverId(d[0].id);
          if (dest.length > 0) setSelectedDestId(dest[0].id);
        })
        .catch((err) => setError(err.message));
    }
  }, [isOpen]);

  if (!isOpen || !booking) return null;

  const handleCreateAndDispatch = async () => {
    setError(null);
    setLoading(true);
    try {
      // 1. Create transport request
      const req = await createTransportRequest({
        bookingId: booking.id,
        procurementCenterId: booking.procurementCenterId,
        destinationWarehouseId: selectedDestId || undefined,
        quantityQuintals: booking.quantityQuintals || 50,
      });

      // 2. Assign vehicle and driver
      if (selectedTransporterId && selectedVehicleId && selectedDriverId) {
        await assignVehicle(req.id, {
          transporterId: selectedTransporterId,
          vehicleId: selectedVehicleId,
          driverId: selectedDriverId,
        });

        // 3. Dispatch shipment
        await dispatchTransport(req.id, {
          dispatchGatePassNumber: `GP-DISP-${Date.now().toString().slice(-5)}`,
        });
      }

      onTransportUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch shipment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
        <div className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">FCI / CWC Warehouse Dispatch</h3>
              <p className="text-[11px] text-neutral-400">
                Allocate Commercial Fleet & Issue Inter-State Dispatch Gate Pass
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex justify-between text-xs">
            <div>
              <span className="text-neutral-500">Lot Reference:</span>{' '}
              <span className="font-mono font-bold text-neutral-900">{booking.bookingReference}</span>
            </div>
            <div>
              <span className="text-neutral-500">Cargo:</span>{' '}
              <span className="font-semibold text-neutral-900">
                {booking.quantityQuintals} Qtl {booking.crop?.name}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-800 mb-1">
              Destination Food Corporation of India (FCI) / CWC Depot
            </label>
            <select
              value={selectedDestId}
              onChange={(e) => setSelectedDestId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs bg-white text-neutral-900"
            >
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code}) — {d.district}, {d.state}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Authorized Transporter
              </label>
              <select
                value={selectedTransporterId}
                onChange={(e) => setSelectedTransporterId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 p-2 text-xs bg-white text-neutral-900"
              >
                {transporters.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (PAN: {t.panNumber || 'NA'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Commercial Vehicle
              </label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 p-2 text-xs bg-white text-neutral-900"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber} ({v.vehicleType})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-800 mb-1">
              Designated Driver
            </label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 p-2 text-xs bg-white text-neutral-900"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} • Lic: {d.licenseNumber} • Mob: {d.phone}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-neutral-200">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateAndDispatch}
              disabled={loading}
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              <span>{loading ? 'Dispatching...' : 'Assign Vehicle & Dispatch'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
