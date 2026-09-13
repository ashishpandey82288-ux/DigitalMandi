// ==============================================================================
// KisanFlow — Frontend Crop & MSP Service
// Fetches Crop Master Catalog, Statutory MSP Rates, and Cultivation Records
// ==============================================================================

import { apiClient } from './apiClient.ts';

export interface CropMasterDTO {
  id: string;
  name: string;
  code: string;
  category: string;
  standardMoistureLimit: number;
  isActive: boolean;
  mspRates?: Array<{
    id: string;
    ratePerQuintal: number;
    season: string;
    marketingYear: number;
    effectiveDate: string;
  }>;
  currentMSP?: {
    ratePerQuintal: number;
    season: string;
    marketingYear: number;
  };
}

export interface FarmerCropRegistrationDTO {
  id: string;
  farmerProfileId: string;
  farmId: string;
  cropId: string;
  season: string;
  cultivatedArea: number;
  areaUnit: string;
  expectedYield?: number;
  yieldUnit?: string;
  sowingDate?: string;
  status: string;
  crop?: CropMasterDTO;
  farm?: {
    id: string;
    farmName: string;
    landParcelNumber: string;
    village: string;
    district: string;
    state: string;
  };
}

export async function getCrops(): Promise<CropMasterDTO[]> {
  const res = await apiClient.get('/crops');
  return res.data.data?.crops || [];
}

export async function getCropById(cropId: string): Promise<CropMasterDTO> {
  const res = await apiClient.get(`/crops/${cropId}`);
  return res.data.data;
}

export async function getMSPRates(): Promise<any[]> {
  const res = await apiClient.get('/msp');
  return res.data.data || [];
}

export async function getFarmerCrops(): Promise<FarmerCropRegistrationDTO[]> {
  const res = await apiClient.get('/farmer/crops');
  return res.data.data || [];
}

export async function registerFarmerCrop(payload: {
  farmId: string;
  cropId: string;
  season: 'KHARIF' | 'RABI' | 'ZAID';
  cultivatedArea: number;
  expectedYield?: number;
}): Promise<FarmerCropRegistrationDTO> {
  const res = await apiClient.post('/farmer/crops', payload);
  return res.data.data;
}

export interface FarmDTO {
  id: string;
  farmName: string;
  landParcelNumber: string;
  totalAreaAcres: number;
  landAreaUnit?: string;
  village: string;
  district?: string;
  state?: string;
  irrigationType?: string;
  soilType?: string;
  verificationStatus?: string;
}

export async function getFarmerFarms(): Promise<FarmDTO[]> {
  const res = await apiClient.get('/farmer/farms');
  return res.data.data || [];
}

export async function registerFarmerFarm(payload: {
  farmName: string;
  landParcelNumber: string;
  totalAreaAcres: number;
  village: string;
  district: string;
  state: string;
  irrigationType?: string;
  soilType?: string;
}): Promise<any> {
  const res = await apiClient.post('/farmer/farms', payload);
  return res.data.data;
}
