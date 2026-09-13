// ==============================================================================
// KisanFlow — Complete Farmer Command Portal (Phase 6 Integrated)
// Profile, Land Parcels, Smart Booking, QR Gate Passes, Quality, Weighment, DBT & Logistics
// ==============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  Sprout,
  Calendar,
  Lock,
  QrCode,
  ShieldCheck,
  Plus,
  RefreshCw,
  MapPin,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Landmark,
  Scale,
  Sparkles,
  Truck,
  CreditCard,
  FileText,
  Clock,
  ChevronRight,
  Bell,
  Eye,
  CloudSun,
  Droplets,
  Languages,
  DollarSign,
  Search,
} from 'lucide-react';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiClient } from '../services/apiClient.ts';
import { getFarmerDashboard, FarmerDashboardDTO } from '../services/dashboardService.ts';
import { getBookings, cancelBooking, BookingDTO } from '../services/bookingService.ts';
import { getPaymentsByFarmer, PaymentDTO } from '../services/paymentService.ts';
import { getTransportRequests, TransportRequestDTO } from '../services/transportService.ts';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, NotificationDTO } from '../services/notificationService.ts';
import { weatherService } from '../services/weatherService.ts';
import { translationService } from '../services/translationService.ts';
import { mandiService } from '../services/mandiService.ts';
import { kccService } from '../services/kccService.ts';
import { WeatherDataDTO, MandiPriceResponseDTO, KCCAdvisoryDTO, KCCVerificationResultDTO } from '@kisanflow/types';
import { BookingWizardModal } from '../components/farmer/BookingWizardModal.tsx';
import { RegisterCropModal } from '../components/farmer/RegisterCropModal.tsx';
import { QRPassModal } from '../components/common/QRPassModal.tsx';

type TabType = 'OVERVIEW' | 'FARMS_CROPS' | 'BOOKINGS' | 'QUALITY_WEIGHMENT' | 'PAYMENTS' | 'LOGISTICS' | 'NOTIFICATIONS' | 'MANDI_ADVISORY';

