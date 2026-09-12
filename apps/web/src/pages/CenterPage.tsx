// ==============================================================================
// KisanFlow — Procurement Center Operator & Quality Inspector Portal (Phase 6)
// Gate Verification, Queue Routing, AI Quality Grading, Digital Weighbridge & Dispatch
// ==============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  ShieldCheck,
  Truck,
  Scale,
  Sparkles,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Search,
  Check,
  Send,
  ArrowRight,
  Filter,
  FileCheck,
  Layers,
  MapPin,
} from 'lucide-react';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { getCenters, getCenterBays, getCenterSlots, ProcurementCenterDTO } from '../services/centerService.ts';
import { getCenterDashboard, CenterDashboardDTO } from '../services/dashboardService.ts';
import { getBookings, updateBooking, BookingDTO } from '../services/bookingService.ts';
import { getTransportRequests, recordArrival, confirmDelivery, TransportRequestDTO } from '../services/transportService.ts';
import { InspectionModal } from '../components/operator/InspectionModal.tsx';
import { WeighmentModal } from '../components/operator/WeighmentModal.tsx';
import { TransportModal } from '../components/operator/TransportModal.tsx';
import { QRPassModal } from '../components/common/QRPassModal.tsx';

type CenterTab = 'QUEUE_CHECKIN' | 'QUALITY_GRADING' | 'WEIGHBRIDGE' | 'LOGISTICS_DISPATCH' | 'BAYS_SLOTS';

