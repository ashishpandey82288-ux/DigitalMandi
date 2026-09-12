// ==============================================================================
// KisanFlow — Frontend Dashboard Service
// Connects to /api/dashboard for Farmer, Center Operator & Government Admin
// ==============================================================================

import { apiClient } from './apiClient.ts';

export interface FarmerDashboardDTO {
  farmer: {
    id: string;
    fullName: string;
    phone: string;
    village: string;
    primaryDistrict: string;
    primaryState: string;
    kccNumber?: string | null;
    aadhaarZeroKnowledgeHash?: string | null;
  };
  farms: Array<{
    id: string;
    farmName: string;
    landParcelNumber: string;
    village: string;
    totalAreaAcres: number;
    verificationStatus: string;
  }>;
  registeredCrops: Array<{
    id: string;
    cropName: string;
    cropCode: string;
    season: string;
    cultivatedArea: number;
    expectedYield?: number;
    status: string;
  }>;
  stats: {
    totalBookings: number;
    activeBookings: number;
    completedBookings: number;
    totalProcuredQuintals: number;
    totalSettlementAmount: number;
    totalDisbursedPayments: number;
    pendingPayments: number;
  };
  recentBookings: any[];
  recentSettlements: any[];
  recentPayments: any[];
  activeProcurement?: any;
}

export interface CenterDashboardDTO {
  center: {
    id: string;
    centerCode: string;
    name: string;
    district: string;
    state: string;
    dailyCapacityQuintals: number;
    totalBays: number;
    isActive: boolean;
  };
  stats: {
    todayTotalBookings: number;
    checkedInCount: number;
    inQueueCount: number;
    processingCount: number;
    completedCount: number;
    cancelledCount: number;
    todayProcuredQuintals: number;
    capacityUtilizationPercentage: number;
    activeBaysCount: number;
  };
  queue: any[];
  todayBookings: any[];
  recentWeighments: any[];
  transportSummary: {
    pendingRequests: number;
    inTransit: number;
    deliveredToday: number;
  };
}

export interface AdminDashboardDTO {
  systemOverview: {
    totalFarmers: number;
    totalProcurementCenters: number;
    activeProcurementCenters: number;
    totalRegisteredFarms: number;
    totalActiveCrops: number;
  };
  procurementMetrics: {
    totalBookingsAllTime: number;
    totalCompletedProcurements: number;
    totalProcuredQuintals: number;
    totalProcuredValueRupees: number;
    todayProcuredQuintals: number;
  };
  financialMetrics: {
    totalSettlementsGenerated: number;
    totalSettlementAmountRupees: number;
    totalDisbursedPaymentsRupees: number;
    pendingDisbursementsRupees: number;
    dbtSuccessRatePercentage: number;
  };
  qualityMetrics: {
    totalInspectionsConducted: number;
    faqPassRatePercentage: number;
    averageMoistureRecorded: number;
  };
  logisticsMetrics: {
    totalTransportRequests: number;
    activeInTransitShipments: number;
    totalDeliveredShipments: number;
  };
  centerPerformance: Array<{
    centerId: string;
    centerCode: string;
    name: string;
    district: string;
    totalProcuredQuintals: number;
    utilizationPercentage: number;
  }>;
  recentActivity: any[];
}

export async function getFarmerDashboard(): Promise<FarmerDashboardDTO> {
  const res = await apiClient.get('/dashboard/farmer');
  return res.data.data;
}

export async function getCenterDashboard(centerId: string): Promise<CenterDashboardDTO> {
  const res = await apiClient.get(`/dashboard/center/${centerId}`);
  return res.data.data;
}

export async function getAdminDashboard(): Promise<AdminDashboardDTO> {
  const res = await apiClient.get('/dashboard/admin');
  return res.data.data;
}
