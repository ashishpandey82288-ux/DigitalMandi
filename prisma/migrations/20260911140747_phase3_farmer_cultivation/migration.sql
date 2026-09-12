-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FARMER', 'CENTER_OPERATOR', 'QUALITY_INSPECTOR', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN', 'IN_QUEUE', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ProcurementStatus" AS ENUM ('PENDING', 'VERIFIED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CropSeason" AS ENUM ('KHARIF', 'RABI', 'ZAID');

-- CreateEnum
CREATE TYPE "CropQualityGrade" AS ENUM ('GRADE_A', 'GRADE_B', 'GRADE_C', 'BELOW_FAQ');

-- CreateEnum
CREATE TYPE "QueuePriority" AS ENUM ('NORMAL', 'PERISHABLE_EMERGENCY', 'SENIOR_FARMER', 'RESCHEDULED_PRIORITY');

-- CreateEnum
CREATE TYPE "BayStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "AnomalyType" AS ENUM ('PRICE_MANIPULATION', 'DUPLICATE_LAND_PARCEL', 'ABNORMAL_YIELD_CLAIM', 'RAPID_CONSECUTIVE_BOOKINGS', 'WEIGHT_TAMPERING_SUSPECTED');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'WHATSAPP', 'SMS', 'IVR');

-- CreateEnum
CREATE TYPE "LandAreaUnit" AS ENUM ('ACRE', 'HECTARE');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('OWNED', 'LEASED', 'SHARED');