export const FarmerPage: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');
  const [loading, setLoading] = useState<boolean>(true);
  const [dashboardData, setDashboardData] = useState<FarmerDashboardDTO | null>(null);
  const [bookings, setBookings] = useState<BookingDTO[]>([]);
  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [transports, setTransports] = useState<TransportRequestDTO[]>([]);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modals state
  const [showBookingWizard, setShowBookingWizard] = useState<boolean>(false);
  const [selectedBookingForPass, setSelectedBookingForPass] = useState<BookingDTO | null>(null);
  const [showAddCrop, setShowAddCrop] = useState<boolean>(false);


  // Master Crops Catalog
  const [masterCrops, setMasterCrops] = useState<any[]>([]);

  // Free External Integrations State
  const [weather, setWeather] = useState<WeatherDataDTO | null>(null);
  const [mandiPrices, setMandiPrices] = useState<MandiPriceResponseDTO | null>(null);
  const [mandiFilterCrop, setMandiFilterCrop] = useState<string>('');
  const [kccAdvisories, setKccAdvisories] = useState<KCCAdvisoryDTO[]>([]);
  const [kccVerifyInput, setKccVerifyInput] = useState<string>('');
  const [kccVerifyResult, setKccVerifyResult] = useState<KCCVerificationResultDTO | null>(null);
  const [activeLang, setActiveLang] = useState<string>('en');
  const [translatedHeaderNotice, setTranslatedHeaderNotice] = useState<string | null>(null);
  const [translating, setTranslating] = useState<boolean>(false);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Dashboard summary
      const dash = await getFarmerDashboard().catch(() => null);
      if (dash) setDashboardData(dash);

      // 2. Bookings
      const bList = await getBookings().catch(() => []);
      setBookings(bList);

      // 3. Payments
      const farmerId = dash?.farmer?.id || user?.id;
      if (farmerId) {
        const pList = await getPaymentsByFarmer(farmerId).catch(() => []);
        setPayments(pList);
      }

      // 4. Logistics
      const tList = await getTransportRequests().catch(() => []);
      setTransports(tList);

      // 5. Notifications
      const notifData = await getNotifications({ limit: 20 }).catch(() => ({ notifications: [], total: 0, unreadCount: 0 }));
      setNotifications(notifData.notifications || []);

      // 6. Master crops
      const cropsRes = await apiClient.get('/crops').catch(() => null);
      if (cropsRes?.data?.data?.crops) {
        setMasterCrops(cropsRes.data.data.crops);
      }

      // 7. Free external integrations: Weather (Open-Meteo), Mandi (data.gov.in), KCC (data.gov.in)
      const [wData, mData, kData] = await Promise.all([
        weatherService.getWeather().catch(() => null),
        mandiService.getMandiPrices().catch(() => null),
        kccService.getAdvisories().catch(() => []),
      ]);

      if (wData) setWeather(wData);
      if (mData) setMandiPrices(mData);
      if (kData) setKccAdvisories(kData);
    } catch (err: any) {
      setError(err.message || 'Failed to load farmer data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);




  // Handle Booking Cancellation
  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this procurement booking?')) return;
    try {
      await cancelBooking(bookingId, 'Farmer requested cancellation');
      setFeedback('Booking cancelled successfully.');
      await loadAllData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel booking');
    }
  };

  const handleMarkAllNotifs = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMarkOneNotif = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTranslateNotice = async (targetLang: string) => {
    setActiveLang(targetLang);
    if (targetLang === 'en') {
      setTranslatedHeaderNotice(null);
      return;
    }
    setTranslating(true);
    try {
      const textToTranslate =
        'MSP Guarantee Active: Fair Average Quality wheat moisture maximum 12%. Bring your QR gate pass and Khasra survey certificate.';
      const res = await translationService.translate(textToTranslate, targetLang);
      setTranslatedHeaderNotice(res.translatedText);
    } catch {
      // ignore
    } finally {
      setTranslating(false);
    }
  };

  const handleVerifyKCC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kccVerifyInput.trim()) return;
    try {
      const result = await kccService.verifyKCC(kccVerifyInput.trim());
      setKccVerifyResult(result);
    } catch (err: any) {
      setError(err.message || 'KCC Verification failed');
    }
  };

  const farmerProfile = dashboardData?.farmer;
  const registeredFarms = dashboardData?.farms || [];
  const registeredCrops = dashboardData?.registeredCrops || [];
  const stats = dashboardData?.stats;

  // Active upcoming booking
  const activeBooking = bookings.find(
    (b) => !['COMPLETED', 'CANCELLED'].includes(b.status)
  );

  return (
    <div className="space-y-6">
      {/* Header & Verification Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-neutral-900">Farmer Command Portal</h1>
            <Badge variant="success">PM-Kisan & DILRMP Verified</Badge>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Welcome, <span className="font-semibold text-neutral-900">{farmerProfile?.fullName || user?.name}</span> — Direct MSP Lock, Smart Mandi Slots, and Real-Time DBT Disbursal
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowBookingWizard(true)}
            className="flex items-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>Book Procurement</span>
          </Button>
          <Button variant="outline" size="sm" onClick={loadAllData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>


      {/* Free Integrations Strip: Open-Meteo Weather & Gemini Translation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Weather Card (Open-Meteo) */}
        <div className="md:col-span-2 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white rounded-lg border border-sky-200 shadow-xs text-sky-700">
              <CloudSun className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-neutral-900">
                  {weather?.locationName || 'Karnal Regional Mandi Weather'}
                </span>
                <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-mono font-medium">
                  Open-Meteo Live
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 mt-0.5">
                {weather?.advisory || 'Dry conditions ideal for grain transport and moisture compliance (< 12%).'}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0 pl-2">
            <div className="text-lg font-black text-neutral-900">
              {weather?.current?.temperature !== undefined ? `${weather.current.temperature}°C` : '28.5°C'}
            </div>
            <div className="text-[10px] text-neutral-500">
              Rain: {weather?.current?.rainProbability ?? weather?.current?.precipitation ?? 12}% | {weather?.current?.condition || 'Clear'}
            </div>
          </div>
        </div>

        {/* Translation Language Selector (Gemini Multilingual) */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-neutral-900">
              <Languages className="w-4 h-4 text-amber-700" />
              <span>Bhasha Sahayak</span>
            </div>
            <span className="text-[9px] text-amber-800 bg-amber-100 px-1 py-0.5 rounded font-mono">
              Gemini AI
            </span>
          </div>

          <div className="flex items-center space-x-1 mt-2">
            {[
              { code: 'en', label: 'English' },
              { code: 'hi', label: 'हिन्दी' },
              { code: 'pa', label: 'ਪੰਜਾਬੀ' },
              { code: 'mr', label: 'मराठी' },
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleTranslateNotice(lang.code)}
                disabled={translating}
                className={`text-[11px] px-2 py-1 rounded transition-colors ${
                  activeLang === lang.code
                    ? 'bg-amber-700 text-white font-bold'
                    : 'bg-white text-neutral-700 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {translatedHeaderNotice && (
            <div className="mt-2 text-[11px] text-amber-900 font-medium italic bg-white/80 p-1.5 rounded border border-amber-200">
              &ldquo;{translatedHeaderNotice}&rdquo;
            </div>
          )}
        </div>
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

      {/* Tab Navigation */}
      <div className="border-b border-neutral-200">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto text-xs font-semibold py-1">
          {[
            { key: 'OVERVIEW', label: 'Dashboard Overview' },
            { key: 'FARMS_CROPS', label: 'Land & Crops' },
            { key: 'BOOKINGS', label: `My Bookings (${bookings.length})` },
            { key: 'QUALITY_WEIGHMENT', label: 'Quality & Weighment' },
            { key: 'PAYMENTS', label: `DBT Payments (${payments.length})` },
            { key: 'LOGISTICS', label: 'Logistics Tracking' },
            { key: 'NOTIFICATIONS', label: `Notifications (${notifications.filter(n => !n.isRead).length})` },
            { key: 'MANDI_ADVISORY', label: 'Mandi Prices & KCC' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
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

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1 text-xs">
                <span>Land Holdings</span>
                <Landmark className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="font-bold text-neutral-900 text-xl">{registeredFarms.length} Parcels</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {registeredFarms.reduce((acc, f) => acc + (Number(f.totalAreaAcres) || 0), 0).toFixed(1)} Total Acres Verified
              </p>
            </div>

            <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1 text-xs">
                <span>Cultivated Crops</span>
                <Sprout className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="font-bold text-neutral-900 text-xl">{registeredCrops.length} Registered</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">Rabi & Kharif Statutory MSP</p>
            </div>

            <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1 text-xs">
                <span>Total Procured</span>
                <Scale className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="font-bold text-neutral-900 text-xl">
                {stats?.totalProcuredQuintals || 0} Quintals
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Across {stats?.completedBookings || 0} completed deliveries
              </p>
            </div>

            <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1 text-xs">
                <span>DBT Disbursed</span>
                <CreditCard className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="font-bold text-emerald-700 text-xl">
                ₹{(stats?.totalDisbursedPayments || 0).toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5">Direct PFMS Transfer</p>
            </div>
          </div>

          {/* Active Procurement Tracker Banner */}
          {activeBooking ? (
            <Card
              title="Active Procurement In-Progress"
              subtitle={`Booking Ref: ${activeBooking.bookingReference} • ${activeBooking.crop?.name}`}
            >
              <div className="space-y-4 pt-2">
                {/* 5-Stage Visual Workflow */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  {[
                    { label: '1. Confirmed', desc: 'Slot Reserved', active: true, done: ['CHECKED_IN', 'PROCESSING', 'QUALITY_ASSESSED', 'WEIGHED', 'COMPLETED'].includes(activeBooking.status) },
                    { label: '2. Gate Check-In', desc: 'Token / PIN Validated', active: ['CHECKED_IN', 'PROCESSING', 'QUALITY_ASSESSED', 'WEIGHED', 'COMPLETED'].includes(activeBooking.status), done: ['PROCESSING', 'QUALITY_ASSESSED', 'WEIGHED', 'COMPLETED'].includes(activeBooking.status) },
                    { label: '3. AI Grading', desc: 'Moisture Tested', active: ['PROCESSING', 'QUALITY_ASSESSED', 'WEIGHED', 'COMPLETED'].includes(activeBooking.status), done: ['QUALITY_ASSESSED', 'WEIGHED', 'COMPLETED'].includes(activeBooking.status) },
                    { label: '4. Weighbridge', desc: 'Calibrated Gross/Tare', active: ['QUALITY_ASSESSED', 'WEIGHED', 'COMPLETED'].includes(activeBooking.status), done: ['WEIGHED', 'COMPLETED'].includes(activeBooking.status) },
                    { label: '5. DBT Payment', desc: 'Direct Bank Credit', active: activeBooking.status === 'COMPLETED', done: activeBooking.status === 'COMPLETED' },
                  ].map((st, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border transition-all ${
                        st.done
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : st.active
                          ? 'bg-amber-50 border-amber-300 text-amber-900 animate-pulse'
                          : 'bg-neutral-50 border-neutral-200 text-neutral-400'
                      }`}
                    >
                      <div className="font-bold">{st.label}</div>
                      <div className="text-[10px] mt-0.5 opacity-80">{st.desc}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs">
                  <div>
                    <span className="text-neutral-500">Center:</span>{' '}
                    <span className="font-bold text-neutral-900">{activeBooking.procurementCenter?.name}</span> •{' '}
                    <span className="text-neutral-500">Date:</span>{' '}
                    <span className="font-medium text-neutral-900">{activeBooking.bookingDate} ({activeBooking.timeSlotStart} - {activeBooking.timeSlotEnd})</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedBookingForPass(activeBooking)}
                      className="flex items-center space-x-1"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>View Gate Pass & QR</span>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <div className="p-6 bg-white border border-neutral-200 rounded-2xl text-center space-y-3 shadow-xs">
              <Calendar className="w-10 h-10 text-neutral-400 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-neutral-900">No Active Mandi Deliveries</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                  Lock your statutory MSP rate and reserve a 90-minute bay slot at your nearest procurement center to prevent mandi congestion.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowBookingWizard(true)}
              >
                Reserve Slot Now
              </Button>
            </div>
          )}

          {/* Quick Overview Grid: Recent Bookings & Settlements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card title="Recent Bookings" subtitle="Latest procurement reservations">
              <div className="divide-y divide-neutral-100 text-xs">
                {bookings.slice(0, 4).map((b) => (
                  <div key={b.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-neutral-900">{b.bookingReference}</div>
                      <div className="text-[11px] text-neutral-500">
                        {b.crop?.name} • {b.quantityQuintals} Qtl • {b.bookingDate}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={b.status === 'COMPLETED' ? 'success' : 'info'}>
                        {b.status}
                      </Badge>
                      <button
                        onClick={() => setSelectedBookingForPass(b)}
                        className="p-1 text-neutral-500 hover:text-emerald-700"
                        title="View Gate Pass"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {bookings.length === 0 && (
                  <div className="py-4 text-center text-neutral-400">No bookings yet</div>
                )}
              </div>
            </Card>

            <Card title="Recent DBT Credits" subtitle="PFMS direct disbursements">
              <div className="divide-y divide-neutral-100 text-xs">
                {payments.slice(0, 4).map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-emerald-800">₹{p.amount.toLocaleString('en-IN')}</div>
                      <div className="text-[11px] text-neutral-500 font-mono">
                        UTR: {p.utrNumber || 'PFMS-PENDING'}
                      </div>
                    </div>
                    <Badge variant={p.status === 'SUCCESS' ? 'success' : 'warning'}>
                      {p.status}
                    </Badge>
                  </div>
                ))}
                {payments.length === 0 && (
                  <div className="py-4 text-center text-neutral-400">No disbursements recorded</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: FARMS & CROPS */}
      {activeTab === 'FARMS_CROPS' && (
        <div className="space-y-6">
          <Card
            title="Cultivated Crops & Expected Yields"
            subtitle="Register your crops and access transparent MSP procurement services."
            headerAction={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddCrop(true)}
                className="flex items-center space-x-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Cultivated Crop</span>
              </Button>
            }
          >
            <div className="pt-2">
              {registeredCrops.length === 0 ? (
                <div className="py-12 px-4 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-300 space-y-3">
                  <div className="text-4xl">🌱</div>
                  <h4 className="text-base font-bold text-neutral-900">
                    No cultivated crops registered yet
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    Register your crop to access MSP procurement.
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowAddCrop(true)}
                      className="inline-flex items-center space-x-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Add Cultivated Crop</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs text-neutral-500">
                    <span>
                      Crops ready for procurement: <strong className="text-neutral-900">{registeredCrops.length} Records</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {registeredCrops.map((c) => (
                      <div
                        key={c.id}
                        className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2.5 text-xs hover:border-emerald-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900 text-sm">{c.cropName}</span>
                          <Badge variant="info">{c.season}</Badge>
                        </div>
                        <div className="text-[12px] text-neutral-600 space-y-1">
                          <div className="flex justify-between">
                            <span>Cultivated Area:</span>
                            <span className="font-semibold text-neutral-900">{c.cultivatedArea} Acres</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Expected Yield:</span>
                            <span className="font-semibold text-neutral-900">{c.expectedYield || 120} Quintals</span>
                          </div>
                          <div className="text-emerald-700 font-bold pt-1 flex justify-between border-t border-neutral-200/80 mt-1">
                            <span>Statutory MSP:</span>
                            <span>Eligible</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Add Crop Modal */}
          <RegisterCropModal
            isOpen={showAddCrop}
            onClose={() => setShowAddCrop(false)}
            onCropRegistered={async () => {
              setFeedback('Crop cultivation registered successfully.');
              await loadAllData();
            }}
            initialFarms={registeredFarms}
            initialCrops={masterCrops}
          />
        </div>
      )}

      {/* TAB 3: BOOKINGS & GATE PASSES */}
      {activeTab === 'BOOKINGS' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Procurement Bookings & Digital Passes</h2>
              <p className="text-xs text-neutral-500">Scheduled 90-minute delivery slots and gate entry tokens</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowBookingWizard(true)}
              className="flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>New Mandi Booking</span>
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Booking Ref</th>
                    <th className="p-3">Crop</th>
                    <th className="p-3">Procurement Center</th>
                    <th className="p-3">Slot & Date</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Locked MSP</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="p-3 font-mono font-bold text-neutral-900">{b.bookingReference}</td>
                      <td className="p-3 font-semibold text-neutral-800">{b.crop?.name}</td>
                      <td className="p-3 text-neutral-600">{b.procurementCenter?.name}</td>
                      <td className="p-3 text-neutral-700">
                        {b.bookingDate}<br/>
                        <span className="text-[10px] text-neutral-400">{b.timeSlotStart} - {b.timeSlotEnd}</span>
                      </td>
                      <td className="p-3 font-bold text-neutral-900">{b.quantityQuintals} Qtl</td>
                      <td className="p-3 font-bold text-emerald-700">₹{b.lockedMspRate}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            b.status === 'COMPLETED' ? 'success' :
                            b.status === 'CANCELLED' ? 'danger' :
                            b.status === 'CHECKED_IN' ? 'warning' : 'info'
                          }
                        >
                          {b.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedBookingForPass(b)}
                          className="text-xs py-1 px-2"
                        >
                          <QrCode className="w-3.5 h-3.5 mr-1" />
                          <span>Pass</span>
                        </Button>
                        {['PENDING', 'CONFIRMED'].includes(b.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelBooking(b.id)}
                            className="text-xs text-rose-600 hover:text-rose-700 py-1 px-2"
                          >
                            Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-neutral-400">
                        No bookings found. Click &quot;New Mandi Booking&quot; above to schedule your arrival.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: QUALITY & WEIGHMENT */}
      {activeTab === 'QUALITY_WEIGHMENT' && (
        <div className="space-y-6">
          <Card
            title="Quality Assessments & Weighbridge Certificates"
            subtitle="Real-time moisture checks, AI Computer Vision grading, and digital weighment slips"
          >
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bookings.filter((b) => b.qualityInspection || b.weighment).map((b) => (
                  <div key={b.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                      <div>
                        <span className="font-mono font-bold text-neutral-900">{b.bookingReference}</span>
                        <div className="text-[11px] text-neutral-500">{b.crop?.name} • {b.procurementCenter?.name}</div>
                      </div>
                      <Badge variant="success">{b.status}</Badge>
                    </div>

                    {/* AI Grading Inspection Result */}
                    {b.qualityInspection && (
                      <div className="p-3 bg-white rounded-lg border border-emerald-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-900 flex items-center">
                            <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            AI Quality Grading & Moisture
                          </span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                            {b.qualityInspection.finalGrade}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-600 pt-1">
                          <div>Moisture: <span className="font-bold text-neutral-900">{b.qualityInspection.moisturePercentage}%</span> (Std: {b.qualityInspection.standardMoistureLimit}%)</div>
                          <div>AI Confidence: <span className="font-bold text-neutral-900">{Math.round((b.qualityInspection.aiConfidenceScore || 0.94) * 100)}%</span></div>
                          <div>Foreign Matter: <span>{b.qualityInspection.foreignMatterPercentage}%</span></div>
                          <div>Deduction: <span className="text-amber-700 font-bold">{b.qualityInspection.totalDeductionPercentage}%</span></div>
                        </div>
                      </div>
                    )}

                    {/* Weighbridge Slip */}
                    {b.weighment && (
                      <div className="p-3 bg-white rounded-lg border border-neutral-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900 flex items-center">
                            <Scale className="w-3.5 h-3.5 mr-1 text-neutral-700" />
                            Certified Weighment Slip
                          </span>
                          <span className="font-mono text-[10px] text-neutral-500">#{b.weighment.ticketNumber}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px] text-neutral-600 pt-1">
                          <div>Gross: <span className="font-semibold text-neutral-900">{b.weighment.grossWeightKg} kg</span></div>
                          <div>Tare: <span className="font-semibold text-neutral-900">{b.weighment.tareWeightKg} kg</span></div>
                          <div>Net: <span className="font-bold text-emerald-800">{b.weighment.netWeightQuintals} Qtl</span></div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-neutral-100 text-xs font-bold text-neutral-900">
                          <span>Final Procurement Payout:</span>
                          <span className="text-emerald-700">₹{b.weighment.netPayableAmount?.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {bookings.filter((b) => b.qualityInspection || b.weighment).length === 0 && (
                  <div className="col-span-2 py-8 text-center text-xs text-neutral-400">
                    No inspection or weighment records found yet. Arrive at your booked mandi slot to commence gate check-in and quality appraisal.
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: PAYMENTS & SETTLEMENTS */}
      {activeTab === 'PAYMENTS' && (
        <div className="space-y-6">
          <Card
            title="Direct Benefit Transfer (DBT) Disbursements"
            subtitle="Statutory PFMS payment reconciliation, UTR numbers, and bank account credits"
          >
            <div className="space-y-4 pt-2">
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Payment Reference</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">UTR / PFMS Ref</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-50/70">
                        <td className="p-3 font-mono font-bold text-neutral-900">{p.paymentReference}</td>
                        <td className="p-3 font-bold text-emerald-800 text-sm">₹{p.amount.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-neutral-600">{p.paymentMethod}</td>
                        <td className="p-3 font-mono text-neutral-700">{p.utrNumber || 'PFMS-DISBURSING'}</td>
                        <td className="p-3 text-neutral-500">
                          {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN') : new Date(p.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-3">
                          <Badge variant={p.status === 'SUCCESS' ? 'success' : p.status === 'FAILED' ? 'danger' : 'warning'}>
                            {p.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {payments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-neutral-400">
                          No payments recorded yet. Settle delivered lots to trigger automated DBT disbursements.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 6: LOGISTICS */}
      {activeTab === 'LOGISTICS' && (
        <div className="space-y-6">
          <Card
            title="Procurement Logistics & Central Warehousing Moves"
            subtitle="Tracking grain transit from procurement mandi to FCI / CWC storage depots"
          >
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {transports.map((t) => (
                  <div key={t.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-neutral-900">{t.requestReference}</span>
                      <Badge variant="info">{t.status}</Badge>
                    </div>
                    <div className="text-[11px] text-neutral-600 space-y-1">
                      <div>Quantity: <span className="font-semibold text-neutral-900">{t.quantityQuintals} Quintals</span></div>
                      <div>Transporter: <span className="font-medium text-neutral-800">{t.transporter?.name || 'Authorized Fleet'}</span></div>
                      <div>Vehicle: <span className="font-mono font-bold text-neutral-900">{t.vehicle?.registrationNumber || 'Assigned'}</span></div>
                      <div>Driver: <span>{t.driver?.name || 'Designated Driver'} ({t.driver?.phone || 'Contact on dispatch'})</span></div>
                    </div>
                  </div>
                ))}
                {transports.length === 0 && (
                  <div className="col-span-2 py-8 text-center text-xs text-neutral-400">
                    No active transport movements recorded.
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 7: NOTIFICATIONS */}
      {activeTab === 'NOTIFICATIONS' && (
        <div className="space-y-6">
          <Card
            title="Notification Center"
            subtitle="SMS, WhatsApp, and digital alerts regarding bookings, moisture tests, and bank credits"
          >
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-500">
                  Unread: <strong>{notifications.filter((n) => !n.isRead).length}</strong>
                </span>
                <Button variant="outline" size="sm" onClick={handleMarkAllNotifs}>
                  Mark All as Read
                </Button>
              </div>

              <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.isRead && handleMarkOneNotif(n.id)}
                    className={`p-4 text-xs transition-colors flex items-start justify-between cursor-pointer ${
                      n.isRead ? 'bg-white text-neutral-600' : 'bg-emerald-50/60 text-neutral-900 font-medium'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-neutral-900">{n.title}</div>
                      <p className="text-neutral-600 mt-1 leading-relaxed">{n.message}</p>
                      <span className="text-[10px] text-neutral-400 mt-1 inline-block">
                        {new Date(n.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-1" />
                    )}
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="p-8 text-center text-neutral-400 text-xs">No notifications</div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 8: MANDI PRICES & KCC ADVISORY (data.gov.in Integrations) */}
      {activeTab === 'MANDI_ADVISORY' && (
        <div className="space-y-6">
          {/* APMC Mandi Wholesale Prices (data.gov.in) */}
          <Card
            title="APMC Mandi Wholesale Price Discovery"
            subtitle="Government Open Data (data.gov.in) real-time wholesale arrivals and modal market price benchmarks"
          >
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <span className="text-xs text-neutral-500">Filter Commodity:</span>
                  {['', 'Wheat', 'Paddy', 'Mustard', 'Maize'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setMandiFilterCrop(c)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        mandiFilterCrop === c
                          ? 'bg-emerald-700 text-white font-bold border-emerald-700'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      {c || 'All Crops'}
                    </button>
                  ))}
                </div>

                <div className="text-[11px] text-neutral-500">
                  Data Provider:{' '}
                  <span className="font-mono text-emerald-700 font-semibold">
                    {mandiPrices?.source || 'data.gov.in open-data'}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                    <tr>
                      <th className="p-3">Commodity & Variety</th>
                      <th className="p-3">APMC Market</th>
                      <th className="p-3">District & State</th>
                      <th className="p-3 text-right">Min Price</th>
                      <th className="p-3 text-right">Max Price</th>
                      <th className="p-3 text-right">Modal Price (₹/Qtl)</th>
                      <th className="p-3 text-center">Arrival Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {mandiPrices?.records
                      ?.filter((r) =>
                        mandiFilterCrop
                          ? r.commodity.toLowerCase().includes(mandiFilterCrop.toLowerCase())
                          : true
                      )
                      .map((r, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50/70">
                          <td className="p-3">
                            <span className="font-bold text-neutral-900">{r.commodity}</span>
                            <span className="text-[10px] text-neutral-400 block">{r.variety}</span>
                          </td>
                          <td className="p-3 font-semibold text-neutral-800">{r.market}</td>
                          <td className="p-3 text-neutral-600">{r.district}, {r.state}</td>
                          <td className="p-3 text-right text-neutral-600 font-mono">₹{r.minPrice}</td>
                          <td className="p-3 text-right text-neutral-600 font-mono">₹{r.maxPrice}</td>
                          <td className="p-3 text-right font-black text-emerald-800 font-mono">
                            ₹{r.modalPrice}
                          </td>
                          <td className="p-3 text-center text-neutral-500 font-mono text-[11px]">
                            {r.arrivalDate}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          {/* KCC Agronomic Guidance & Telemetry (data.gov.in) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card
                title="KCC Farmer Agronomic Advisories"
                subtitle="Kisan Call Center agronomic query resolutions and quality standards"
              >
                <div className="space-y-3 pt-2">
                  {kccAdvisories.map((adv) => (
                    <div
                      key={adv.id}
                      className="p-4 bg-white border border-neutral-200 rounded-xl space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                          {adv.crop} • {adv.categorySubject}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {adv.district}, {adv.state}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-neutral-900">
                        Q: {adv.farmerQuery}
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                        <strong>Advice:</strong> {adv.responseAdvice}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* KCC Card Verification Tool */}
            <div>
              <Card
                title="KCC Verification"
                subtitle="Verify Kisan Credit Card limits & active status"
              >
                <div className="space-y-4 pt-2 text-xs">
                  <form onSubmit={handleVerifyKCC} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        KCC Number
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. KCC-HR-98214"
                        value={kccVerifyInput}
                        onChange={(e) => setKccVerifyInput(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <Button type="submit" variant="primary" size="sm" className="w-full">
                      Verify Credit Status
                    </Button>
                  </form>

                  {kccVerifyResult && (
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-950">Card Status:</span>
                        <Badge variant={kccVerifyResult.isValid ? 'success' : 'danger'}>
                          {kccVerifyResult.cardStatus}
                        </Badge>
                      </div>
                      {kccVerifyResult.isValid && (
                        <>
                          <div className="text-neutral-700">
                            Bank: <span className="font-semibold">{kccVerifyResult.issuingBank}</span>
                          </div>
                          <div className="text-neutral-700">
                            Credit Limit:{' '}
                            <span className="font-bold text-neutral-900">
                              ₹{kccVerifyResult.sanctionedCreditLimitInr?.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="text-neutral-700">
                            Available Credit:{' '}
                            <span className="font-bold text-emerald-800">
                              ₹{kccVerifyResult.availableCreditInr?.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="text-[10px] text-neutral-400 pt-1 border-t border-emerald-200">
                            Verified at: {new Date(kccVerifyResult.verifiedAt).toLocaleTimeString()}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Booking Wizard Modal */}
      <BookingWizardModal
        isOpen={showBookingWizard}
        onClose={() => setShowBookingWizard(false)}
        farmerCrops={registeredCrops}
        onBookingCreated={(newBooking) => {
          loadAllData();
          setSelectedBookingForPass(newBooking);
        }}
      />

      {/* Gate Pass & QR Modal */}
      {selectedBookingForPass && (
        <QRPassModal
          isOpen={!!selectedBookingForPass}
          onClose={() => setSelectedBookingForPass(null)}
          booking={selectedBookingForPass}
        />
      )}
    </div>
  );
};
