// ==============================================================================
// KisanFlow — Resilient File-Backed Memory Store for Multi-Process Sync
// Synchronizes state between the Express server process and CLI test processes
// ==============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Prisma,
  UserRole,
  CropSeason,
  FarmerCropStatus,
  LandAreaUnit,
  OwnershipType,
  FarmVerificationStatus,
  BayStatus,
  BookingStatus,
  CropQualityGrade,
  SettlementStatus,
  PaymentStatus,
} from '@prisma/client';
import {
  QualityInspectionStatus,
  DeductionType,
  TransportStatus,
  VehicleVerificationStatus,
  VehicleType,
  DestinationType,
} from '@kisanflow/types';

export interface MemoryUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  operatorCenterId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryFarmerProfile {
  id: string;
  userId: string;
  fullName: string | null;
  alternatePhone: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  address: string | null;
  village: string | null;
  aadhaarHash: string | null;
  kisanCreditCard: string | null;
  pmKisanId: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  primaryDistrict: string;
  primaryState: string;
  pincode: string;
  preferredLanguage: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryFarm {
  id: string;
  farmerProfileId: string;
  farmName: string | null;
  landParcelNumber: string;
  district: string;
  state: string;
  village: string;
  totalAreaAcres: Prisma.Decimal;
  landAreaUnit: LandAreaUnit;
  ownershipType: OwnershipType;
  verifiedArea: Prisma.Decimal | null;
  isLandVerified: boolean;
  verificationStatus: FarmVerificationStatus;
  soilType: string | null;
  irrigationType: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryCrop {
  id: string;
  name: string;
  code: string;
  category: string;
  standardMoistureLimit: Prisma.Decimal;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryMSPRate {
  id: string;
  cropId: string;
  season: CropSeason;
  marketingYear: number;
  ratePerQuintal: Prisma.Decimal;
  effectiveDate: Date;
  expiryDate: Date;
  sourceReference: string;
  bonusPerQuintal: Prisma.Decimal;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryFarmerCrop {
  id: string;
  farmerProfileId: string;
  farmId: string;
  cropId: string;
  season: CropSeason;
  sowingDate: Date | null;
  expectedHarvestDate: Date | null;
  cultivatedArea: Prisma.Decimal;
  areaUnit: LandAreaUnit;
  expectedYield: Prisma.Decimal | null;
  yieldUnit: string;
  status: FarmerCropStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryProcurementCenter {
  id: string;
  code: string;
  name: string;
  locationAddress: string;
  district: string;
  state: string;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  dailyCapacityQuintals: Prisma.Decimal;
  slotDurationMinutes: number;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  supportedCropIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryCenterBay {
  id: string;
  procurementCenterId: string;
  bayNumber: number;
  name: string;
  capacityQuintals: Prisma.Decimal;
  status: BayStatus;
  isActive: boolean;
  supportedCropIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryBookingSlot {
  id: string;
  procurementCenterId: string;
  centerBayId: string | null;
  slotDate: Date;
  startTime: Date;
  endTime: Date;
  maxCapacityQuintals: Prisma.Decimal;
  bookedCapacityQuintals: Prisma.Decimal;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryBooking {
  id: string;
  bookingNumber: string;
  bookingReference: string;
  farmerProfileId: string;
  farmId: string;
  cropId: string;
  procurementCenterId: string;
  centerBayId: string | null;
  bookingSlotId: string;
  bookingDate: Date;
  estimatedQuantityQuintals: Prisma.Decimal;
  quantityUnit: string;

  lockedMspRateId: string;
  lockedRatePerQuintal: Prisma.Decimal;
  mspMarketingYear: number;
  mspSeason: CropSeason;
  mspRateReference: string;
  mspLockedAt: Date;
  mspLockExpiresAt: Date | null;

  tokenNumber: string;
  securePin: string;
  qrCodeSignature: string;
  status: BookingStatus;
  cancellationReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryQualityInspection {
  id: string;
  bookingId: string;
  farmerProfileId: string;
  cropId: string;
  procurementCenterId: string;
  inspectorId: string | null;
  sampleReference: string;
  inspectionTimestamp: Date;
  status: QualityInspectionStatus;
  moisturePercentage: Prisma.Decimal;
  standardMoistureLimit: Prisma.Decimal;
  isMoisturePass: boolean;
  excessMoisturePercentage: Prisma.Decimal;
  foreignMatterPercentage: Prisma.Decimal | null;
  damagedGrainsPercentage: Prisma.Decimal | null;
  brokenGrainsPercentage: Prisma.Decimal | null;
  otherQualityParameters: Record<string, unknown>;
  aiModelVersion: string;
  aiConfidenceScore: Prisma.Decimal;
  aiInferenceStatus: string;
  aiPredictedGrade: CropQualityGrade;
  finalGrade: CropQualityGrade;
  isHumanVerified: boolean;
  verifiedByUserId: string | null;
  verifiedAt: Date | null;
  reviewRemarks: string | null;
  deductionType: DeductionType;
  deductionPercentage: Prisma.Decimal;
  deductionAmountPerQuintal: Prisma.Decimal;
  lockedMspRate: Prisma.Decimal;
  effectiveRatePerQuintal: Prisma.Decimal;
  remarks: string | null;
  evidenceImageUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryWeighment {
  id: string;
  bookingId: string;
  cropGradingId: string | null;
  procurementCenterId: string;
  weighingOperatorId: string;
  grossWeightQuintals: Prisma.Decimal;
  tareWeightQuintals: Prisma.Decimal;
  netWeightQuintals: Prisma.Decimal;
  quantityUnit: string;
  scaleDeviceId: string;
  verificationStatus: string;
  weighedAt: Date;
  lockedMspRate: Prisma.Decimal;
  qualityGrade: CropQualityGrade;
  deductionType: DeductionType;
  deductionValue: Prisma.Decimal;
  effectiveRatePerQuintal: Prisma.Decimal;
  finalPayableAmount: Prisma.Decimal;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemorySettlement {
  id: string;
  settlementReference: string;
  bookingId: string;
  farmerProfileId: string;
  cropId: string;
  lockedMspReference: string | null;
  qualityInspectionId: string | null;
  weighmentId: string | null;
  grossAmount: Prisma.Decimal;
  deductions: Prisma.Decimal;
  netPayableAmount: Prisma.Decimal;
  currency: string;
  status: SettlementStatus;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryPayment {
  id: string;
  paymentReference: string;
  settlementId: string;
  farmerProfileId: string;
  procurementTransactionId: string | null;
  amountInr: Prisma.Decimal;
  currency: string;
  paymentMode: string;
  bankAccountNumber: string | null;
  ifscCode: string | null;
  utrNumber: string | null;
  providerTransactionId: string | null;
  idempotencyKey: string | null;
  status: PaymentStatus;
  isSimulated: boolean;
  failureReason: string | null;
  initiatedAt: Date;
  processedAt: Date | null;
  disbursedAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryTransporter {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  registrationNumber: string | null;
  isActive: boolean;
  verificationStatus: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryVehicle {
  id: string;
  registrationNumber: string;
  transporterId: string | null;
  vehicleType: string;
  capacityQuintals: Prisma.Decimal;
  capacityUnit: string;
  isActive: boolean;
  verificationStatus: VehicleVerificationStatus;
  currentLocation: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryDriver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string | null;
  transporterId: string | null;
  isActive: boolean;
  verificationStatus: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryTransportDestination {
  id: string;
  code: string;
  name: string;
  destinationType: DestinationType;
  address: string;
  district: string;
  state: string;
  pincode: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  capacityQuintals: Prisma.Decimal | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryTransportRequest {
  id: string;
  requestReference: string;
  bookingId: string;
  procurementCenterId: string;
  cropId: string;
  quantityQuintals: Prisma.Decimal;
  quantityUnit: string;
  destinationType: string;
  destinationName: string;
  destinationAddress: string;
  destinationDistrict: string | null;
  destinationState: string | null;
  requestedDate: Date;
  requiredCapacityQuintals: Prisma.Decimal;
  status: TransportStatus;
  vehicleId: string | null;
  transporterId: string | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  assignedAt: Date | null;
  dispatchedAt: Date | null;
  arrivedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  deliveryReceiverName: string | null;
  deliveryReceiverDesignation: string | null;
  deliveryRemarks: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryTransportLoad {
  id: string;
  loadReference: string;
  transportRequestId: string;
  bookingId: string;
  vehicleId: string;
  sourceCenterId: string;
  destinationName: string;
  cropId: string;
  quantityQuintals: Prisma.Decimal;
  quantityUnit: string;
  loadingStartedAt: Date | null;
  loadedAt: Date | null;
  dispatchedAt: Date | null;
  arrivedAt: Date | null;
  deliveredAt: Date | null;
  status: TransportStatus;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryAuditEvent {
  id: string;
  sequenceNumber: number;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
  previousHash: string;
  currentHash: string;
}

export interface MemoryNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  channel: string;
  isRead: boolean;
  sentStatus: string;
  entityType: string | null;
  entityId: string | null;
  reference: string | null;
  metadata: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const STORE_PATH = path.resolve('/tmp/kisanflow_store.json');

export class PrismaMemoryStore {
  public users: MemoryUser[] = [];
  public farmerProfiles: MemoryFarmerProfile[] = [];
  public farms: MemoryFarm[] = [];
  public crops: MemoryCrop[] = [];
  public mspRates: MemoryMSPRate[] = [];
  public farmerCrops: MemoryFarmerCrop[] = [];
  public procurementCenters: MemoryProcurementCenter[] = [];
  public centerBays: MemoryCenterBay[] = [];
  public bookingSlots: MemoryBookingSlot[] = [];
  public bookings: MemoryBooking[] = [];
  public qualityInspections: MemoryQualityInspection[] = [];
  public weighments: MemoryWeighment[] = [];
  public settlements: MemorySettlement[] = [];
  public payments: MemoryPayment[] = [];
  public transporters: MemoryTransporter[] = [];
  public vehicles: MemoryVehicle[] = [];
  public drivers: MemoryDriver[] = [];
  public transportDestinations: MemoryTransportDestination[] = [];
  public transportRequests: MemoryTransportRequest[] = [];
  public transportLoads: MemoryTransportLoad[] = [];
  public auditEvents: MemoryAuditEvent[] = [];
  public notifications: MemoryNotification[] = [];

  constructor() {
    this.loadFromDisk();
  }

  public saveToDisk(): void {
    try {
      const data = {
        users: this.users,
        farmerProfiles: this.farmerProfiles,
        farms: this.farms.map((f) => ({
          ...f,
          totalAreaAcres: f.totalAreaAcres ? f.totalAreaAcres.toString() : '0',
          verifiedArea: f.verifiedArea ? f.verifiedArea.toString() : null,
          latitude: f.latitude ? f.latitude.toString() : null,
          longitude: f.longitude ? f.longitude.toString() : null,
        })),
        crops: this.crops.map((c) => ({
          ...c,
          standardMoistureLimit: c.standardMoistureLimit ? c.standardMoistureLimit.toString() : '0',
        })),
        mspRates: this.mspRates.map((m) => ({
          ...m,
          ratePerQuintal: m.ratePerQuintal ? m.ratePerQuintal.toString() : '0',
          bonusPerQuintal: m.bonusPerQuintal ? m.bonusPerQuintal.toString() : '0',
        })),
        farmerCrops: this.farmerCrops.map((fc) => ({
          ...fc,
          cultivatedArea: fc.cultivatedArea ? fc.cultivatedArea.toString() : '0',
          expectedYield: fc.expectedYield ? fc.expectedYield.toString() : null,
        })),
        procurementCenters: this.procurementCenters.map((pc) => ({
          ...pc,
          latitude: pc.latitude ? pc.latitude.toString() : null,
          longitude: pc.longitude ? pc.longitude.toString() : null,
          dailyCapacityQuintals: pc.dailyCapacityQuintals ? pc.dailyCapacityQuintals.toString() : '0',
        })),
        centerBays: this.centerBays.map((cb) => ({
          ...cb,
          capacityQuintals: cb.capacityQuintals ? cb.capacityQuintals.toString() : '0',
        })),
        bookingSlots: this.bookingSlots.map((bs) => ({
          ...bs,
          maxCapacityQuintals: bs.maxCapacityQuintals ? bs.maxCapacityQuintals.toString() : '0',
          bookedCapacityQuintals: bs.bookedCapacityQuintals ? bs.bookedCapacityQuintals.toString() : '0',
        })),
        bookings: this.bookings.map((b) => ({
          ...b,
          estimatedQuantityQuintals: b.estimatedQuantityQuintals ? b.estimatedQuantityQuintals.toString() : '0',
          lockedRatePerQuintal: b.lockedRatePerQuintal ? b.lockedRatePerQuintal.toString() : '0',
        })),
        qualityInspections: this.qualityInspections.map((qi) => ({
          ...qi,
          moisturePercentage: qi.moisturePercentage ? qi.moisturePercentage.toString() : '0',
          standardMoistureLimit: qi.standardMoistureLimit ? qi.standardMoistureLimit.toString() : '0',
          excessMoisturePercentage: qi.excessMoisturePercentage ? qi.excessMoisturePercentage.toString() : '0',
          foreignMatterPercentage: qi.foreignMatterPercentage ? qi.foreignMatterPercentage.toString() : null,
          damagedGrainsPercentage: qi.damagedGrainsPercentage ? qi.damagedGrainsPercentage.toString() : null,
          brokenGrainsPercentage: qi.brokenGrainsPercentage ? qi.brokenGrainsPercentage.toString() : null,
          aiConfidenceScore: qi.aiConfidenceScore ? qi.aiConfidenceScore.toString() : '0',
          deductionPercentage: qi.deductionPercentage ? qi.deductionPercentage.toString() : '0',
          deductionAmountPerQuintal: qi.deductionAmountPerQuintal ? qi.deductionAmountPerQuintal.toString() : '0',
          lockedMspRate: qi.lockedMspRate ? qi.lockedMspRate.toString() : '0',
          effectiveRatePerQuintal: qi.effectiveRatePerQuintal ? qi.effectiveRatePerQuintal.toString() : '0',
        })),
        weighments: this.weighments.map((w) => ({
          ...w,
          grossWeightQuintals: w.grossWeightQuintals ? w.grossWeightQuintals.toString() : '0',
          tareWeightQuintals: w.tareWeightQuintals ? w.tareWeightQuintals.toString() : '0',
          netWeightQuintals: w.netWeightQuintals ? w.netWeightQuintals.toString() : '0',
          lockedMspRate: w.lockedMspRate ? w.lockedMspRate.toString() : '0',
          deductionValue: w.deductionValue ? w.deductionValue.toString() : '0',
          effectiveRatePerQuintal: w.effectiveRatePerQuintal ? w.effectiveRatePerQuintal.toString() : '0',
          finalPayableAmount: w.finalPayableAmount ? w.finalPayableAmount.toString() : '0',
        })),
        settlements: this.settlements.map((s) => ({
          ...s,
          grossAmount: s.grossAmount ? s.grossAmount.toString() : '0',
          deductions: s.deductions ? s.deductions.toString() : '0',
          netPayableAmount: s.netPayableAmount ? s.netPayableAmount.toString() : '0',
        })),
        payments: this.payments.map((p) => ({
          ...p,
          amountInr: p.amountInr ? p.amountInr.toString() : '0',
        })),
        transporters: this.transporters,
        vehicles: this.vehicles.map((v) => ({
          ...v,
          capacityQuintals: v.capacityQuintals ? v.capacityQuintals.toString() : '0',
        })),
        drivers: this.drivers,
        transportDestinations: this.transportDestinations.map((d) => ({
          ...d,
          capacityQuintals: d.capacityQuintals ? d.capacityQuintals.toString() : null,
        })),
        transportRequests: this.transportRequests.map((tr) => ({
          ...tr,
          quantityQuintals: tr.quantityQuintals ? tr.quantityQuintals.toString() : '0',
          requiredCapacityQuintals: tr.requiredCapacityQuintals ? tr.requiredCapacityQuintals.toString() : '0',
        })),
        transportLoads: this.transportLoads.map((tl) => ({
          ...tl,
          quantityQuintals: tl.quantityQuintals ? tl.quantityQuintals.toString() : '0',
        })),
        auditEvents: this.auditEvents,
        notifications: this.notifications,
      };
      fs.writeFileSync(STORE_PATH, JSON.stringify(data), 'utf-8');
    } catch (e) {
      // Ignore write errors
    }
  }

  public loadFromDisk(): void {
    if (fs.existsSync(STORE_PATH)) {
      try {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        this.users = data.users.map((u: any) => ({
          ...u,
          createdAt: new Date(u.createdAt),
          updatedAt: new Date(u.updatedAt),
        }));
        this.farmerProfiles = data.farmerProfiles.map((fp: any) => ({
          ...fp,
          dateOfBirth: fp.dateOfBirth ? new Date(fp.dateOfBirth) : null,
          createdAt: new Date(fp.createdAt),
          updatedAt: new Date(fp.updatedAt),
        }));
        this.farms = data.farms.map((f: any) => ({
          ...f,
          totalAreaAcres: new Prisma.Decimal(f.totalAreaAcres),
          verifiedArea: f.verifiedArea ? new Prisma.Decimal(f.verifiedArea) : null,
          latitude: f.latitude ? new Prisma.Decimal(f.latitude) : null,
          longitude: f.longitude ? new Prisma.Decimal(f.longitude) : null,
          createdAt: new Date(f.createdAt),
          updatedAt: new Date(f.updatedAt),
        }));
        this.crops = data.crops.map((c: any) => ({
          ...c,
          standardMoistureLimit: new Prisma.Decimal(c.standardMoistureLimit),
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        }));
        this.mspRates = (data.mspRates || []).map((m: any) => ({
          ...m,
          ratePerQuintal: new Prisma.Decimal(m.ratePerQuintal),
          bonusPerQuintal: new Prisma.Decimal(m.bonusPerQuintal || 0),
          effectiveDate: new Date(m.effectiveDate),
          expiryDate: new Date(m.expiryDate),
          createdAt: new Date(m.createdAt),
          updatedAt: new Date(m.updatedAt),
        }));
        if (this.mspRates.length === 0) {
          const now = new Date('2026-01-01T00:00:00.000Z');
          this.mspRates = [
            {
              id: 'msp-wheat-2026',
              cropId: 'crop-wheat',
              season: CropSeason.RABI,
              marketingYear: 2026,
              ratePerQuintal: new Prisma.Decimal(2275.0),
              effectiveDate: new Date('2026-04-01T00:00:00.000Z'),
              expiryDate: new Date('2027-03-31T00:00:00.000Z'),
              sourceReference: 'DEMO-DAC&FW/MSP-2026/SYNTHETIC',
              bonusPerQuintal: new Prisma.Decimal(0),
              isActive: true,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'msp-paddy-2026',
              cropId: 'crop-paddy',
              season: CropSeason.KHARIF,
              marketingYear: 2026,
              ratePerQuintal: new Prisma.Decimal(2300.0),
              effectiveDate: new Date('2026-10-01T00:00:00.000Z'),
              expiryDate: new Date('2027-09-30T00:00:00.000Z'),
              sourceReference: 'DEMO-DAC&FW/MSP-2026/SYNTHETIC',
              bonusPerQuintal: new Prisma.Decimal(0),
              isActive: true,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'msp-mustard-2026',
              cropId: 'crop-mustard',
              season: CropSeason.RABI,
              marketingYear: 2026,
              ratePerQuintal: new Prisma.Decimal(5650.0),
              effectiveDate: new Date('2026-04-01T00:00:00.000Z'),
              expiryDate: new Date('2027-03-31T00:00:00.000Z'),
              sourceReference: 'DEMO-DAC&FW/MSP-2026/SYNTHETIC',
              bonusPerQuintal: new Prisma.Decimal(0),
              isActive: true,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'msp-soybean-2026',
              cropId: 'crop-soybean',
              season: CropSeason.KHARIF,
              marketingYear: 2026,
              ratePerQuintal: new Prisma.Decimal(4892.0),
              effectiveDate: new Date('2026-10-01T00:00:00.000Z'),
              expiryDate: new Date('2027-09-30T00:00:00.000Z'),
              sourceReference: 'DEMO-DAC&FW/MSP-2026/SYNTHETIC',
              bonusPerQuintal: new Prisma.Decimal(0),
              isActive: true,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'msp-cotton-2026',
              cropId: 'crop-cotton',
              season: CropSeason.KHARIF,
              marketingYear: 2026,
              ratePerQuintal: new Prisma.Decimal(7121.0),
              effectiveDate: new Date('2026-10-01T00:00:00.000Z'),
              expiryDate: new Date('2027-09-30T00:00:00.000Z'),
              sourceReference: 'DEMO-DAC&FW/MSP-2026/SYNTHETIC',
              bonusPerQuintal: new Prisma.Decimal(0),
              isActive: true,
              createdAt: now,
              updatedAt: now,
            },
          ];
          this.saveToDisk();
        }
        this.farmerCrops = data.farmerCrops.map((fc: any) => ({
          ...fc,
          sowingDate: fc.sowingDate ? new Date(fc.sowingDate) : null,
          expectedHarvestDate: fc.expectedHarvestDate ? new Date(fc.expectedHarvestDate) : null,
          cultivatedArea: new Prisma.Decimal(fc.cultivatedArea),
          expectedYield: fc.expectedYield ? new Prisma.Decimal(fc.expectedYield) : null,
          createdAt: new Date(fc.createdAt),
          updatedAt: new Date(fc.updatedAt),
        }));

        this.procurementCenters = (data.procurementCenters || []).map((pc: any) => ({
          ...pc,
          latitude: pc.latitude ? new Prisma.Decimal(pc.latitude) : null,
          longitude: pc.longitude ? new Prisma.Decimal(pc.longitude) : null,
          dailyCapacityQuintals: new Prisma.Decimal(pc.dailyCapacityQuintals),
          createdAt: new Date(pc.createdAt),
          updatedAt: new Date(pc.updatedAt),
        }));

        this.centerBays = (data.centerBays || []).map((cb: any) => ({
          ...cb,
          capacityQuintals: new Prisma.Decimal(cb.capacityQuintals),
          createdAt: new Date(cb.createdAt),
          updatedAt: new Date(cb.updatedAt),
        }));

        this.bookingSlots = (data.bookingSlots || []).map((bs: any) => ({
          ...bs,
          slotDate: new Date(bs.slotDate),
          startTime: new Date(bs.startTime),
          endTime: new Date(bs.endTime),
          maxCapacityQuintals: new Prisma.Decimal(bs.maxCapacityQuintals),
          bookedCapacityQuintals: new Prisma.Decimal(bs.bookedCapacityQuintals),
          createdAt: new Date(bs.createdAt),
          updatedAt: new Date(bs.updatedAt),
        }));

        this.bookings = (data.bookings || []).map((b: any) => ({
          ...b,
          bookingDate: new Date(b.bookingDate),
          mspLockedAt: new Date(b.mspLockedAt),
          mspLockExpiresAt: b.mspLockExpiresAt ? new Date(b.mspLockExpiresAt) : null,
          estimatedQuantityQuintals: new Prisma.Decimal(b.estimatedQuantityQuintals),
          lockedRatePerQuintal: new Prisma.Decimal(b.lockedRatePerQuintal),
          createdAt: new Date(b.createdAt),
          updatedAt: new Date(b.updatedAt),
        }));

        this.qualityInspections = (data.qualityInspections || []).map((qi: any) => ({
          ...qi,
          inspectionTimestamp: new Date(qi.inspectionTimestamp),
          moisturePercentage: new Prisma.Decimal(qi.moisturePercentage),
          standardMoistureLimit: new Prisma.Decimal(qi.standardMoistureLimit),
          excessMoisturePercentage: new Prisma.Decimal(qi.excessMoisturePercentage),
          foreignMatterPercentage: qi.foreignMatterPercentage ? new Prisma.Decimal(qi.foreignMatterPercentage) : null,
          damagedGrainsPercentage: qi.damagedGrainsPercentage ? new Prisma.Decimal(qi.damagedGrainsPercentage) : null,
          brokenGrainsPercentage: qi.brokenGrainsPercentage ? new Prisma.Decimal(qi.brokenGrainsPercentage) : null,
          aiConfidenceScore: new Prisma.Decimal(qi.aiConfidenceScore),
          deductionPercentage: new Prisma.Decimal(qi.deductionPercentage),
          deductionAmountPerQuintal: new Prisma.Decimal(qi.deductionAmountPerQuintal),
          lockedMspRate: new Prisma.Decimal(qi.lockedMspRate),
          effectiveRatePerQuintal: new Prisma.Decimal(qi.effectiveRatePerQuintal),
          verifiedAt: qi.verifiedAt ? new Date(qi.verifiedAt) : null,
          createdAt: new Date(qi.createdAt),
          updatedAt: new Date(qi.updatedAt),
        }));

        this.weighments = (data.weighments || []).map((w: any) => ({
          ...w,
          grossWeightQuintals: new Prisma.Decimal(w.grossWeightQuintals),
          tareWeightQuintals: new Prisma.Decimal(w.tareWeightQuintals),
          netWeightQuintals: new Prisma.Decimal(w.netWeightQuintals),
          lockedMspRate: new Prisma.Decimal(w.lockedMspRate),
          deductionValue: new Prisma.Decimal(w.deductionValue),
          effectiveRatePerQuintal: new Prisma.Decimal(w.effectiveRatePerQuintal),
          finalPayableAmount: new Prisma.Decimal(w.finalPayableAmount),
          weighedAt: new Date(w.weighedAt),
          createdAt: new Date(w.createdAt),
          updatedAt: new Date(w.updatedAt),
        }));

        this.settlements = (data.settlements || []).map((s: any) => ({
          ...s,
          grossAmount: new Prisma.Decimal(s.grossAmount),
          deductions: new Prisma.Decimal(s.deductions),
          netPayableAmount: new Prisma.Decimal(s.netPayableAmount),
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        }));

        this.payments = (data.payments || []).map((p: any) => ({
          ...p,
          amountInr: new Prisma.Decimal(p.amountInr),
          initiatedAt: new Date(p.initiatedAt),
          processedAt: p.processedAt ? new Date(p.processedAt) : null,
          disbursedAt: p.disbursedAt ? new Date(p.disbursedAt) : null,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }));

        this.transporters = (data.transporters || []).map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        }));

        this.vehicles = (data.vehicles || []).map((v: any) => ({
          ...v,
          capacityQuintals: new Prisma.Decimal(v.capacityQuintals),
          createdAt: new Date(v.createdAt),
          updatedAt: new Date(v.updatedAt),
        }));

        this.drivers = (data.drivers || []).map((d: any) => ({
          ...d,
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt),
        }));

        this.transportDestinations = (data.transportDestinations || []).map((td: any) => ({
          ...td,
          capacityQuintals: td.capacityQuintals ? new Prisma.Decimal(td.capacityQuintals) : null,
          createdAt: new Date(td.createdAt),
          updatedAt: new Date(td.updatedAt),
        }));

        this.transportRequests = (data.transportRequests || []).map((tr: any) => ({
          ...tr,
          quantityQuintals: new Prisma.Decimal(tr.quantityQuintals),
          requiredCapacityQuintals: new Prisma.Decimal(tr.requiredCapacityQuintals),
          requestedDate: new Date(tr.requestedDate),
          assignedAt: tr.assignedAt ? new Date(tr.assignedAt) : null,
          dispatchedAt: tr.dispatchedAt ? new Date(tr.dispatchedAt) : null,
          arrivedAt: tr.arrivedAt ? new Date(tr.arrivedAt) : null,
          deliveredAt: tr.deliveredAt ? new Date(tr.deliveredAt) : null,
          cancelledAt: tr.cancelledAt ? new Date(tr.cancelledAt) : null,
          createdAt: new Date(tr.createdAt),
          updatedAt: new Date(tr.updatedAt),
        }));

        this.transportLoads = (data.transportLoads || []).map((tl: any) => ({
          ...tl,
          quantityQuintals: new Prisma.Decimal(tl.quantityQuintals),
          loadingStartedAt: tl.loadingStartedAt ? new Date(tl.loadingStartedAt) : null,
          loadedAt: tl.loadedAt ? new Date(tl.loadedAt) : null,
          dispatchedAt: tl.dispatchedAt ? new Date(tl.dispatchedAt) : null,
          arrivedAt: tl.arrivedAt ? new Date(tl.arrivedAt) : null,
          deliveredAt: tl.deliveredAt ? new Date(tl.deliveredAt) : null,
          createdAt: new Date(tl.createdAt),
          updatedAt: new Date(tl.updatedAt),
        }));

        if (!data.transporters || data.transporters.length === 0) {
          this.seedTransportData();
        }

        if (!data.procurementCenters || data.procurementCenters.length === 0) {
          this.seedProcurementData();
        }

        this.auditEvents = data.auditEvents.map((ae: any) => ({
          ...ae,
          timestamp: new Date(ae.timestamp),
        }));

        this.notifications = (data.notifications || []).map((n: any) => ({
          ...n,
          readAt: n.readAt ? new Date(n.readAt) : null,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.updatedAt),
        }));
        return;
      } catch {
        // Corrupt file, re-seed
      }
    }

    this.reset();
  }

  public reset(): void {
    const now = new Date('2026-01-01T00:00:00.000Z');

    this.users = [
      {
        id: 'user-demo-farmer-01',
        name: 'Harpreet Singh',
        phone: '+91-9876543201',
        email: 'demo.farmer@kisanflow.local',
        role: UserRole.FARMER,
        isActive: true,
        operatorCenterId: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-demo-farmer-02',
        name: 'Balwinder Singh',
        phone: '+91-9812345602',
        email: 'demo.farmer2@kisanflow.local',
        role: UserRole.FARMER,
        isActive: true,
        operatorCenterId: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-demo-operator-01',
        name: 'Suresh Verma (Karnal Operator)',
        phone: '+91-9876543211',
        email: 'demo.operator@kisanflow.local',
        role: UserRole.CENTER_OPERATOR,
        isActive: true,
        operatorCenterId: 'center-karnal-01',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-demo-inspector-01',
        name: 'Anjali Sharma (Quality Inspector)',
        phone: '+91-9876543212',
        email: 'demo.inspector@kisanflow.local',
        role: UserRole.QUALITY_INSPECTOR,
        isActive: true,
        operatorCenterId: 'center-karnal-01',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-demo-admin-01',
        name: 'Rameshwar Sharma (Govt Admin)',
        phone: '+91-9876543210',
        email: 'demo.admin@kisanflow.local',
        role: UserRole.GOVERNMENT_ADMIN,
        isActive: true,
        operatorCenterId: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-demo-superadmin-01',
        name: 'National Super Admin',
        phone: '+91-9876543299',
        email: 'demo.superadmin@kisanflow.local',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        operatorCenterId: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-demo-inactive-01',
        name: 'Inactive Farmer Account',
        phone: '+91-9876543290',
        email: 'demo.inactive@kisanflow.local',
        role: UserRole.FARMER,
        isActive: false,
        operatorCenterId: null,
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.farmerProfiles = [
      {
        id: 'prof-farmer-01',
        userId: 'user-demo-farmer-01',
        fullName: 'Harpreet Singh',
        alternatePhone: '+91-9876543202',
        dateOfBirth: new Date('1985-05-15'),
        gender: 'MALE',
        address: 'House 42, VPO Taraori',
        village: 'Taraori',
        aadhaarHash: 'c79401fa91176b971a067ae24067a909a32c2560ad3dfeb6ec38f4d547aa52bd',
        kisanCreditCard: 'KCC-HR-99881',
        pmKisanId: 'PMK-HR-449102',
        bankAccountNumber: 'XXXXXX5432',
        bankIfsc: 'SBIN0001234',
        primaryDistrict: 'Karnal',
        primaryState: 'Haryana',
        pincode: '132001',
        preferredLanguage: 'hi',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prof-farmer-02',
        userId: 'user-demo-farmer-02',
        fullName: 'Balwinder Singh',
        alternatePhone: '+91-9812345603',
        dateOfBirth: new Date('1982-08-20'),
        gender: 'MALE',
        address: 'Khasra 102, Samrala Road',
        village: 'Samrala',
        aadhaarHash: 'd89402fa91176b971a067ae24067a909a32c2560ad3dfeb6ec38f4d547aa52be',
        kisanCreditCard: 'KCC-PB-44123',
        pmKisanId: 'PMK-PB-112093',
        bankAccountNumber: 'XXXXXX9876',
        bankIfsc: 'PUNB0004321',
        primaryDistrict: 'Ludhiana',
        primaryState: 'Punjab',
        pincode: '141001',
        preferredLanguage: 'pa',
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.farms = [
      {
        id: 'farm-farmer-01',
        farmerProfileId: 'prof-farmer-01',
        farmName: 'Singh Krishi Farm 1',
        landParcelNumber: 'KH-882/19',
        district: 'Karnal',
        state: 'Haryana',
        village: 'Taraori',
        totalAreaAcres: new Prisma.Decimal(6.5),
        landAreaUnit: LandAreaUnit.ACRE,
        ownershipType: OwnershipType.OWNED,
        verifiedArea: new Prisma.Decimal(6.5),
        isLandVerified: true,
        verificationStatus: FarmVerificationStatus.VERIFIED,
        soilType: 'Alluvial Loam',
        irrigationType: 'Tube Well',
        latitude: new Prisma.Decimal(29.6857),
        longitude: new Prisma.Decimal(76.9905),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'farm-farmer-02',
        farmerProfileId: 'prof-farmer-02',
        farmName: 'Balwinder Agri Lands',
        landParcelNumber: 'KH-102/4',
        district: 'Ludhiana',
        state: 'Punjab',
        village: 'Samrala',
        totalAreaAcres: new Prisma.Decimal(10.0),
        landAreaUnit: LandAreaUnit.ACRE,
        ownershipType: OwnershipType.OWNED,
        verifiedArea: new Prisma.Decimal(10.0),
        isLandVerified: true,
        verificationStatus: FarmVerificationStatus.VERIFIED,
        soilType: 'Clay Loam',
        irrigationType: 'Canal',
        latitude: new Prisma.Decimal(30.901),
        longitude: new Prisma.Decimal(75.8573),
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.crops = [
      {
        id: 'crop-wheat',
        name: 'Wheat (Gehun)',
        code: 'WHT-01',
        category: 'Cereals',
        standardMoistureLimit: new Prisma.Decimal(12.0),
        description: 'High yield bread wheat (Triticum aestivum)',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'crop-paddy',
        name: 'Paddy / Rice (Dhan)',
        code: 'PDY-02',
        category: 'Cereals',
        standardMoistureLimit: new Prisma.Decimal(17.0),
        description: 'Basmati long grain paddy',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'crop-mustard',
        name: 'Mustard (Sarson)',
        code: 'MST-03',
        category: 'Oilseeds',
        standardMoistureLimit: new Prisma.Decimal(8.0),
        description: 'High oil content yellow mustard',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'crop-soybean',
        name: 'Soybean',
        code: 'SYB-04',
        category: 'Oilseeds',
        standardMoistureLimit: new Prisma.Decimal(10.0),
        description: 'Non-GMO yellow soybean',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'crop-cotton',
        name: 'Cotton (Kapas)',
        code: 'CTN-05',
        category: 'Fibre',
        standardMoistureLimit: new Prisma.Decimal(8.5),
        description: 'Medium staple length raw cotton',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'crop-inactive-demo',
        name: 'Experimental Jute (Inactive)',
        code: 'JUT-99',
        category: 'Fibre',
        standardMoistureLimit: new Prisma.Decimal(14.0),
        description: 'Trial crop not authorized for MSP procurement',
        isActive: false,
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.farmerCrops = [];

    this.mspRates = [
      {
        id: 'msp-wheat-2026',
        cropId: 'crop-wheat',
        season: CropSeason.RABI,
        marketingYear: 2026,
        ratePerQuintal: new Prisma.Decimal(2275.0),
        effectiveDate: new Date('2026-04-01T00:00:00.000Z'),
        expiryDate: new Date('2027-03-31T00:00:00.000Z'),
        sourceReference: 'DEMO-DAC&FW/MSP-2026/SYNTHETIC',
        bonusPerQuintal: new Prisma.Decimal(0),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'msp-paddy-2026',
        cropId: 'crop-paddy',
        season: CropSeason.KHARIF,
        marketingYear: 2026,
        ratePerQuintal: new Prisma.Decimal(2300.0),
        effectiveDate: new Date('2026-10-01T00:00:00.000Z'),
        expiryDate: new Date('2027-09-30T00:00:00.000Z'),
        sourceReference: 'DEMO-DAC&FW/MSP-2026/SYNTHETIC',
        bonusPerQuintal: new Prisma.Decimal(0),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'msp-mustard-2026',
        cropId: 'crop-mustard',
        season: CropSeason.RABI,
        marketingYear: 2026,
        ratePerQuintal: new Prisma.Decimal(5650.0),
        effectiveDate: new Date('2026-04-01T00:00:00.000Z'),
        expiryDate: new Date('2027-03-31T00:00:00.000Z'),
        sourceReference: 'DEMO-DAC&FW/MSP-2026/SYNTHETIC',
        bonusPerQuintal: new Prisma.Decimal(0),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'msp-soybean-2026',
        cropId: 'crop-soybean',
        season: CropSeason.KHARIF,
        marketingYear: 2026,
        ratePerQuintal: new Prisma.Decimal(4892.0),
        effectiveDate: new Date('2026-10-01T00:00:00.000Z'),
        expiryDate: new Date('2027-09-30T00:00:00.000Z'),
        sourceReference: 'DEMO-DAC&FW/MSP-2026/SYNTHETIC',
        bonusPerQuintal: new Prisma.Decimal(0),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'msp-cotton-2026',
        cropId: 'crop-cotton',
        season: CropSeason.KHARIF,
        marketingYear: 2026,
        ratePerQuintal: new Prisma.Decimal(7121.0),
        effectiveDate: new Date('2026-10-01T00:00:00.000Z'),
        expiryDate: new Date('2027-09-30T00:00:00.000Z'),
        sourceReference: 'DEMO-DAC&FW/MSP-2026/SYNTHETIC',
        bonusPerQuintal: new Prisma.Decimal(0),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const genesisMeta = { system: 'KisanFlow', event: 'SYSTEM_INITIALIZED' };
    const genesisData = JSON.stringify(genesisMeta);
    const currentHash = crypto
      .createHash('sha256')
      .update(`${genesisHash}|1|${now.toISOString()}|SYSTEM_GENESIS|SystemConfig|ROOT-01|${genesisData}`)
      .digest('hex');

    this.auditEvents = [
      {
        id: 'audit-001',
        sequenceNumber: 1,
        actorId: 'user-demo-superadmin-01',
        action: 'SYSTEM_GENESIS',
        entityType: 'SystemConfig',
        entityId: 'ROOT-01',
        timestamp: now,
        metadata: genesisMeta,
        previousHash: genesisHash,
        currentHash,
      },
    ];

    this.seedProcurementData();
    this.saveToDisk();
  }

  public seedProcurementData(): void {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const slotDate = new Date('2026-09-15T00:00:00.000Z');

    this.procurementCenters = [
      {
        id: 'center-karnal-01',
        code: 'PC-HR-KAR-01',
        name: 'Karnal Central Agri Procurement Hub',
        locationAddress: 'GT Road, Near Anaj Mandi, Sector 3',
        district: 'Karnal',
        state: 'Haryana',
        latitude: new Prisma.Decimal(29.6857),
        longitude: new Prisma.Decimal(76.9905),
        dailyCapacityQuintals: new Prisma.Decimal(15000),
        slotDurationMinutes: 90,
        operatingHoursStart: '08:00',
        operatingHoursEnd: '18:00',
        supportedCropIds: ['crop-wheat', 'crop-paddy', 'crop-mustard'],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'center-ludhiana-02',
        code: 'PC-PB-LUD-02',
        name: 'Ludhiana Integrated Mandi Facility',
        locationAddress: 'Ferozepur Road, Grain Market complex',
        district: 'Ludhiana',
        state: 'Punjab',
        latitude: new Prisma.Decimal(30.901),
        longitude: new Prisma.Decimal(75.8573),
        dailyCapacityQuintals: new Prisma.Decimal(18000),
        slotDurationMinutes: 90,
        operatingHoursStart: '07:30',
        operatingHoursEnd: '18:30',
        supportedCropIds: ['crop-wheat', 'crop-paddy'],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'center-indore-03',
        code: 'PC-MP-IND-03',
        name: 'Indore Malwa Krishi Upaj Hub',
        locationAddress: 'Chhavani Grain Market, AB Road',
        district: 'Indore',
        state: 'Madhya Pradesh',
        latitude: new Prisma.Decimal(22.7196),
        longitude: new Prisma.Decimal(75.8577),
        dailyCapacityQuintals: new Prisma.Decimal(12000),
        slotDurationMinutes: 90,
        operatingHoursStart: '08:30',
        operatingHoursEnd: '17:30',
        supportedCropIds: ['crop-wheat', 'crop-soybean'],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'center-nagpur-04',
        code: 'PC-MH-NAG-04',
        name: 'Nagpur Vidarbha Agro Procurement Center',
        locationAddress: 'Kalamna Market Yard, Ring Road',
        district: 'Nagpur',
        state: 'Maharashtra',
        latitude: new Prisma.Decimal(21.1458),
        longitude: new Prisma.Decimal(79.0882),
        dailyCapacityQuintals: new Prisma.Decimal(10000),
        slotDurationMinutes: 90,
        operatingHoursStart: '08:00',
        operatingHoursEnd: '17:00',
        supportedCropIds: ['crop-cotton', 'crop-soybean'],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'center-jaipur-05',
        code: 'PC-RJ-JAI-05',
        name: 'Jaipur Shekhawati Mandi Center',
        locationAddress: 'Surajpole Mandi, Delhi Highway',
        district: 'Jaipur',
        state: 'Rajasthan',
        latitude: new Prisma.Decimal(26.9124),
        longitude: new Prisma.Decimal(75.7873),
        dailyCapacityQuintals: new Prisma.Decimal(9500),
        slotDurationMinutes: 90,
        operatingHoursStart: '08:00',
        operatingHoursEnd: '18:00',
        supportedCropIds: ['crop-mustard', 'crop-wheat'],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'center-inactive-01',
        code: 'PC-INACTIVE-99',
        name: 'Decommissioned Outpost Hub (Inactive)',
        locationAddress: 'Old Yard, Sector 1',
        district: 'Ambala',
        state: 'Haryana',
        latitude: new Prisma.Decimal(30.3782),
        longitude: new Prisma.Decimal(76.7767),
        dailyCapacityQuintals: new Prisma.Decimal(2000),
        slotDurationMinutes: 90,
        operatingHoursStart: '09:00',
        operatingHoursEnd: '17:00',
        supportedCropIds: ['crop-wheat'],
        isActive: false,
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.centerBays = [
      {
        id: 'bay-karnal-01',
        procurementCenterId: 'center-karnal-01',
        bayNumber: 1,
        name: 'Unloading Bay 1 - Primary Grains',
        capacityQuintals: new Prisma.Decimal(500),
        status: BayStatus.AVAILABLE,
        isActive: true,
        supportedCropIds: ['crop-wheat', 'crop-paddy', 'crop-mustard'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bay-karnal-02',
        procurementCenterId: 'center-karnal-01',
        bayNumber: 2,
        name: 'Unloading Bay 2 - Quality Testing Line',
        capacityQuintals: new Prisma.Decimal(500),
        status: BayStatus.AVAILABLE,
        isActive: true,
        supportedCropIds: ['crop-wheat', 'crop-paddy'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bay-karnal-03',
        procurementCenterId: 'center-karnal-01',
        bayNumber: 3,
        name: 'Unloading Bay 3 - Heavy Bulk Intake',
        capacityQuintals: new Prisma.Decimal(500),
        status: BayStatus.AVAILABLE,
        isActive: true,
        supportedCropIds: ['crop-wheat'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bay-karnal-04',
        procurementCenterId: 'center-karnal-01',
        bayNumber: 4,
        name: 'Maintenance Bay 4 (Decommissioned/Inactive)',
        capacityQuintals: new Prisma.Decimal(500),
        status: BayStatus.MAINTENANCE,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bay-ludhiana-01',
        procurementCenterId: 'center-ludhiana-02',
        bayNumber: 1,
        name: 'Ludhiana Unloading Bay 1',
        capacityQuintals: new Prisma.Decimal(600),
        status: BayStatus.AVAILABLE,
        isActive: true,
        supportedCropIds: ['crop-wheat', 'crop-paddy'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bay-ludhiana-02',
        procurementCenterId: 'center-ludhiana-02',
        bayNumber: 2,
        name: 'Ludhiana Unloading Bay 2',
        capacityQuintals: new Prisma.Decimal(600),
        status: BayStatus.AVAILABLE,
        isActive: true,
        supportedCropIds: ['crop-wheat', 'crop-paddy'],
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.bookingSlots = [
      {
        id: 'slot-karnal-01',
        procurementCenterId: 'center-karnal-01',
        centerBayId: 'bay-karnal-01',
        slotDate: slotDate,
        startTime: new Date('2026-09-15T09:00:00.000Z'),
        endTime: new Date('2026-09-15T10:30:00.000Z'),
        maxCapacityQuintals: new Prisma.Decimal(300),
        bookedCapacityQuintals: new Prisma.Decimal(50),
        isAvailable: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'slot-karnal-02',
        procurementCenterId: 'center-karnal-01',
        centerBayId: 'bay-karnal-01',
        slotDate: slotDate,
        startTime: new Date('2026-09-15T10:30:00.000Z'),
        endTime: new Date('2026-09-15T12:00:00.000Z'),
        maxCapacityQuintals: new Prisma.Decimal(300),
        bookedCapacityQuintals: new Prisma.Decimal(0),
        isAvailable: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'slot-karnal-03',
        procurementCenterId: 'center-karnal-01',
        centerBayId: 'bay-karnal-02',
        slotDate: slotDate,
        startTime: new Date('2026-09-15T13:00:00.000Z'),
        endTime: new Date('2026-09-15T14:30:00.000Z'),
        maxCapacityQuintals: new Prisma.Decimal(200),
        bookedCapacityQuintals: new Prisma.Decimal(0),
        isAvailable: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'slot-karnal-full',
        procurementCenterId: 'center-karnal-01',
        centerBayId: 'bay-karnal-03',
        slotDate: slotDate,
        startTime: new Date('2026-09-15T14:30:00.000Z'),
        endTime: new Date('2026-09-15T16:00:00.000Z'),
        maxCapacityQuintals: new Prisma.Decimal(100),
        bookedCapacityQuintals: new Prisma.Decimal(100),
        isAvailable: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'slot-karnal-inactive-bay',
        procurementCenterId: 'center-karnal-01',
        centerBayId: 'bay-karnal-04',
        slotDate: slotDate,
        startTime: new Date('2026-09-15T09:00:00.000Z'),
        endTime: new Date('2026-09-15T10:30:00.000Z'),
        maxCapacityQuintals: new Prisma.Decimal(300),
        bookedCapacityQuintals: new Prisma.Decimal(0),
        isAvailable: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'slot-ludhiana-01',
        procurementCenterId: 'center-ludhiana-02',
        centerBayId: 'bay-ludhiana-01',
        slotDate: slotDate,
        startTime: new Date('2026-09-15T09:00:00.000Z'),
        endTime: new Date('2026-09-15T10:30:00.000Z'),
        maxCapacityQuintals: new Prisma.Decimal(400),
        bookedCapacityQuintals: new Prisma.Decimal(0),
        isAvailable: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.bookings = [
      {
        id: 'book-demo-01',
        bookingNumber: 'BK-202609-001',
        bookingReference: 'BK-202609-001',
        farmerProfileId: 'prof-farmer-01',
        farmId: 'farm-farmer-01',
        cropId: 'crop-wheat',
        procurementCenterId: 'center-karnal-01',
        centerBayId: 'bay-karnal-01',
        bookingSlotId: 'slot-karnal-01',
        bookingDate: slotDate,
        estimatedQuantityQuintals: new Prisma.Decimal(50),
        quantityUnit: 'QUINTAL',
        lockedMspRateId: 'msp-wheat-2026',
        lockedRatePerQuintal: new Prisma.Decimal(2275),
        mspMarketingYear: 2026,
        mspSeason: CropSeason.RABI,
        mspRateReference: 'DEMO-DAC&FW/MSP-2026/SYNTHETIC',
        mspLockedAt: now,
        mspLockExpiresAt: new Date('2026-10-15T00:00:00.000Z'),
        tokenNumber: 'KF-2026-000101',
        securePin: '482910',
        qrCodeSignature: 'HMAC-SHA256:DEMO-TOKEN-KF-001',
        status: BookingStatus.CONFIRMED,
        cancellationReason: null,
        metadata: { vehicleType: 'Tractor Trolley', moistureChecked: true },
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.qualityInspections = [];
    this.weighments = [];
    this.settlements = [];
    this.payments = [];
    this.seedTransportData();
  }

  public seedTransportData(): void {
    const now = new Date('2026-01-01T00:00:00.000Z');

    this.transporters = [
      {
        id: 'transporter-01',
        code: 'TRP-HR-01',
        name: 'Kisan Express Logistics & Freight Co.',
        phone: '+91-9876543301',
        email: 'logistics@kisanexpress.in',
        address: 'GT Road, Sector 3, Karnal, Haryana',
        registrationNumber: 'HR-TRANS-2024-8841',
        isActive: true,
        verificationStatus: 'VERIFIED',
        metadata: { fleetSize: 24, coverageStates: ['Haryana', 'Punjab'] },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'transporter-02',
        code: 'TRP-PB-02',
        name: 'Punjab Agrologix Carriers Pvt Ltd',
        phone: '+91-9876543302',
        email: 'dispatch@punjabagrologix.com',
        address: 'Focal Point, Phase 5, Ludhiana, Punjab',
        registrationNumber: 'PB-TRANS-2023-4109',
        isActive: true,
        verificationStatus: 'VERIFIED',
        metadata: { fleetSize: 35, coverageStates: ['Punjab', 'Haryana', 'Delhi NCR'] },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'transporter-inactive',
        code: 'TRP-INACTIVE-03',
        name: 'Decommissioned Logistics Line',
        phone: '+91-9876543399',
        email: 'inactive@decom.local',
        address: 'Old Siding, Ambala',
        registrationNumber: 'HR-TRANS-2020-0012',
        isActive: false,
        verificationStatus: 'PENDING',
        metadata: null,
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.vehicles = [
      {
        id: 'vehicle-01',
        registrationNumber: 'HR-05-TR-1001',
        transporterId: 'transporter-01',
        vehicleType: 'TRUCK_10_TON',
        capacityQuintals: new Prisma.Decimal(100.0),
        capacityUnit: 'QUINTAL',
        isActive: true,
        verificationStatus: 'VERIFIED',
        currentLocation: 'Karnal Procurement Center',
        metadata: { make: 'Tata 1613', gpsEnabled: true },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'vehicle-02',
        registrationNumber: 'HR-05-TR-1002',
        transporterId: 'transporter-01',
        vehicleType: 'TRUCK_16_TON',
        capacityQuintals: new Prisma.Decimal(160.0),
        capacityUnit: 'QUINTAL',
        isActive: true,
        verificationStatus: 'VERIFIED',
        currentLocation: 'Karnal Hub',
        metadata: { make: 'Ashok Leyland 2820', gpsEnabled: true },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'vehicle-small-03',
        registrationNumber: 'HR-05-TR-0500',
        transporterId: 'transporter-01',
        vehicleType: 'PICKUP',
        capacityQuintals: new Prisma.Decimal(30.0),
        capacityUnit: 'QUINTAL',
        isActive: true,
        verificationStatus: 'VERIFIED',
        currentLocation: 'Karnal City',
        metadata: { make: 'Mahindra Bolero Maxi Truck' },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'vehicle-unverified-04',
        registrationNumber: 'HR-05-TR-9999',
        transporterId: 'transporter-01',
        vehicleType: 'TRUCK_10_TON',
        capacityQuintals: new Prisma.Decimal(100.0),
        capacityUnit: 'QUINTAL',
        isActive: true,
        verificationStatus: 'PENDING',
        currentLocation: 'Karnal Workshop',
        metadata: { fitnessPending: true },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'vehicle-inactive-05',
        registrationNumber: 'HR-05-TR-8888',
        transporterId: 'transporter-01',
        vehicleType: 'TRUCK_10_TON',
        capacityQuintals: new Prisma.Decimal(100.0),
        capacityUnit: 'QUINTAL',
        isActive: false,
        verificationStatus: 'VERIFIED',
        currentLocation: 'Decommissioned Yard',
        metadata: { outOfService: true },
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.drivers = [
      {
        id: 'driver-01',
        name: 'Joginder Singh',
        phone: '+91-9876543401',
        licenseNumber: 'DL-HR05-20180012345',
        transporterId: 'transporter-01',
        isActive: true,
        verificationStatus: 'VERIFIED',
        metadata: { experienceYears: 12 },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'driver-02',
        name: 'Gurmeet Ram',
        phone: '+91-9876543402',
        licenseNumber: 'DL-PB10-20200054321',
        transporterId: 'transporter-02',
        isActive: true,
        verificationStatus: 'VERIFIED',
        metadata: { experienceYears: 8 },
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.transportDestinations = [
      {
        id: 'dest-fci-karnal',
        code: 'FCI-KARNAL-01',
        name: 'FCI Central Godown & Silos Karnal',
        destinationType: 'FCI_GODOWN',
        address: 'Near Railway Siding, Sector 14, Karnal',
        district: 'Karnal',
        state: 'Haryana',
        pincode: '132001',
        contactPerson: 'Sh. R.K. Mehta (Depot Manager)',
        contactPhone: '+91-9876543501',
        capacityQuintals: new Prisma.Decimal(50000),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'dest-cwc-panipat',
        code: 'CWC-PANIPAT-02',
        name: 'Central Warehousing Corporation Depot Panipat',
        destinationType: 'WAREHOUSE',
        address: 'Industrial Area, GT Road, Panipat',
        district: 'Panipat',
        state: 'Haryana',
        pincode: '132103',
        contactPerson: 'Smt. Sunita Yadav',
        contactPhone: '+91-9876543502',
        capacityQuintals: new Prisma.Decimal(75000),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.transportRequests = [];
    this.transportLoads = [];
    this.notifications = [];
  }
}

export const memoryStore = new PrismaMemoryStore();
