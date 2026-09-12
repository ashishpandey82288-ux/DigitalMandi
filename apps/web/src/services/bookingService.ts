// ==============================================================================
// KisanFlow — Frontend Booking Service
// Handles Smart Procurement Booking, Slot Capacities, and Token Passes
// ==============================================================================

import { apiClient } from './apiClient.ts';

export interface CreateBookingPayload {
  farmerCropId: string;
  procurementCenterId: string;
  bookingSlotId: string;
  bookingDate: string; // YYYY-MM-DD
  quantityQuintals: number;
  vehicleType?: 'TRACTOR_TROLLEY' | 'SMALL_TRUCK' | 'LARGE_TRUCK' | 'OTHER';
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
}

export interface BookingDTO {
  id: string;
  bookingReference: string;
  farmerProfileId: string;
  procurementCenterId: string;
  cropId: string;
  farmerCropId: string;
  bookingSlotId: string;
  bookingDate: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  quantityQuintals: number;
  lockedMspRate: number;
  status: string;
  tokenNumber?: number;
  gatePassPin?: string;
  qrSignature?: string;
  createdAt: string;
  crop?: {
    id: string;
    name: string;
    code: string;
    standardMoistureLimit: number;
  };
  procurementCenter?: {
    id: string;
    centerCode: string;
    name: string;
    district: string;
    state: string;
  };
  farmerProfile?: {
    id: string;
    fullName: string;
    phone: string;
    village: string;
    primaryDistrict: string;
  };
  qualityInspection?: any;
  weighment?: any;
  settlement?: any;
}

export interface GatePassDTO {
  bookingReference: string;
  tokenNumber: number;
  gatePassPin: string;
  qrSignature: string;
  farmerName: string;
  centerName: string;
  centerCode: string;
  cropName: string;
  bookingDate: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  quantityQuintals: number;
  lockedMspRate: number;
  status: string;
}

export async function getBookings(params?: {
  status?: string;
  centerId?: string;
  date?: string;
  limit?: number;
}): Promise<BookingDTO[]> {
  const res = await apiClient.get('/bookings', { params });
  return res.data.data?.bookings || res.data.data || [];
}

export async function getBookingById(bookingId: string): Promise<BookingDTO> {
  const res = await apiClient.get(`/bookings/${bookingId}`);
  return res.data.data;
}

export async function createBooking(payload: CreateBookingPayload): Promise<BookingDTO> {
  const res = await apiClient.post('/bookings', payload);
  return res.data.data;
}

export async function updateBooking(bookingId: string, payload: any): Promise<BookingDTO> {
  const res = await apiClient.patch(`/bookings/${bookingId}`, payload);
  return res.data.data;
}

export async function cancelBooking(bookingId: string, reason?: string): Promise<BookingDTO> {
  const res = await apiClient.post(`/bookings/${bookingId}/cancel`, { cancellationReason: reason || 'Cancelled by user' });
  return res.data.data;
}

export async function getBookingToken(bookingId: string): Promise<GatePassDTO> {
  const res = await apiClient.get(`/bookings/${bookingId}/token`);
  return res.data.data;
}

export async function getBookingMsp(bookingId: string): Promise<any> {
  const res = await apiClient.get(`/bookings/${bookingId}/msp`);
  return res.data.data;
}
