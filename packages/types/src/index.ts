// ==============================================================================
// KisanFlow — Shared Core Types & Interfaces (Phase 1 Foundation)
// ==============================================================================

export type UserRole =
  | 'FARMER'
  | 'CENTER_OPERATOR'
  | 'QUALITY_INSPECTOR'
  | 'GOVERNMENT_ADMIN'
  | 'SUPER_ADMIN';

export interface UserDTO {
  id: string;
  firebaseUid?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  isActive: boolean;
  operatorCenterId?: string | null;
  assignedCenterIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserCenterAssignmentDTO {
  id: string;
  userId: string;
  procurementCenterId: string;
  centerCode?: string;
  centerName?: string;
  role: UserRole;
  assignedAt: string;
}

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'RESCHEDULED'
  | 'CHECKED_IN'
  | 'IN_QUEUE'
  | 'PROCESSING'
  | 'QUALITY_ASSESSED'
  | 'WEIGHED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED';

export type QualityInspectionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REVIEW_REQUIRED'
  | 'REJECTED';

export type DeductionType = 'PERCENTAGE' | 'FIXED_PER_QUINTAL' | 'REJECTION' | 'NOT_CONFIGURED';

export type SettlementStatus = 'PENDING' | 'SETTLED' | 'CANCELLED';

export type PaymentStatus =
  | 'INITIATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export type PaymentMethod =
  | 'DBT_PFMS'
  | 'DIRECT_BANK_TRANSFER'
  | 'UPI'
  | 'NEFT'
  | 'RTGS';

export type ProcurementStatus = 'PENDING' | 'VERIFIED' | 'COMPLETED' | 'REJECTED';

export type CropSeason = 'KHARIF' | 'RABI' | 'ZAID';

export type CropQualityGrade = 'GRADE_A' | 'GRADE_B' | 'GRADE_C' | 'BELOW_FAQ';

export type BayStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'OFFLINE';

export type QueuePriority = 'NORMAL' | 'PERISHABLE_EMERGENCY' | 'SENIOR_FARMER' | 'RESCHEDULED_PRIORITY';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface HealthCheckResponse {
  success: boolean;
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: string;
  version: string;
  environment: string;
  checks?: {
    database?: { status: string; latencyMs?: number };
    redis?: { status: string; latencyMs?: number };
    mlService?: { status: string; latencyMs?: number };
  };
}

export interface ProcurementCenterDTO {
  id: string;
  code: string;
  name: string;
  locationAddress: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  dailyCapacityQuintals: number;
  slotDurationMinutes: number;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  isActive: boolean;
}

export interface CropDTO {
  id: string;
  name: string;
  code: string;
  category: string;
  standardMoistureLimit: number;
}

export interface MSPRateDTO {
  id: string;
  cropId: string;
  season: CropSeason;
  marketingYear: number;
  ratePerQuintal: number;
  effectiveDate: string;
  expiryDate: string;
  sourceReference: string;
  bonusPerQuintal: number;
  isActive: boolean;
}

export interface BookingDTO {
  id: string;
  bookingNumber: string;
  bookingReference?: string;
  farmerProfileId?: string;
  farmerName: string;
  farmerPhone?: string;
  cropId?: string;
  cropName: string;
  cropCode?: string;
  procurementCenterId?: string;
  centerName: string;
  centerCode?: string;
  centerBayId?: string | null;
  bayNumber?: number | null;
  bayName?: string | null;
  bookingSlotId?: string;
  slotStartTime: string;
  slotEndTime: string;
  bookingDate?: string;
  lockedMspRateId?: string;
  lockedMspRate: number;
  lockedRatePerQuintal?: number;
  mspMarketingYear?: number;
  mspSeason?: string;
  mspRateReference?: string;
  mspLockedAt?: string;
  mspLockExpiresAt?: string | null;
  estimatedQuantityQuintals: number;
  quantityUnit?: string;
  tokenNumber?: string;
  status: BookingStatus;
  securePin: string;
  qrCodeSignature?: string;
  cancellationReason?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditEventDTO {
  id: string;
  sequenceNumber: number;
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  previousHash: string;
  currentHash: string;
}

export interface QualityInspectionDTO {
  id: string;
  bookingId: string;
  bookingNumber?: string;
  farmerProfileId: string;
  farmerName?: string;
  farmerPhone?: string;
  cropId: string;
  cropName?: string;
  cropCode?: string;
  procurementCenterId: string;
  centerName?: string;
  inspectorId?: string | null;
  inspectorName?: string | null;
  sampleReference: string;
  inspectionTimestamp: string;
  status: QualityInspectionStatus;
  moisturePercentage: number;
  standardMoistureLimit: number;
  isMoisturePass: boolean;
  excessMoisturePercentage: number;
  foreignMatterPercentage?: number;
  damagedGrainsPercentage?: number;
  brokenGrainsPercentage?: number;
  otherQualityParameters?: Record<string, unknown>;
  aiModelVersion?: string;
  aiConfidenceScore?: number;
  aiInferenceStatus?: string;
  aiPredictedGrade?: CropQualityGrade;
  finalGrade: CropQualityGrade;
  isHumanVerified: boolean;
  verifiedByUserId?: string | null;
  verifiedAt?: string | null;
  reviewRemarks?: string | null;
  deductionType: DeductionType;
  deductionPercentage: number;
  deductionAmountPerQuintal: number;
  lockedMspRate: number;
  effectiveRatePerQuintal: number;
  remarks?: string | null;
  evidenceImageUrl?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface WeighmentDTO {
  id: string;
  bookingId: string;
  bookingNumber?: string;
  inspectionId?: string | null;
  procurementCenterId: string;
  centerName?: string;
  weighingOperatorId: string;
  operatorName?: string;
  grossWeightQuintals: number;
  tareWeightQuintals: number;
  netWeightQuintals: number;
  quantityUnit: string;
  scaleDeviceId: string;
  verificationStatus: string;
  weighedAt: string;
  lockedMspRate: number;
  qualityGrade: CropQualityGrade;
  deductionType: DeductionType;
  deductionValue: number;
  effectiveRatePerQuintal: number;
  finalPayableAmount: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProcurementCalculationSnapshotDTO {
  bookingId: string;
  lockedMSP: number;
  qualityGrade: CropQualityGrade;
  deductionType: DeductionType;
  deductionValue: number;
  effectiveRate: number;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  finalAmount: number;
  calculatedAt: string;
}

export interface SettlementDTO {
  id: string;
  settlementReference: string;
  bookingId: string;
  bookingNumber?: string;
  farmerProfileId: string;
  farmerName?: string;
  farmerPhone?: string;
  cropId: string;
  cropName?: string;
  cropCode?: string;
  procurementCenterId?: string;
  centerName?: string;
  lockedMspRate: number;
  lockedMspReference?: string;
  qualityInspectionId?: string | null;
  qualityGrade?: CropQualityGrade;
  weighmentId?: string | null;
  netWeightQuintals: number;
  grossAmount: number;
  deductions: number;
  netPayableAmount: number;
  currency: string;
  status: SettlementStatus;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentDTO {
  id: string;
  paymentReference: string;
  settlementId: string;
  settlementReference?: string;
  bookingId?: string;
  bookingNumber?: string;
  farmerProfileId: string;
  farmerName?: string;
  farmerPhone?: string;
  cropId?: string;
  cropName?: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  providerTransactionId?: string | null;
  status: PaymentStatus;
  isSimulated: boolean;
  failureReason?: string | null;
  idempotencyKey?: string | null;
  initiatedAt: string;
  processedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

// ------------------------------------------------------------------------------
// PHASE 4B — TRANSPORT & LOGISTICS TYPES & DTOs
// ------------------------------------------------------------------------------

export type TransportStatus =
  | 'REQUESTED'
  | 'ASSIGNED'
  | 'LOADED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'CANCELLED';

export type VehicleVerificationStatus = 'PENDING' | 'VERIFIED' | 'FLAGGED' | 'REJECTED';

export type VehicleType =
  | 'TRUCK_10_TON'
  | 'TRUCK_16_TON'
  | 'TRACTOR_TROLLEY'
  | 'CONTAINER'
  | 'PICKUP'
  | 'OTHER';

export type DestinationType =
  | 'WAREHOUSE'
  | 'MILL'
  | 'STORAGE_FACILITY'
  | 'GOVERNMENT_PROCUREMENT_DEPOT'
  | 'FCI_GODOWN'
  | 'CENTRAL_SILO'
  | 'OTHER';

export interface TransporterDTO {
  id: string;
  code: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  registrationNumber?: string | null;
  isActive: boolean;
  verificationStatus: string;
  metadata?: Record<string, unknown> | null;
  vehicleCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface VehicleDTO {
  id: string;
  registrationNumber: string;
  transporterId?: string | null;
  transporterName?: string | null;
  transporterCode?: string | null;
  vehicleType: string;
  capacityQuintals: number;
  capacityUnit: string;
  isActive: boolean;
  verificationStatus: VehicleVerificationStatus;
  currentLocation?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DriverDTO {
  id: string;
  name: string;
  phone: string;
  licenseNumber?: string | null;
  transporterId?: string | null;
  transporterName?: string | null;
  isActive: boolean;
  verificationStatus: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransportDestinationDTO {
  id: string;
  code: string;
  name: string;
  destinationType: DestinationType;
  address: string;
  district: string;
  state: string;
  pincode?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  capacityQuintals?: number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransportLoadDTO {
  id: string;
  loadReference: string;
  transportRequestId: string;
  bookingId: string;
  vehicleId: string;
  vehicleRegistrationNumber?: string;
  sourceCenterId: string;
  sourceCenterName?: string;
  destinationName: string;
  cropId: string;
  cropName?: string;
  quantityQuintals: number;
  quantityUnit: string;
  loadingStartedAt?: string | null;
  loadedAt?: string | null;
  dispatchedAt?: string | null;
  arrivedAt?: string | null;
  deliveredAt?: string | null;
  status: TransportStatus;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransportRequestDTO {
  id: string;
  requestReference: string;
  bookingId: string;
  bookingNumber?: string;
  farmerProfileId?: string;
  farmerName?: string;
  farmerPhone?: string;
  procurementCenterId: string;
  centerName?: string;
  centerCode?: string;
  cropId: string;
  cropName?: string;
  cropCode?: string;
  quantityQuintals: number;
  quantityUnit: string;
  destinationType: string;
  destinationName: string;
  destinationAddress: string;
  destinationDistrict?: string | null;
  destinationState?: string | null;
  requestedDate: string;
  requiredCapacityQuintals: number;
  status: TransportStatus;
  vehicleId?: string | null;
  vehicleRegistrationNumber?: string | null;
  vehicleCapacityQuintals?: number | null;
  vehicleType?: string | null;
  transporterId?: string | null;
  transporterName?: string | null;
  transporterCode?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  assignedAt?: string | null;
  dispatchedAt?: string | null;
  arrivedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  deliveryReceiverName?: string | null;
  deliveryReceiverDesignation?: string | null;
  deliveryRemarks?: string | null;
  metadata?: Record<string, unknown> | null;
  loads?: TransportLoadDTO[];
  createdAt?: string;
  updatedAt?: string;
}

// ------------------------------------------------------------------------------
// PHASE 5: NOTIFICATIONS
// ------------------------------------------------------------------------------

export type NotificationType =
  | 'SYSTEM'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_SLOT_APPROACHING'
  | 'GATE_CHECKIN'
  | 'QUALITY_COMPLETED'
  | 'QUALITY_REVIEW_REQUIRED'
  | 'WEIGHMENT_COMPLETED'
  | 'SETTLEMENT_CREATED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_RETRY_SUCCESS'
  | 'TRANSPORT_ASSIGNED'
  | 'TRANSPORT_DISPATCHED'
  | 'TRANSPORT_ARRIVED'
  | 'TRANSPORT_DELIVERED';

export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface NotificationDTO {
  id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  channel: string;
  isRead: boolean;
  sentStatus: string;
  entityType?: string | null;
  entityId?: string | null;
  reference?: string | null;
  metadata?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateNotificationDTO {
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  channel?: string;
  entityType?: string | null;
  entityId?: string | null;
  reference?: string | null;
  metadata?: Record<string, unknown> | null;
}

// ------------------------------------------------------------------------------
// PHASE 5: DASHBOARDS
// ------------------------------------------------------------------------------

export type LifecycleStage =
  | 'BOOKED'
  | 'CHECKED_IN'
  | 'QUALITY'
  | 'WEIGHED'
  | 'PROCURED'
  | 'PAID'
  | 'DELIVERED'
  | 'CANCELLED';

export interface FarmerBookingSummaryDTO {
  bookingId: string;
  bookingNumber: string;
  bookingDate: string;
  cropName: string;
  cropCode: string;
  centerName: string;
  centerCode: string;
  slotTime: string;
  estimatedQuantityQuintals: number;
  lockedRatePerQuintal: number;
  tokenNumber: string;
  status: BookingStatus;
  lifecycleStage: LifecycleStage;
  inspection?: {
    status: string;
    finalGrade: string;
    moisturePercentage: number;
    effectiveRate: number;
  } | null;
  weighment?: {
    grossWeight: number;
    tareWeight: number;
    netWeight: number;
    finalPayableAmount: number;
  } | null;
  settlement?: {
    settlementReference: string;
    grossAmount: number;
    deductions: number;
    netPayableAmount: number;
    status: SettlementStatus;
  } | null;
  payment?: {
    paymentReference: string;
    amountInr: number;
    status: PaymentStatus;
    utrNumber?: string | null;
    disbursedAt?: string | null;
  } | null;
  transport?: {
    requestReference: string;
    status: TransportStatus;
    vehicleRegistration?: string | null;
    dispatchedAt?: string | null;
    deliveredAt?: string | null;
  } | null;
}

export interface FarmerDashboardDTO {
  farmer: {
    id: string;
    userId: string;
    fullName: string;
    phone: string;
    primaryDistrict: string;
    primaryState: string;
    profileCompletionPercentage: number;
    isLandVerified: boolean;
  };
  crops: {
    totalRegistered: number;
    activeCount: number;
    crops: Array<{
      id: string;
      cropName: string;
      cropCode: string;
      season: string;
      cultivatedArea: number;
      expectedYield?: number | null;
      status: string;
    }>;
  };
  bookings: {
    totalBookings: number;
    activeBooking: FarmerBookingSummaryDTO | null;
    upcomingBookings: FarmerBookingSummaryDTO[];
    bookingHistory: FarmerBookingSummaryDTO[];
  };
  procurement: {
    totalProcuredQuintals: number;
    totalProcurementValueInr: number;
    completedProcurements: Array<{
      bookingId: string;
      cropName: string;
      netQuantityQuintals: number;
      lockedMspRate: number;
      qualityGrade: string;
      deductionsInr: number;
      effectiveRatePerQuintal: number;
      finalProcurementValueInr: number;
      completedAt: string;
    }>;
  };
  payments: {
    totalSettlementAmountInr: number;
    totalPaidInr: number;
    pendingAmountInr: number;
    disbursementCount: number;
    latestUtrNumber?: string | null;
    latestPaymentDate?: string | null;
  };
  transport: {
    totalShipments: number;
    inTransitCount: number;
    deliveredCount: number;
    activeShipments: Array<{
      transportRequestId: string;
      requestReference: string;
      bookingNumber: string;
      cropName: string;
      quantityQuintals: number;
      status: TransportStatus;
      vehicleRegistration?: string | null;
      destinationName: string;
      dispatchedAt?: string | null;
      deliveredAt?: string | null;
    }>;
  };
}

export interface CenterDashboardDTO {
  center: {
    id: string;
    code: string;
    name: string;
    district: string;
    state: string;
    totalBays: number;
    dailyCapacityQuintals: number;
    isActive: boolean;
  };
  todayOperations: {
    date: string;
    totalBookings: number;
    checkedIn: number;
    waitingQueue: number;
    processing: number;
    completed: number;
    cancelled: number;
  };
  capacity: {
    totalDailyCapacityQuintals: number;
    allocatedCapacityQuintals: number;
    remainingCapacityQuintals: number;
    utilizationPercentage: number;
  };
  slots: {
    totalSlotsToday: number;
    bookedSlotsCount: number;
    fullSlotsCount: number;
    availableSlotsCount: number;
    nextAvailableSlotTime?: string | null;
  };
  quality: {
    totalInspections: number;
    passed: number;
    failed: number;
    reviewRequired: number;
    averageMoisturePercentage: number;
    gradeDistribution: {
      gradeA: number;
      gradeB: number;
      gradeC: number;
      belowFaq: number;
    };
  };
  weighment: {
    totalWeighmentsCount: number;
    totalQuantityProcessedQuintals: number;
    pendingWeighmentsCount: number;
  };
  procurement: {
    totalProcuredQuantityQuintals: number;
    totalProcurementValueInr: number;
    cropBreakdown: Array<{
      cropId: string;
      cropName: string;
      cropCode: string;
      quantityQuintals: number;
      totalValueInr: number;
    }>;
  };
  payments: {
    settlementsCreatedCount: number;
    totalSettlementAmountInr: number;
    successfulPaymentsCount: number;
    successfulAmountInr: number;
    pendingPaymentsCount: number;
    failedPaymentsCount: number;
  };
  transport: {
    totalRequestsCount: number;
    dispatchedCount: number;
    inTransitCount: number;
    deliveredCount: number;
  };
}

export interface AdminDashboardDTO {
  farmers: {
    totalFarmers: number;
    activeFarmers: number;
    farmersWithRegisteredCrops: number;
  };
  crops: {
    totalRegistrations: number;
    totalCultivatedAreaAcres: number;
    cropVolumes: Array<{
      cropId: string;
      cropName: string;
      cropCode: string;
      registrationsCount: number;
      totalAreaAcres: number;
      expectedYieldQuintals: number;
    }>;
  };
  procurement: {
    totalBookings: number;
    completedProcurementsCount: number;
    totalQuantityQuintals: number;
    totalProcurementValueInr: number;
  };
  msp: {
    activeRatesCount: number;
    cropWiseExposure: Array<{
      cropId: string;
      cropName: string;
      mspRate: number;
      bookedQuantityQuintals: number;
      financialExposureInr: number;
    }>;
  };
  quality: {
    totalInspections: number;
    passCount: number;
    moistureFailuresCount: number;
    reviewRequiredCount: number;
    gradeDistribution: {
      gradeA: number;
      gradeB: number;
      gradeC: number;
      belowFaq: number;
    };
  };
  payments: {
    totalSettlementsCount: number;
    totalGrossAmountInr: number;
    totalDeductionsInr: number;
    totalPayableAmountInr: number;
    totalDisbursedAmountInr: number;
    totalPendingAmountInr: number;
    successfulPaymentsCount: number;
    failedPaymentsCount: number;
    paymentSuccessRatePercentage: number;
  };
  logistics: {
    totalTransportRequests: number;
    requestedCount: number;
    assignedCount: number;
    loadedCount: number;
    dispatchedCount: number;
    inTransitCount: number;
    arrivedCount: number;
    deliveredCount: number;
    cancelledCount: number;
    totalQuantityMovedQuintals: number;
  };
  centers: {
    totalCenters: number;
    activeCenters: number;
    averageCapacityUtilizationPercentage: number;
    centerProcurementLeaderboard: Array<{
      centerId: string;
      centerName: string;
      district: string;
      state: string;
      procuredQuantityQuintals: number;
      procurementValueInr: number;
      utilizationPercentage: number;
    }>;
  };
}

// ------------------------------------------------------------------------------
// PHASE 5: REPORTS
// ------------------------------------------------------------------------------

export interface ProcurementReportDTO {
  summary: {
    totalBookings: number;
    completedProcurements: number;
    totalQuantityQuintals: number;
    totalProcurementValueInr: number;
    averageRatePerQuintal: number;
  };
  qualityGradeDistribution: {
    gradeA: { count: number; quantityQuintals: number };
    gradeB: { count: number; quantityQuintals: number };
    gradeC: { count: number; quantityQuintals: number };
    belowFaq: { count: number; quantityQuintals: number };
  };
  cropBreakdown: Array<{
    cropId: string;
    cropName: string;
    cropCode: string;
    quantityQuintals: number;
    procurementValueInr: number;
    averageRatePerQuintal: number;
  }>;
  centerBreakdown: Array<{
    centerId: string;
    centerName: string;
    centerCode: string;
    district: string;
    quantityQuintals: number;
    procurementValueInr: number;
  }>;
  records: Array<{
    bookingId: string;
    bookingNumber: string;
    date: string;
    farmerName: string;
    cropName: string;
    centerName: string;
    quantityQuintals: number;
    lockedRate: number;
    effectiveRate: number;
    totalValueInr: number;
    grade: string;
  }>;
}

export interface PaymentReportDTO {
  summary: {
    totalSettlements: number;
    totalGrossAmountInr: number;
    totalDeductionsInr: number;
    totalNetPayableInr: number;
    totalPaidInr: number;
    totalPendingInr: number;
    totalFailedInr: number;
    paymentCount: number;
    successfulPaymentsCount: number;
    failedPaymentsCount: number;
    successRatePercentage: number;
  };
  cropTotals: Array<{
    cropId: string;
    cropName: string;
    settlementsCount: number;
    totalAmountInr: number;
    paidAmountInr: number;
  }>;
  centerTotals: Array<{
    centerId: string;
    centerName: string;
    settlementsCount: number;
    totalAmountInr: number;
    paidAmountInr: number;
  }>;
  records: Array<{
    settlementId: string;
    settlementReference: string;
    bookingNumber: string;
    farmerName: string;
    cropName: string;
    grossAmount: number;
    deductions: number;
    netAmount: number;
    paymentStatus: string;
    utrNumber?: string | null;
    disbursedAt?: string | null;
  }>;
}

export interface QualityReportDTO {
  summary: {
    totalInspections: number;
    passedCount: number;
    failedCount: number;
    reviewRequiredCount: number;
    passRatePercentage: number;
    averageMoisturePercentage: number;
    standardMoistureLimit: number;
  };
  gradeDistribution: {
    gradeA: number;
    gradeB: number;
    gradeC: number;
    belowFaq: number;
  };
  cropStats: Array<{
    cropId: string;
    cropName: string;
    inspectionCount: number;
    passCount: number;
    failCount: number;
    averageMoisturePercentage: number;
  }>;
  centerStats: Array<{
    centerId: string;
    centerName: string;
    inspectionCount: number;
    passCount: number;
    failCount: number;
    averageMoisturePercentage: number;
  }>;
  records: Array<{
    inspectionId: string;
    sampleReference: string;
    bookingNumber: string;
    cropName: string;
    moisturePercentage: number;
    standardLimit: number;
    isMoisturePass: boolean;
    aiPredictedGrade: string;
    finalGrade: string;
    isHumanVerified: boolean;
    effectiveRate: number;
    status: string;
    inspectedAt: string;
  }>;
}

export interface LogisticsReportDTO {
  summary: {
    totalRequests: number;
    requested: number;
    assigned: number;
    loaded: number;
    dispatched: number;
    inTransit: number;
    arrived: number;
    delivered: number;
    cancelled: number;
    totalQuantityMovedQuintals: number;
    deliverySuccessRatePercentage: number;
  };
  cropMovement: Array<{
    cropId: string;
    cropName: string;
    totalQuantityQuintals: number;
    shipmentCount: number;
  }>;
  centerMovement: Array<{
    sourceCenterId: string;
    sourceCenterName: string;
    totalQuantityQuintals: number;
    shipmentCount: number;
  }>;
  destinationMovement: Array<{
    destinationName: string;
    destinationType: string;
    totalQuantityQuintals: number;
    shipmentCount: number;
  }>;
  records: Array<{
    transportRequestId: string;
    requestReference: string;
    bookingNumber: string;
    sourceCenter: string;
    destinationName: string;
    cropName: string;
    quantityQuintals: number;
    vehicleRegistration?: string | null;
    transporterName?: string | null;
    status: TransportStatus;
    dispatchedAt?: string | null;
    deliveredAt?: string | null;
  }>;
}

export interface CenterPerformanceReportDTO {
  centers: Array<{
    centerId: string;
    centerCode: string;
    centerName: string;
    district: string;
    state: string;
    totalCapacityQuintals: number;
    totalBookingsCount: number;
    completedProcurementCount: number;
    procuredQuantityQuintals: number;
    procurementValueInr: number;
    capacityUtilizationPercentage: number;
    qualityPassRatePercentage: number;
    paymentCompletionRatePercentage: number;
    transportCompletionRatePercentage: number;
    averageProcessingMinutes?: number | null;
  }>;
}

// ------------------------------------------------------------------------------
// FREE / OPEN-DATA INTEGRATION TYPES (PHASE 7 INTEGRATION MIGRATION)
// ------------------------------------------------------------------------------

export interface WeatherCurrentDTO {
  temperature: number;
  apparentTemperature: number;
  relativeHumidity: number;
  precipitation: number;
  rainfall: number;
  windSpeed: number;
  weatherCode: number;
  condition: string;
  isDay?: boolean;
  rainProbability?: number;
}

export interface WeatherDailyForecastDTO {
  date: string;
  weatherCode: number;
  condition: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
}

export interface WeatherDataDTO {
  latitude: number;
  longitude: number;
  timezone: string;
  locationName?: string;
  advisory?: string;
  elevation?: number;
  provider: 'open-meteo' | 'fallback';
  isFallback: boolean;
  current: WeatherCurrentDTO;
  dailyForecast?: WeatherDailyForecastDTO[];
  fetchedAt: string;
}

export interface TranslationRequestDTO {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface TranslationResponseDTO {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  provider: 'gemini' | 'fallback';
  characterCount: number;
  translatedAt: string;
}

export interface SupportedLanguageDTO {
  code: string;
  name: string;
  nativeName: string;
}

export interface MandiPrice {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety?: string;
  arrivalDate?: string;
  minPrice?: number;
  maxPrice?: number;
  modalPrice?: number;
}

export interface MandiPriceResponseDTO {
  source: 'DATA_GOV_IN' | 'DEMO_MANDI_FALLBACK';
  isSimulated: boolean;
  providerStatus: 'REAL' | 'NOT_CONFIGURED' | 'MOCK' | 'UNAVAILABLE';
  totalRecords: number;
  records: MandiPrice[];
  lastUpdated: string;
}

export interface KCCAdvisoryDTO {
  id: string;
  state: string;
  district: string;
  month?: string;
  crop?: string;
  categorySubject?: string;
  farmerQuery: string;
  responseAdvice: string;
  source: 'DATA_GOV_IN' | 'DEMO_KCC_FALLBACK';
  createdAt?: string;
}

export interface KCCVerificationResultDTO {
  kccNumber: string;
  isValid: boolean;
  farmerName?: string;
  issuingBank?: string;
  sanctionedCreditLimitInr?: number;
  availableCreditInr?: number;
  cardStatus: 'ACTIVE' | 'EXPIRED' | 'BLOCKED' | 'NOT_FOUND';
  verifiedAt: string;
  isSimulated: boolean;
}

export type IntegrationStatusType =
  | 'REAL'
  | 'SIMULATION'
  | 'MOCK'
  | 'NOT_CONFIGURED'
  | 'UNAVAILABLE'
  | 'EXISTING_CONFIGURATION';

export interface ProviderIntegrationItem {
  name: string;
  serviceType: string;
  status: IntegrationStatusType;
  provider: string;
  requiresApiKey: boolean;
  isConfigured: boolean;
  endpointUrl?: string;
  description: string;
}

export interface ProviderStatusResponseDTO {
  timestamp: string;
  providers: {
    weather: ProviderIntegrationItem;
    translation: ProviderIntegrationItem;
    mandi: ProviderIntegrationItem;
    dbt: ProviderIntegrationItem;
    kcc: ProviderIntegrationItem;
    dilrmp: ProviderIntegrationItem;
    razorpay: ProviderIntegrationItem;
  };
}