export const CenterPage: React.FC = () => {
  const { user } = useAuth();

  const [centers, setCenters] = useState<ProcurementCenterDTO[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<CenterTab>('QUEUE_CHECKIN');
  const [loading, setLoading] = useState<boolean>(true);
  const [dashboardData, setDashboardData] = useState<CenterDashboardDTO | null>(null);
  const [bookings, setBookings] = useState<BookingDTO[]>([]);
  const [transports, setTransports] = useState<TransportRequestDTO[]>([]);
  const [bays, setBays] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals state
  const [inspectBooking, setInspectBooking] = useState<BookingDTO | null>(null);
  const [weighBooking, setWeighBooking] = useState<BookingDTO | null>(null);
  const [transportBooking, setTransportBooking] = useState<BookingDTO | null>(null);
  const [viewPassBooking, setViewPassBooking] = useState<BookingDTO | null>(null);

  // Initial load of centers
  useEffect(() => {
    getCenters()
      .then((data) => {
        setCenters(data);
        if (data.length > 0) {
          // Default to user's assigned center if present, else first center
          const assigned = user?.operatorCenterId || user?.assignedCenterIds?.[0];
          const matched = data.find((c) => c.id === assigned || c.centerCode === assigned);
          setSelectedCenterId(matched ? matched.id : data[0].id);
        }
      })
      .catch((err) => setError(err.message));
  }, [user]);

  // Load center-specific data
  const loadCenterData = useCallback(async () => {
    if (!selectedCenterId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Center dashboard
      const dash = await getCenterDashboard(selectedCenterId).catch(() => null);
      if (dash) setDashboardData(dash);

      // 2. Center Bookings
      const bList = await getBookings({ centerId: selectedCenterId }).catch(() => []);
      setBookings(bList);

      // 3. Center Transports
      const tList = await getTransportRequests({ centerId: selectedCenterId }).catch(() => []);
      setTransports(tList);

      // 4. Center Bays
      const bayList = await getCenterBays(selectedCenterId).catch(() => []);
      setBays(bayList);

      // 5. Center Slots
      const slotList = await getCenterSlots(selectedCenterId).catch(() => []);
      setSlots(slotList);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh center data');
    } finally {
      setLoading(false);
    }
  }, [selectedCenterId]);

  useEffect(() => {
    loadCenterData();
  }, [loadCenterData]);

  // Handle Gate Check-in
  const handleGateCheckIn = async (bookingId: string) => {
    setError(null);
    try {
      await updateBooking(bookingId, { status: 'CHECKED_IN' });
      setFeedback('Farmer vehicle successfully checked in at gate. Directed to unloading bay.');
      await loadCenterData();
    } catch (err: any) {
      setError(err.message || 'Failed to check-in booking');
    }
  };

  // Filtered bookings
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.bookingReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.farmerProfile?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.crop?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.tokenNumber && String(b.tokenNumber).includes(searchQuery));

    if (!matchesSearch) return false;
    if (statusFilter === 'ALL') return true;
    return b.status === statusFilter;
  });

  const currentCenter = centers.find((c) => c.id === selectedCenterId) || dashboardData?.center;
  const stats = dashboardData?.stats;

  return (
    <div className="space-y-6">
      {/* Header & Center Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-neutral-900">Procurement Center Command</h1>
            <Badge variant="success">Station Online</Badge>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Mandi Operator & Quality Inspector Terminal • Direct Weighbridge and Automated Ledger
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Center Selector */}
          <div className="flex items-center space-x-1.5 bg-white border border-neutral-300 rounded-lg px-2.5 py-1">
            <Building2 className="w-4 h-4 text-neutral-500" />
            <select
              value={selectedCenterId}
              onChange={(e) => setSelectedCenterId(e.target.value)}
              className="text-xs font-semibold bg-transparent text-neutral-900 focus:outline-none"
            >
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.centerCode})
                </option>
              ))}
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={loadCenterData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </Button>
        </div>
      </div>

      {/* Security Banner */}
      <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-900">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
          <span>
            <strong>Center Operational Scope:</strong> Authorized for{' '}
            <span className="font-bold">{currentCenter?.name}</span> ({currentCenter?.district}, {currentCenter?.state}).
            Cross-mandi actions strictly blocked by RBAC middleware.
          </span>
        </div>
        <span className="font-mono text-[10px] text-blue-800 bg-white/80 px-2 py-0.5 rounded border border-blue-300 shrink-0">
          Daily Cap: {currentCenter?.dailyCapacityQuintals || 1000} Qtl
        </span>
      </div>

      {/* Alerts */}
      {feedback && (
        <div className="p-3 bg-emerald-100/80 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-800 hover:text-emerald-950 font-bold ml-2">×</button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-950 font-bold ml-2">×</button>
        </div>
      )}

      {/* Real-time KPI Metric Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 bg-white border border-neutral-200 rounded-xl shadow-xs">
          <span className="text-[11px] text-neutral-500 block">Total Scheduled</span>
          <div className="text-xl font-black text-neutral-900 mt-1">
            {stats?.todayTotalBookings || bookings.length}
          </div>
          <span className="text-[10px] text-neutral-400">90-min slots</span>
        </div>

        <div className="p-3 bg-white border border-neutral-200 rounded-xl shadow-xs">
          <span className="text-[11px] text-neutral-500 block">Checked In</span>
          <div className="text-xl font-black text-amber-600 mt-1">
            {stats?.checkedInCount || bookings.filter((b) => b.status === 'CHECKED_IN').length}
          </div>
          <span className="text-[10px] text-neutral-400">At Mandi Gate</span>
        </div>

        <div className="p-3 bg-white border border-neutral-200 rounded-xl shadow-xs">
          <span className="text-[11px] text-neutral-500 block">In Inspection / Bay</span>
          <div className="text-xl font-black text-blue-600 mt-1">
            {stats?.processingCount || bookings.filter((b) => ['IN_QUEUE', 'PROCESSING', 'QUALITY_ASSESSED'].includes(b.status)).length}
          </div>
          <span className="text-[10px] text-neutral-400">AI / Weighbridge</span>
        </div>

        <div className="p-3 bg-white border border-neutral-200 rounded-xl shadow-xs">
          <span className="text-[11px] text-neutral-500 block">Completed Lots</span>
          <div className="text-xl font-black text-emerald-700 mt-1">
            {stats?.completedCount || bookings.filter((b) => b.status === 'COMPLETED').length}
          </div>
          <span className="text-[10px] text-neutral-400">Procured & Settled</span>
        </div>

        <div className="p-3 bg-white border border-neutral-200 rounded-xl shadow-xs">
          <span className="text-[11px] text-neutral-500 block">Procured Weight</span>
          <div className="text-xl font-black text-neutral-900 mt-1">
            {stats?.todayProcuredQuintals || 0} <span className="text-xs font-normal">Qtl</span>
          </div>
          <span className="text-[10px] text-neutral-400">Net certified</span>
        </div>

        <div className="p-3 bg-white border border-neutral-200 rounded-xl shadow-xs">
          <span className="text-[11px] text-neutral-500 block">Capacity Utilization</span>
          <div className="text-xl font-black text-emerald-800 mt-1">
            {stats?.capacityUtilizationPercentage || 0}%
          </div>
          <span className="text-[10px] text-neutral-400">Of Daily Quota</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto text-xs font-semibold py-1">
          {[
            { key: 'QUEUE_CHECKIN', label: `Gate Queue & Check-In (${bookings.length})` },
            { key: 'QUALITY_GRADING', label: `Quality & AI Grading (${bookings.filter(b => ['CHECKED_IN', 'IN_QUEUE', 'PROCESSING'].includes(b.status)).length})` },
            { key: 'WEIGHBRIDGE', label: `Digital Weighbridge (${bookings.filter(b => b.status === 'QUALITY_ASSESSED').length})` },
            { key: 'LOGISTICS_DISPATCH', label: `Depot Dispatch (${transports.length})` },
            { key: 'BAYS_SLOTS', label: `Bays & Slots (${bays.length} Bays)` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as CenterTab)}
              className={`pb-2.5 px-2 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-800 font-bold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB 1: GATE QUEUE & CHECK-IN */}
      {activeTab === 'QUEUE_CHECKIN' && (
        <div className="space-y-4">
          {/* Filter / Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Booking Ref, Farmer Name, Crop, or Token #..."
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5 text-neutral-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs rounded-lg border border-neutral-300 p-2 bg-white text-neutral-900"
              >
                <option value="ALL">All Statuses</option>
                <option value="CONFIRMED">CONFIRMED (Awaiting Arrival)</option>
                <option value="CHECKED_IN">CHECKED_IN (At Gate)</option>
                <option value="PROCESSING">PROCESSING (In Bay)</option>
                <option value="QUALITY_ASSESSED">QUALITY_ASSESSED</option>
                <option value="WEIGHED">WEIGHED</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Token & Ref</th>
                    <th className="p-3">Farmer & Vehicle</th>
                    <th className="p-3">Crop & Quantity</th>
                    <th className="p-3">Scheduled Slot</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-neutral-900">
                          {b.tokenNumber ? `Token #${b.tokenNumber}` : 'Token Pending'}
                        </div>
                        <div className="font-mono text-[11px] text-neutral-500">{b.bookingReference}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-neutral-900">{b.farmerProfile?.fullName || 'Farmer'}</div>
                        <div className="text-[11px] text-neutral-500">
                          {b.farmerProfile?.village} • PIN: <span className="font-mono font-bold text-neutral-800">{b.gatePassPin || '849201'}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-neutral-900">{b.crop?.name}</div>
                        <div className="text-[11px] text-neutral-500">{b.quantityQuintals} Quintals • MSP ₹{b.lockedMspRate}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-neutral-800">{b.bookingDate}</div>
                        <div className="text-[10px] text-neutral-400">{b.timeSlotStart} - {b.timeSlotEnd}</div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            b.status === 'COMPLETED' ? 'success' :
                            b.status === 'CHECKED_IN' ? 'warning' :
                            b.status === 'QUALITY_ASSESSED' ? 'info' :
                            b.status === 'CANCELLED' ? 'danger' : 'neutral'
                          }
                        >
                          {b.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewPassBooking(b)}
                          className="py-1 px-2 text-xs"
                          title="View Digital Gate Pass & QR"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </Button>

                        {/* Status advancement actions */}
                        {b.status === 'CONFIRMED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleGateCheckIn(b.id)}
                            className="py-1 px-2.5 text-xs"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            <span>Gate Check-In</span>
                          </Button>
                        )}

                        {['CHECKED_IN', 'IN_QUEUE', 'PROCESSING'].includes(b.status) && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setInspectBooking(b)}
                            className="py-1 px-2.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1" />
                            <span>Inspect (AI CV)</span>
                          </Button>
                        )}

                        {b.status === 'QUALITY_ASSESSED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setWeighBooking(b)}
                            className="py-1 px-2.5 text-xs bg-blue-700 hover:bg-blue-800 text-white"
                          >
                            <Scale className="w-3.5 h-3.5 mr-1" />
                            <span>Weighbridge</span>
                          </Button>
                        )}

                        {b.status === 'COMPLETED' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setTransportBooking(b)}
                            className="py-1 px-2.5 text-xs"
                          >
                            <Truck className="w-3.5 h-3.5 mr-1" />
                            <span>Dispatch</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredBookings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-neutral-400">
                        No bookings match the search or filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUALITY & AI GRADING */}
      {activeTab === 'QUALITY_GRADING' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Quality Inspection & AI Grading Station</h2>
              <p className="text-xs text-neutral-500">
                Moisture meter calibration, optical grain classification, and statutory FAQ compliance certification
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bookings
              .filter((b) => ['CHECKED_IN', 'IN_QUEUE', 'PROCESSING', 'QUALITY_ASSESSED'].includes(b.status))
              .map((b) => (
                <div key={b.id} className="p-4 bg-white rounded-xl border border-neutral-200 shadow-xs space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <span className="font-mono font-bold text-neutral-900">{b.bookingReference}</span>
                    <Badge variant={b.status === 'QUALITY_ASSESSED' ? 'success' : 'warning'}>
                      {b.status}
                    </Badge>
                  </div>

                  <div>
                    <div className="font-bold text-neutral-900 text-sm">{b.farmerProfile?.fullName}</div>
                    <div className="text-neutral-500">{b.crop?.name} • {b.quantityQuintals} Quintals</div>
                  </div>

                  {b.qualityInspection ? (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1 text-[11px]">
                      <div className="flex justify-between font-bold text-emerald-950">
                        <span>Certified Grade:</span>
                        <span>{b.qualityInspection.finalGrade}</span>
                      </div>
                      <div className="flex justify-between text-neutral-600">
                        <span>Moisture Recorded:</span>
                        <span className="font-bold text-neutral-900">{b.qualityInspection.moisturePercentage}%</span>
                      </div>
                      <div className="flex justify-between text-neutral-600">
                        <span>AI Confidence:</span>
                        <span>{Math.round((b.qualityInspection.aiConfidenceScore || 0.94) * 100)}%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-neutral-50 rounded-lg text-neutral-500 text-center text-[11px]">
                      Awaiting moisture sampling and AI optical assessment.
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setInspectBooking(b)}
                      className="w-full flex items-center justify-center space-x-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{b.qualityInspection ? 'Re-Inspect / Override' : 'Conduct AI Inspection'}</span>
                    </Button>
                  </div>
                </div>
              ))}

            {bookings.filter((b) => ['CHECKED_IN', 'IN_QUEUE', 'PROCESSING', 'QUALITY_ASSESSED'].includes(b.status)).length === 0 && (
              <div className="col-span-3 py-10 text-center text-xs text-neutral-400 bg-white rounded-xl border border-neutral-200">
                No active lots currently at the gate or grading station. Check-in arriving vehicles from the &quot;Gate Queue&quot; tab.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DIGITAL WEIGHBRIDGE */}
      {activeTab === 'WEIGHBRIDGE' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Digital Weighbridge Terminal</h2>
              <p className="text-xs text-neutral-500">
                Automated gross / tare tare weighment, dry-run price calculations, and immediate procurement settlement
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bookings
              .filter((b) => ['QUALITY_ASSESSED', 'WEIGHED', 'COMPLETED'].includes(b.status))
              .map((b) => (
                <div key={b.id} className="p-4 bg-white rounded-xl border border-neutral-200 shadow-xs space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <span className="font-mono font-bold text-neutral-900">{b.bookingReference}</span>
                    <Badge variant={b.status === 'COMPLETED' ? 'success' : 'info'}>{b.status}</Badge>
                  </div>

                  <div>
                    <div className="font-bold text-neutral-900 text-sm">{b.farmerProfile?.fullName}</div>
                    <div className="text-neutral-500">{b.crop?.name} • MSP ₹{b.lockedMspRate}/Qtl</div>
                  </div>

                  {b.weighment ? (
                    <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span>Net Weight:</span>
                        <span className="font-bold text-emerald-800">{b.weighment.netWeightQuintals} Qtl</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Net Payable:</span>
                        <span className="font-bold text-neutral-900">₹{b.weighment.netPayableAmount?.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-blue-900 text-[11px] text-center font-medium">
                      Quality Certified ({b.qualityInspection?.finalGrade || 'FAQ'}). Ready for official weighment.
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setWeighBooking(b)}
                      className="w-full flex items-center justify-center space-x-1"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>{b.weighment ? 'Review Weighment' : 'Record Weighment Slip'}</span>
                    </Button>
                  </div>
                </div>
              ))}

            {bookings.filter((b) => ['QUALITY_ASSESSED', 'WEIGHED', 'COMPLETED'].includes(b.status)).length === 0 && (
              <div className="col-span-3 py-10 text-center text-xs text-neutral-400 bg-white rounded-xl border border-neutral-200">
                No lots currently ready for weighment. Certify quality inspections first.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LOGISTICS & DEPOT DISPATCH */}
      {activeTab === 'LOGISTICS_DISPATCH' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-neutral-900">FCI & CWC Central Warehouse Dispatch</h2>
              <p className="text-xs text-neutral-500">
                Commercial fleet allocation, electronic transit passes, and depot delivery confirmation
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Dispatch Ref</th>
                    <th className="p-3">Cargo Lot</th>
                    <th className="p-3">Transporter</th>
                    <th className="p-3">Vehicle & Driver</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {transports.map((t) => (
                    <tr key={t.id} className="hover:bg-neutral-50/70">
                      <td className="p-3 font-mono font-bold text-neutral-900">{t.requestReference}</td>
                      <td className="p-3 font-semibold text-neutral-800">{t.quantityQuintals} Quintals</td>
                      <td className="p-3 text-neutral-600">{t.transporter?.name || 'Assigned Transporter'}</td>
                      <td className="p-3">
                        <div className="font-mono font-bold text-neutral-900">{t.vehicle?.registrationNumber || 'Pending'}</div>
                        <div className="text-[10px] text-neutral-400">{t.driver?.name}</div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            t.status === 'DELIVERED' ? 'success' :
                            t.status === 'IN_TRANSIT' ? 'warning' : 'info'
                          }
                        >
                          {t.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {t.status === 'IN_TRANSIT' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={async () => {
                              await recordArrival(t.id);
                              await loadCenterData();
                            }}
                            className="py-1 px-2 text-xs"
                          >
                            Mark Arrived
                          </Button>
                        )}
                        {t.status === 'ARRIVED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={async () => {
                              await confirmDelivery(t.id);
                              await loadCenterData();
                            }}
                            className="py-1 px-2 text-xs bg-emerald-700"
                          >
                            Confirm Delivery
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {transports.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-neutral-400">
                        No active transport requests for this center.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: BAYS & SLOTS */}
      {activeTab === 'BAYS_SLOTS' && (
        <div className="space-y-6">
          <Card title="Unloading Bays Capacity" subtitle="Physical bays and real-time operational state">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              {bays.map((bay) => (
                <div key={bay.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-900 text-sm">Bay #{bay.bayNumber}</span>
                    <Badge variant={bay.isOperational ? 'success' : 'danger'}>
                      {bay.isOperational ? 'Operational' : 'Maintenance'}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-neutral-600">
                    <div>Capacity: <span className="font-bold text-neutral-900">{bay.capacityQuintals} Qtl</span></div>
                    <div>Vehicle: Tractor Trolleys & Trucks</div>
                  </div>
                </div>
              ))}
              {bays.length === 0 && (
                <div className="col-span-4 py-8 text-center text-xs text-neutral-400">
                  Bay configurations loading...
                </div>
              )}
            </div>
          </Card>

          <Card title="90-Minute Booking Slot Schedule" subtitle="Real-time capacity reservation window">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              {slots.map((slot) => (
                <div key={slot.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                  <div className="font-bold text-neutral-900">{slot.slotStartTime} - {slot.slotEndTime}</div>
                  <div className="text-[11px] text-neutral-600 flex justify-between">
                    <span>Available:</span>
                    <span className="font-bold text-emerald-700">{slot.availableCapacityQuintals} Qtl</span>
                  </div>
                  <div className="text-[10px] text-neutral-400">Max: {slot.maxCapacityQuintals} Qtl</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Modals */}
      {inspectBooking && (
        <InspectionModal
          isOpen={!!inspectBooking}
          onClose={() => setInspectBooking(null)}
          booking={inspectBooking}
          onInspectionCompleted={() => {
            setFeedback('Quality inspection successfully recorded & certified.');
            loadCenterData();
          }}
        />
      )}

      {weighBooking && (
        <WeighmentModal
          isOpen={!!weighBooking}
          onClose={() => setWeighBooking(null)}
          booking={weighBooking}
          onWeighmentCompleted={() => {
            setFeedback('Weighment certified and procurement settlement generated.');
            loadCenterData();
          }}
        />
      )}

      {transportBooking && (
        <TransportModal
          isOpen={!!transportBooking}
          onClose={() => setTransportBooking(null)}
          booking={transportBooking}
          onTransportUpdated={() => {
            setFeedback('Transport fleet assigned and dispatch pass generated.');
            loadCenterData();
          }}
        />
      )}

      {viewPassBooking && (
        <QRPassModal
          isOpen={!!viewPassBooking}
          onClose={() => setViewPassBooking(null)}
          booking={viewPassBooking}
        />
      )}
    </div>
  );
};
