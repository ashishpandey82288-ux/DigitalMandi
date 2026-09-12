// ==============================================================================
// KisanFlow — Frontend Transport & Logistics Service
// ==============================================================================

import { apiClient } from './apiClient.ts';

export interface TransportRequestDTO {
  id: string;
  requestReference: string;
  bookingId: string;
  procurementCenterId: string;
  transporterId?: string;
  vehicleId?: string;
  driverId?: string;
  destinationWarehouseId?: string;
  status: string;
  quantityQuintals: number;
  pickupScheduledAt?: string;
  dispatchedAt?: string;
  arrivedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  notes?: string;
  createdAt: string;
  booking?: any;
  transporter?: any;
  vehicle?: any;
  driver?: any;
}

export async function getTransportRequests(params?: {
  centerId?: string;
  bookingId?: string;
  status?: string;
}): Promise<TransportRequestDTO[]> {
  const res = await apiClient.get('/transport/requests', { params });
  return res.data.data?.requests || res.data.data || [];
}

export async function createTransportRequest(payload: {
  bookingId: string;
  procurementCenterId: string;
  destinationWarehouseId?: string;
  quantityQuintals: number;
  pickupScheduledAt?: string;
  notes?: string;
}): Promise<TransportRequestDTO> {
  const res = await apiClient.post('/transport/requests', payload);
  return res.data.data;
}

export async function assignVehicle(
  requestId: string,
  payload: {
    transporterId: string;
    vehicleId: string;
    driverId: string;
    loadingBayId?: string;
  }
): Promise<TransportRequestDTO> {
  const res = await apiClient.post(`/transport/requests/${requestId}/assign`, payload);
  return res.data.data;
}

export async function dispatchTransport(
  requestId: string,
  payload?: { dispatchGatePassNumber?: string; sealNumbers?: string[]; dispatchedQuantityQuintals?: number }
): Promise<TransportRequestDTO> {
  const res = await apiClient.post(`/transport/requests/${requestId}/dispatch`, payload || {});
  return res.data.data;
}

export async function recordArrival(requestId: string): Promise<TransportRequestDTO> {
  const res = await apiClient.post(`/transport/requests/${requestId}/arrive`, {});
  return res.data.data;
}

export async function confirmDelivery(
  requestId: string,
  payload?: { receivedQuantityQuintals?: number; recipientRemarks?: string }
): Promise<TransportRequestDTO> {
  const res = await apiClient.post(`/transport/requests/${requestId}/deliver`, payload || {});
  return res.data.data;
}

export async function getTransporters(): Promise<any[]> {
  const res = await apiClient.get('/transport/transporters');
  return res.data.data?.transporters || res.data.data || [];
}

export async function getVehicles(): Promise<any[]> {
  const res = await apiClient.get('/transport/vehicles');
  return res.data.data?.vehicles || res.data.data || [];
}

export async function getDrivers(): Promise<any[]> {
  const res = await apiClient.get('/transport/drivers');
  return res.data.data?.drivers || res.data.data || [];
}

export async function getDestinations(): Promise<any[]> {
  const res = await apiClient.get('/transport/destinations');
  return res.data.data?.destinations || res.data.data || [];
}