-- CreateEnum
CREATE TYPE "FarmVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "FarmerCropStatus" AS ENUM ('PLANNED', 'SOWN', 'GROWING', 'READY_FOR_HARVEST', 'HARVESTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'FARMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "operatorCenterId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT,
    "alternatePhone" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "address" TEXT,
    "village" TEXT,
    "aadhaarHash" TEXT,
    "kisanCreditCard" TEXT,
    "pmKisanId" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "primaryDistrict" TEXT NOT NULL,
    "primaryState" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'hi',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "farmerProfileId" TEXT NOT NULL,
    "farmName" TEXT,
    "landParcelNumber" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "totalAreaAcres" DECIMAL(10,2) NOT NULL,
    "landAreaUnit" "LandAreaUnit" NOT NULL DEFAULT 'ACRE',
    "ownershipType" "OwnershipType" NOT NULL DEFAULT 'OWNED',
    "verifiedArea" DECIMAL(10,2),
    "isLandVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "FarmVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "soilType" TEXT,
    "irrigationType" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerCrop" (
    "id" TEXT NOT NULL,
    "farmerProfileId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "season" "CropSeason" NOT NULL,
    "sowingDate" TIMESTAMP(3),
    "expectedHarvestDate" TIMESTAMP(3),
    "cultivatedArea" DECIMAL(10,2) NOT NULL,
    "areaUnit" "LandAreaUnit" NOT NULL DEFAULT 'ACRE',
    "expectedYield" DECIMAL(10,2),
    "yieldUnit" TEXT NOT NULL DEFAULT 'QUINTAL',
    "status" "FarmerCropStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmerCrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "standardMoistureLimit" DECIMAL(5,2) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MSPRate" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "season" "CropSeason" NOT NULL,
    "marketingYear" INTEGER NOT NULL,
    "ratePerQuintal" DECIMAL(10,2) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "bonusPerQuintal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MSPRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementCenter" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationAddress" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "dailyCapacityQuintals" DECIMAL(12,2) NOT NULL,
    "slotDurationMinutes" INTEGER NOT NULL DEFAULT 90,
    "operatingHoursStart" TEXT NOT NULL DEFAULT '08:00',
    "operatingHoursEnd" TEXT NOT NULL DEFAULT '18:00',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCenterAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "procurementCenterId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCenterAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterBay" (
    "id" TEXT NOT NULL,
    "procurementCenterId" TEXT NOT NULL,
    "bayNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "capacityQuintals" DECIMAL(10,2) NOT NULL,
    "status" "BayStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CenterBay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSlot" (
    "id" TEXT NOT NULL,
    "procurementCenterId" TEXT NOT NULL,
    "slotDate" DATE NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "maxCapacityQuintals" DECIMAL(10,2) NOT NULL,
    "bookedCapacityQuintals" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "farmerProfileId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "procurementCenterId" TEXT NOT NULL,
    "bookingSlotId" TEXT NOT NULL,
    "lockedMspRateId" TEXT NOT NULL,
    "lockedRatePerQuintal" DECIMAL(10,2) NOT NULL,
    "estimatedQuantityQuintals" DECIMAL(10,2) NOT NULL,
    "securePin" TEXT NOT NULL,
    "qrCodeSignature" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateCheckin" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "procurementCenterId" TEXT NOT NULL,
    "checkinTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleNumber" TEXT NOT NULL,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "gatePassToken" TEXT NOT NULL,
    "isVerifiedByGuard" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GateCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "procurementCenterId" TEXT NOT NULL,
    "tokenNumber" INTEGER NOT NULL,
    "queuePriority" "QueuePriority" NOT NULL DEFAULT 'NORMAL',
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "BookingStatus" NOT NULL DEFAULT 'IN_QUEUE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BayAssignment" (
    "id" TEXT NOT NULL,
    "queueEntryId" TEXT NOT NULL,
    "centerBayId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unloadingStartedAt" TIMESTAMP(3),
    "unloadingEndedAt" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BayAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropGrading" (
    "id" TEXT NOT NULL,
    "sampleReference" TEXT NOT NULL,
    "aiModelVersion" TEXT NOT NULL,
    "qualityGrade" "CropQualityGrade" NOT NULL,
    "moisturePercentage" DECIMAL(5,2) NOT NULL,
    "foreignMatterPercentage" DECIMAL(5,2) NOT NULL,
    "grainDamagePercentage" DECIMAL(5,2) NOT NULL,
    "inferenceConfidence" DECIMAL(5,4) NOT NULL,
    "sampleImageUrl" TEXT,
    "isApprovedByOfficer" BOOLEAN NOT NULL DEFAULT false,
    "officerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CropGrading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementTransaction" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "procurementCenterId" TEXT NOT NULL,
    "cropGradingId" TEXT,
    "grossWeightQuintals" DECIMAL(10,2) NOT NULL,
    "tareWeightQuintals" DECIMAL(10,2) NOT NULL,
    "netWeightQuintals" DECIMAL(10,2) NOT NULL,
    "applicableRatePerQuintal" DECIMAL(10,2) NOT NULL,
    "totalPayableAmount" DECIMAL(12,2) NOT NULL,
    "status" "ProcurementStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "procurementTransactionId" TEXT NOT NULL,
    "farmerProfileId" TEXT NOT NULL,
    "amountInr" DECIMAL(12,2) NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'DBT_PFMS',
    "bankAccountNumber" TEXT,
    "ifscCode" TEXT,
    "utrNumber" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherData" (
    "id" TEXT NOT NULL,
    "procurementCenterId" TEXT NOT NULL,
    "recordedDate" DATE NOT NULL,
    "temperatureCelsius" DECIMAL(5,2) NOT NULL,
    "humidityPercentage" DECIMAL(5,2) NOT NULL,
    "rainfallMm" DECIMAL(6,2) NOT NULL,
    "weatherCondition" TEXT NOT NULL,
    "dataSource" TEXT NOT NULL DEFAULT 'IMD_API',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadForecast" (
    "id" TEXT NOT NULL,
    "procurementCenterId" TEXT NOT NULL,
    "forecastDate" DATE NOT NULL,
    "predictedArrivalQuintals" DECIMAL(12,2) NOT NULL,
    "confidenceIntervalLow" DECIMAL(12,2) NOT NULL,
    "confidenceIntervalHigh" DECIMAL(12,2) NOT NULL,
    "modelName" TEXT NOT NULL DEFAULT 'ARIMA-Load-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoadForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceForecast" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "forecastMonth" DATE NOT NULL,
    "predictedMarketPrice" DECIMAL(10,2) NOT NULL,
    "trendDirection" TEXT NOT NULL,
    "modelName" TEXT NOT NULL DEFAULT 'RandomForest-Price-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anomaly" (
    "id" TEXT NOT NULL,
    "type" "AnomalyType" NOT NULL,
    "severity" "AnomalySeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "relatedEntityType" TEXT NOT NULL,
    "relatedEntityId" TEXT NOT NULL,
    "detectedByModel" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "sentStatus" TEXT NOT NULL DEFAULT 'DELIVERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "disputeNumber" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "procurementTransactionId" TEXT,
    "category" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "sequenceNumber" BIGSERIAL NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL,
    "previousHash" TEXT NOT NULL,
    "currentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "FarmerProfile_userId_key" ON "FarmerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FarmerProfile_aadhaarHash_key" ON "FarmerProfile"("aadhaarHash");

-- CreateIndex
CREATE INDEX "FarmerProfile_primaryDistrict_primaryState_idx" ON "FarmerProfile"("primaryDistrict", "primaryState");

-- CreateIndex
CREATE INDEX "Farm_farmerProfileId_idx" ON "Farm"("farmerProfileId");

-- CreateIndex
CREATE INDEX "Farm_district_state_idx" ON "Farm"("district", "state");

-- CreateIndex
CREATE INDEX "FarmerCrop_farmerProfileId_idx" ON "FarmerCrop"("farmerProfileId");

-- CreateIndex
CREATE INDEX "FarmerCrop_farmId_idx" ON "FarmerCrop"("farmId");

-- CreateIndex
CREATE INDEX "FarmerCrop_cropId_idx" ON "FarmerCrop"("cropId");

-- CreateIndex
CREATE INDEX "FarmerCrop_season_status_idx" ON "FarmerCrop"("season", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_name_key" ON "Crop"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_code_key" ON "Crop"("code");

-- CreateIndex
CREATE INDEX "Crop_name_idx" ON "Crop"("name");

-- CreateIndex
CREATE INDEX "MSPRate_cropId_isActive_idx" ON "MSPRate"("cropId", "isActive");

-- CreateIndex
CREATE INDEX "MSPRate_effectiveDate_expiryDate_idx" ON "MSPRate"("effectiveDate", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "MSPRate_cropId_season_marketingYear_key" ON "MSPRate"("cropId", "season", "marketingYear");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementCenter_code_key" ON "ProcurementCenter"("code");

-- CreateIndex
CREATE INDEX "ProcurementCenter_district_state_idx" ON "ProcurementCenter"("district", "state");

-- CreateIndex
CREATE INDEX "ProcurementCenter_isActive_idx" ON "ProcurementCenter"("isActive");

-- CreateIndex
CREATE INDEX "UserCenterAssignment_userId_idx" ON "UserCenterAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserCenterAssignment_procurementCenterId_idx" ON "UserCenterAssignment"("procurementCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCenterAssignment_userId_procurementCenterId_key" ON "UserCenterAssignment"("userId", "procurementCenterId");

-- CreateIndex
CREATE INDEX "CenterBay_procurementCenterId_status_idx" ON "CenterBay"("procurementCenterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CenterBay_procurementCenterId_bayNumber_key" ON "CenterBay"("procurementCenterId", "bayNumber");

-- CreateIndex
CREATE INDEX "BookingSlot_procurementCenterId_slotDate_idx" ON "BookingSlot"("procurementCenterId", "slotDate");

-- CreateIndex
CREATE INDEX "BookingSlot_startTime_endTime_idx" ON "BookingSlot"("startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNumber_key" ON "Booking"("bookingNumber");

-- CreateIndex
CREATE INDEX "Booking_farmerProfileId_idx" ON "Booking"("farmerProfileId");

-- CreateIndex
CREATE INDEX "Booking_procurementCenterId_status_idx" ON "Booking"("procurementCenterId", "status");

-- CreateIndex
CREATE INDEX "Booking_bookingNumber_idx" ON "Booking"("bookingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GateCheckin_bookingId_key" ON "GateCheckin"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "GateCheckin_gatePassToken_key" ON "GateCheckin"("gatePassToken");

-- CreateIndex
CREATE INDEX "GateCheckin_procurementCenterId_checkinTime_idx" ON "GateCheckin"("procurementCenterId", "checkinTime");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_bookingId_key" ON "QueueEntry"("bookingId");

-- CreateIndex
CREATE INDEX "QueueEntry_procurementCenterId_status_queuePriority_idx" ON "QueueEntry"("procurementCenterId", "status", "queuePriority");

-- CreateIndex
CREATE INDEX "QueueEntry_tokenNumber_idx" ON "QueueEntry"("tokenNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BayAssignment_queueEntryId_key" ON "BayAssignment"("queueEntryId");

-- CreateIndex
CREATE INDEX "BayAssignment_centerBayId_isCompleted_idx" ON "BayAssignment"("centerBayId", "isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "CropGrading_sampleReference_key" ON "CropGrading"("sampleReference");

-- CreateIndex
CREATE INDEX "CropGrading_qualityGrade_idx" ON "CropGrading"("qualityGrade");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementTransaction_transactionNumber_key" ON "ProcurementTransaction"("transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementTransaction_bookingId_key" ON "ProcurementTransaction"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementTransaction_cropGradingId_key" ON "ProcurementTransaction"("cropGradingId");

-- CreateIndex
CREATE INDEX "ProcurementTransaction_procurementCenterId_status_idx" ON "ProcurementTransaction"("procurementCenterId", "status");

-- CreateIndex
CREATE INDEX "ProcurementTransaction_transactionNumber_idx" ON "ProcurementTransaction"("transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentReference_key" ON "Payment"("paymentReference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_procurementTransactionId_key" ON "Payment"("procurementTransactionId");

-- CreateIndex
CREATE INDEX "Payment_farmerProfileId_status_idx" ON "Payment"("farmerProfileId", "status");

-- CreateIndex
CREATE INDEX "Payment_paymentReference_idx" ON "Payment"("paymentReference");

-- CreateIndex
CREATE INDEX "WeatherData_procurementCenterId_recordedDate_idx" ON "WeatherData"("procurementCenterId", "recordedDate");

-- CreateIndex
CREATE INDEX "LoadForecast_procurementCenterId_forecastDate_idx" ON "LoadForecast"("procurementCenterId", "forecastDate");

-- CreateIndex
CREATE INDEX "PriceForecast_cropId_forecastMonth_idx" ON "PriceForecast"("cropId", "forecastMonth");

-- CreateIndex
CREATE INDEX "Anomaly_type_severity_isResolved_idx" ON "Anomaly"("type", "severity", "isResolved");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_disputeNumber_key" ON "Dispute"("disputeNumber");

-- CreateIndex
CREATE INDEX "Dispute_farmerId_status_idx" ON "Dispute"("farmerId", "status");

-- CreateIndex
CREATE INDEX "AuditEvent_sequenceNumber_idx" ON "AuditEvent"("sequenceNumber");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

-- CreateIndex
CREATE INDEX "AuditEvent_timestamp_idx" ON "AuditEvent"("timestamp");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_operatorCenterId_fkey" FOREIGN KEY ("operatorCenterId") REFERENCES "ProcurementCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerProfile" ADD CONSTRAINT "FarmerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_farmerProfileId_fkey" FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerCrop" ADD CONSTRAINT "FarmerCrop_farmerProfileId_fkey" FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerCrop" ADD CONSTRAINT "FarmerCrop_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerCrop" ADD CONSTRAINT "FarmerCrop_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MSPRate" ADD CONSTRAINT "MSPRate_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCenterAssignment" ADD CONSTRAINT "UserCenterAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCenterAssignment" ADD CONSTRAINT "UserCenterAssignment_procurementCenterId_fkey" FOREIGN KEY ("procurementCenterId") REFERENCES "ProcurementCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterBay" ADD CONSTRAINT "CenterBay_procurementCenterId_fkey" FOREIGN KEY ("procurementCenterId") REFERENCES "ProcurementCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSlot" ADD CONSTRAINT "BookingSlot_procurementCenterId_fkey" FOREIGN KEY ("procurementCenterId") REFERENCES "ProcurementCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_farmerProfileId_fkey" FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_procurementCenterId_fkey" FOREIGN KEY ("procurementCenterId") REFERENCES "ProcurementCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookingSlotId_fkey" FOREIGN KEY ("bookingSlotId") REFERENCES "BookingSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_lockedMspRateId_fkey" FOREIGN KEY ("lockedMspRateId") REFERENCES "MSPRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateCheckin" ADD CONSTRAINT "GateCheckin_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateCheckin" ADD CONSTRAINT "GateCheckin_procurementCenterId_fkey" FOREIGN KEY ("procurementCenterId") REFERENCES "ProcurementCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_procurementCenterId_fkey" FOREIGN KEY ("procurementCenterId") REFERENCES "ProcurementCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BayAssignment" ADD CONSTRAINT "BayAssignment_queueEntryId_fkey" FOREIGN KEY ("queueEntryId") REFERENCES "QueueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BayAssignment" ADD CONSTRAINT "BayAssignment_centerBayId_fkey" FOREIGN KEY ("centerBayId") REFERENCES "CenterBay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementTransaction" ADD CONSTRAINT "ProcurementTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementTransaction" ADD CONSTRAINT "ProcurementTransaction_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementTransaction" ADD CONSTRAINT "ProcurementTransaction_procurementCenterId_fkey" FOREIGN KEY ("procurementCenterId") REFERENCES "ProcurementCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementTransaction" ADD CONSTRAINT "ProcurementTransaction_cropGradingId_fkey" FOREIGN KEY ("cropGradingId") REFERENCES "CropGrading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_procurementTransactionId_fkey" FOREIGN KEY ("procurementTransactionId") REFERENCES "ProcurementTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_farmerProfileId_fkey" FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherData" ADD CONSTRAINT "WeatherData_procurementCenterId_fkey" FOREIGN KEY ("procurementCenterId") REFERENCES "ProcurementCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadForecast" ADD CONSTRAINT "LoadForecast_procurementCenterId_fkey" FOREIGN KEY ("procurementCenterId") REFERENCES "ProcurementCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceForecast" ADD CONSTRAINT "PriceForecast_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_procurementTransactionId_fkey" FOREIGN KEY ("procurementTransactionId") REFERENCES "ProcurementTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
