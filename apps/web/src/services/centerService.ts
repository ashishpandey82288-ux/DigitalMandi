// ==============================================================================
// KisanFlow — Frontend Procurement Center Service
// Fetches Centers, Bays, and 90-minute Slots
// ==============================================================================

import { apiClient } from './apiClient.ts';

export interface ProcurementCenterDTO {
  id: string;
  centerCode: string;
  name: string;
  address: string;
  village: string;
  district: string;
  state: string;
  pincode: string;
  dailyCapacityQuintals: number;
  totalBays: number;
  isActive: boolean;
  latitude?: number;
  longitude?: number;
}

export interface BookingSlotDTO {
  id: string;
  procurementCenterId: string;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  durationMinutes: number;
  maxCapacityQuintals: number;
  bookedCapacityQuintals: number;
  availableCapacityQuintals: number;
  status: string;
}

export async function getCenters(): Promise<ProcurementCenterDTO[]> {
  const res = await apiClient.get('/centers');
  return res.data.data?.centers || res.data.data || [];
}

export async function getCenterById(centerId: string): Promise<ProcurementCenterDTO> {
  const res = await apiClient.get(`/centers/${centerId}`);
  return res.data.data;
}

export async function getCenterBays(centerId: string): Promise<any[]> {
  const res = await apiClient.get(`/centers/${centerId}/bays`);
  return res.data.data?.bays || res.data.data || [];
}

export async function getCenterSlots(centerId: string, date?: string): Promise<BookingSlotDTO[]> {
  const res = await apiClient.get(`/centers/${centerId}/slots`, {
    params: { date },
  });
  return res.data.data?.slots || res.data.data || [];
}
