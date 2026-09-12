# KisanFlow — Complete Prisma PostgreSQL Schema

> **Note**: In AI Studio's web file explorer, `.prisma` files are not clickable because the web editor only binds click handlers to web formats (`.md`, `.txt`, `.ts`, `.json`).
> This file is a direct mirror of `prisma/schema.prisma` so you can view, click, and edit the complete schema directly inside the AI Studio editor.

```prisma
// ==============================================================================
// KisanFlow — Prisma PostgreSQL Complete Schema (Phase 1 Foundation)
// Smart Procurement & Direct MSP Engine | Smart India Hackathon 2026
// ==============================================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ------------------------------------------------------------------------------
// ENUMS
// ------------------------------------------------------------------------------

enum UserRole {
  FARMER
  CENTER_OPERATOR
  QUALITY_INSPECTOR
  GOVERNMENT_ADMIN
  SUPER_ADMIN
}

enum BookingStatus {
  PENDING
  CONFIRMED
  RESCHEDULED
  CHECKED_IN
  IN_QUEUE
  PROCESSING
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCESS
  FAILED
}

enum ProcurementStatus {
  PENDING
  VERIFIED
  COMPLETED
  REJECTED
}

enum CropSeason {
  KHARIF
  RABI
  ZAID
}

enum CropQualityGrade {
  GRADE_A
  GRADE_B
  GRADE_C
  BELOW_FAQ // Below Fair Average Quality
}

enum QueuePriority {
  NORMAL
  PERISHABLE_EMERGENCY
  SENIOR_FARMER
  RESCHEDULED_PRIORITY
}

enum BayStatus {
  AVAILABLE
  OCCUPIED
  MAINTENANCE
  OFFLINE
}

enum AnomalyType {
  PRICE_MANIPULATION
  DUPLICATE_LAND_PARCEL
  ABNORMAL_YIELD_CLAIM
  RAPID_CONSECUTIVE_BOOKINGS
  WEIGHT_TAMPERING_SUSPECTED
}

enum AnomalySeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum DisputeStatus {
  OPEN
  UNDER_REVIEW
  RESOLVED
  REJECTED
}

enum NotificationChannel {
  IN_APP
  WHATSAPP
  SMS
  IVR
}

enum LandAreaUnit {
  ACRE
  HECTARE
}

enum OwnershipType {
  OWNED
  LEASED
  SHARED
}

enum FarmVerificationStatus {
  PENDING
  VERIFIED
  FLAGGED
}

enum FarmerCropStatus {
  PLANNED
  SOWN
  GROWING
  READY_FOR_HARVEST
  HARVESTED
}

// ------------------------------------------------------------------------------
// 1. IDENTITY & FARMER PROFILES
// ------------------------------------------------------------------------------

model User {
  id          String   @id @default(uuid())
  firebaseUid String?  @unique
  name        String
  phone       String   @unique
  email       String?  @unique
  role        UserRole @default(FARMER)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  farmerProfile     FarmerProfile?
  operatorCenter    ProcurementCenter?     @relation("CenterOperator", fields: [operatorCenterId], references: [id])
  operatorCenterId  String?
  centerAssignments UserCenterAssignment[]

  notifications  Notification[]
  disputesRaised Dispute[]      @relation("FarmerDisputes")
  auditEvents    AuditEvent[]   @relation("UserAuditEvents")

  @@index([phone])
  @@index([role])
}

model FarmerProfile {
  id     String @id @default(uuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  fullName       String?
  alternatePhone String?
  dateOfBirth    DateTime?
  gender         String?
  address        String?
  village        String?

  aadhaarHash       String? @unique // Stored only as irreversible cryptographic hash for zero-PII exposure
  kisanCreditCard   String? // KCC ID
  pmKisanId         String?
  bankAccountNumber String?
  bankIfsc          String?
  primaryDistrict   String
  primaryState      String
  pincode           String
  preferredLanguage String  @default("hi") // e.g. hi, pa, mr, te, ta, en (Bhashini support)

  farms       Farm[]
  farmerCrops FarmerCrop[]
  bookings    Booking[]
  payments    Payment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([primaryDistrict, primaryState])
}

model Farm {
  id              String        @id @default(uuid())
  farmerProfileId String
  farmerProfile   FarmerProfile @relation(fields: [farmerProfileId], references: [id], onDelete: Cascade)

  farmName           String?
  landParcelNumber   String // DILRMP sync identifier (Survey / Khasra number)
  district           String
  state              String
  village            String
  totalAreaAcres     Decimal                @db.Decimal(10, 2)
  landAreaUnit       LandAreaUnit           @default(ACRE)
  ownershipType      OwnershipType          @default(OWNED)
  verifiedArea       Decimal?               @db.Decimal(10, 2)
  isLandVerified     Boolean                @default(false)
  verificationStatus FarmVerificationStatus @default(PENDING)
  soilType           String?
  irrigationType     String?
  latitude           Decimal?               @db.Decimal(10, 7)
  longitude          Decimal?               @db.Decimal(10, 7)

  farmerCrops FarmerCrop[]
  bookings    Booking[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([farmerProfileId])
  @@index([district, state])
}

model FarmerCrop {
  id                  String           @id @default(uuid())
  farmerProfileId     String
  farmerProfile       FarmerProfile    @relation(fields: [farmerProfileId], references: [id], onDelete: Cascade)
  farmId              String
  farm                Farm             @relation(fields: [farmId], references: [id], onDelete: Cascade)
  cropId              String
  crop                Crop             @relation(fields: [cropId], references: [id], onDelete: Restrict)
  season              CropSeason
  sowingDate          DateTime?
  expectedHarvestDate DateTime?
  cultivatedArea      Decimal          @db.Decimal(10, 2)
  areaUnit            LandAreaUnit     @default(ACRE)
  expectedYield       Decimal?         @db.Decimal(10, 2)
  yieldUnit           String           @default("QUINTAL")
  status              FarmerCropStatus @default(PLANNED)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([farmerProfileId])
  @@index([farmId])
  @@index([cropId])
  @@index([season, status])
}

// ------------------------------------------------------------------------------
// 2. CROPS & MSP RATE ENGINE
// ------------------------------------------------------------------------------

model Crop {
  id                    String  @id @default(uuid())
  name                  String  @unique // e.g., Wheat, Paddy, Mustard, Cotton
  code                  String  @unique // e.g., WHT-01
  category              String // Cereals, Pulses, Oilseeds
  standardMoistureLimit Decimal @db.Decimal(5, 2) // e.g., 12.0%
  description           String?
  isActive              Boolean @default(true)

  mspRates       MSPRate[]
  bookings       Booking[]
  procurements   ProcurementTransaction[]
  priceForecasts PriceForecast[]
  farmerCrops    FarmerCrop[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([name])
}

model MSPRate {
  id              String     @id @default(uuid())
  cropId          String
  crop            Crop       @relation(fields: [cropId], references: [id], onDelete: Restrict)
  season          CropSeason
  marketingYear   Int // e.g., 2026
  ratePerQuintal  Decimal    @db.Decimal(10, 2) // MSP in INR per 100 kg
  effectiveDate   DateTime
  expiryDate      DateTime
  sourceReference String // e.g., "DAC&FW Notification 2025-26/MSP-04"
  bonusPerQuintal Decimal    @default(0) @db.Decimal(10, 2)
  isActive        Boolean    @default(true)

  bookingsLocked Booking[] @relation("LockedMSP")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([cropId, season, marketingYear])
  @@index([cropId, isActive])
  @@index([effectiveDate, expiryDate])
}

// ------------------------------------------------------------------------------
// 3. PROCUREMENT CENTERS, CAPACITY & BAYS
// ------------------------------------------------------------------------------

model ProcurementCenter {
  id                    String  @id @default(uuid())
  code                  String  @unique // e.g., PC-HR-KAR-01
  name                  String
  locationAddress       String
  district              String
  state                 String
  latitude              Decimal @db.Decimal(10, 7)
  longitude             Decimal @db.Decimal(10, 7)
  dailyCapacityQuintals Decimal @db.Decimal(12, 2)
  slotDurationMinutes   Int     @default(90) // Configurable slot duration (default 90 mins)
  operatingHoursStart   String  @default("08:00")
  operatingHoursEnd     String  @default("18:00")
  isActive              Boolean @default(true)

  operators         User[]                   @relation("CenterOperator")
  centerAssignments UserCenterAssignment[]
  bays              CenterBay[]
  bookingSlots      BookingSlot[]
  bookings          Booking[]
  queueEntries      QueueEntry[]
  gateCheckins      GateCheckin[]
  procurements      ProcurementTransaction[]
  weatherRecords    WeatherData[]
  loadForecasts     LoadForecast[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([district, state])
  @@index([isActive])
}

model UserCenterAssignment {
  id                  String            @id @default(uuid())
  userId              String
  user                User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  procurementCenterId String
  procurementCenter   ProcurementCenter @relation(fields: [procurementCenterId], references: [id], onDelete: Cascade)
  role                UserRole // e.g. CENTER_OPERATOR, QUALITY_INSPECTOR
  assignedAt          DateTime          @default(now())

  @@unique([userId, procurementCenterId])
  @@index([userId])
  @@index([procurementCenterId])
}

model CenterBay {
  id                  String            @id @default(uuid())
  procurementCenterId String
  procurementCenter   ProcurementCenter @relation(fields: [procurementCenterId], references: [id], onDelete: Cascade)
  bayNumber           Int // Bay 1, Bay 2, etc.
  name                String // e.g., "Unloading Bay 1 - High Moisture"
  capacityQuintals    Decimal           @db.Decimal(10, 2)
  status              BayStatus         @default(AVAILABLE)
  isActive            Boolean           @default(true)

  bayAssignments BayAssignment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([procurementCenterId, bayNumber])
  @@index([procurementCenterId, status])
}

// ------------------------------------------------------------------------------
// 4. BOOKINGS, SLOTS & "BOOK & LOCK" MSP
// ------------------------------------------------------------------------------

model BookingSlot {
  id                     String            @id @default(uuid())
  procurementCenterId    String
  procurementCenter      ProcurementCenter @relation(fields: [procurementCenterId], references: [id], onDelete: Cascade)
  slotDate               DateTime          @db.Date
  startTime              DateTime
  endTime                DateTime
  maxCapacityQuintals    Decimal           @db.Decimal(10, 2)
  bookedCapacityQuintals Decimal           @default(0) @db.Decimal(10, 2)
  isAvailable            Boolean           @default(true)

  bookings Booking[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([procurementCenterId, slotDate])
  @@index([startTime, endTime])
}

model Booking {
  id                  String            @id @default(uuid())
  bookingNumber       String            @unique // e.g., BK-202609-87421
  farmerProfileId     String
  farmerProfile       FarmerProfile     @relation(fields: [farmerProfileId], references: [id], onDelete: Restrict)
  farmId              String
  farm                Farm              @relation(fields: [farmId], references: [id], onDelete: Restrict)
  cropId              String
  crop                Crop              @relation(fields: [cropId], references: [id], onDelete: Restrict)
  procurementCenterId String
  procurementCenter   ProcurementCenter @relation(fields: [procurementCenterId], references: [id], onDelete: Restrict)
  bookingSlotId       String
  bookingSlot         BookingSlot       @relation(fields: [bookingSlotId], references: [id], onDelete: Restrict)

  // "Book & Lock" MSP Support:
  // Stores the official MSP snapshot at booking time to protect farmer from future price fluctuations
  lockedMspRateId      String
  lockedMspRate        MSPRate @relation("LockedMSP", fields: [lockedMspRateId], references: [id], onDelete: Restrict)
  lockedRatePerQuintal Decimal @db.Decimal(10, 2)

  estimatedQuantityQuintals Decimal       @db.Decimal(10, 2)
  securePin                 String // 6-digit verification PIN
  qrCodeSignature           String // Encrypted/HMAC QR code payload
  status                    BookingStatus @default(CONFIRMED)

  queueEntry  QueueEntry?
  gateCheckin GateCheckin?
  procurement ProcurementTransaction?
  disputes    Dispute[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([farmerProfileId])
  @@index([procurementCenterId, status])
  @@index([bookingNumber])
}

// ------------------------------------------------------------------------------
// 5. ARRIVAL, GATE CHECK-IN, QUEUE & BAY ASSIGNMENT
// ------------------------------------------------------------------------------

model GateCheckin {
  id                  String            @id @default(uuid())
  bookingId           String            @unique
  booking             Booking           @relation(fields: [bookingId], references: [id], onDelete: Restrict)
  procurementCenterId String
  procurementCenter   ProcurementCenter @relation(fields: [procurementCenterId], references: [id], onDelete: Restrict)

  checkinTime       DateTime @default(now())
  vehicleNumber     String // e.g., HR-05-AB-1234
  driverName        String?
  driverPhone       String?
  gatePassToken     String   @unique // Unique thermal pass number
  isVerifiedByGuard Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([procurementCenterId, checkinTime])
}

model QueueEntry {
  id                  String            @id @default(uuid())
  bookingId           String            @unique
  booking             Booking           @relation(fields: [bookingId], references: [id], onDelete: Restrict)
  procurementCenterId String
  procurementCenter   ProcurementCenter @relation(fields: [procurementCenterId], references: [id], onDelete: Restrict)

  tokenNumber   Int // Sequential token for the day
  queuePriority QueuePriority @default(NORMAL)
  enteredAt     DateTime      @default(now())
  calledAt      DateTime?
  completedAt   DateTime?
  status        BookingStatus @default(IN_QUEUE)

  bayAssignment BayAssignment?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([procurementCenterId, status, queuePriority])
  @@index([tokenNumber])
}

model BayAssignment {
  id           String     @id @default(uuid())
  queueEntryId String     @unique
  queueEntry   QueueEntry @relation(fields: [queueEntryId], references: [id], onDelete: Cascade)
  centerBayId  String
  centerBay    CenterBay  @relation(fields: [centerBayId], references: [id], onDelete: Restrict)

  assignedAt         DateTime  @default(now())
  unloadingStartedAt DateTime?
  unloadingEndedAt   DateTime?
  isCompleted        Boolean   @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([centerBayId, isCompleted])
}

// ------------------------------------------------------------------------------
// 6. AI GRADING, WEIGHT & PROCUREMENT TRANSACTION
// ------------------------------------------------------------------------------

model CropGrading {
  id                      String           @id @default(uuid())
  sampleReference         String           @unique // Lab / camera sample batch id
  aiModelVersion          String // e.g., "YOLOv8-AgriGrade-v1.4"
  qualityGrade            CropQualityGrade
  moisturePercentage      Decimal          @db.Decimal(5, 2)
  foreignMatterPercentage Decimal          @db.Decimal(5, 2)
  grainDamagePercentage   Decimal          @db.Decimal(5, 2)
  inferenceConfidence     Decimal          @db.Decimal(5, 4) // e.g., 0.9842
  sampleImageUrl          String?
  isApprovedByOfficer     Boolean          @default(false)
  officerNotes            String?

  procurement ProcurementTransaction?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([qualityGrade])
}

model ProcurementTransaction {
  id                  String            @id @default(uuid())
  transactionNumber   String            @unique // e.g., TXN-PROC-2026-9901
  bookingId           String            @unique
  booking             Booking           @relation(fields: [bookingId], references: [id], onDelete: Restrict)
  cropId              String
  crop                Crop              @relation(fields: [cropId], references: [id], onDelete: Restrict)
  procurementCenterId String
  procurementCenter   ProcurementCenter @relation(fields: [procurementCenterId], references: [id], onDelete: Restrict)
  cropGradingId       String?           @unique
  cropGrading         CropGrading?      @relation(fields: [cropGradingId], references: [id], onDelete: SetNull)

  grossWeightQuintals Decimal @db.Decimal(10, 2)
  tareWeightQuintals  Decimal @db.Decimal(10, 2)
  netWeightQuintals   Decimal @db.Decimal(10, 2)

  applicableRatePerQuintal Decimal           @db.Decimal(10, 2)
  totalPayableAmount       Decimal           @db.Decimal(12, 2)
  status                   ProcurementStatus @default(PENDING)

  payment  Payment?
  disputes Dispute[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([procurementCenterId, status])
  @@index([transactionNumber])
}

// ------------------------------------------------------------------------------
// 7. PAYMENTS & DIRECT BENEFIT TRANSFER (DBT)
// ------------------------------------------------------------------------------

model Payment {
  id                       String                 @id @default(uuid())
  paymentReference         String                 @unique // e.g., PAY-DBT-2026-4431
  procurementTransactionId String                 @unique
  procurementTransaction   ProcurementTransaction @relation(fields: [procurementTransactionId], references: [id], onDelete: Restrict)
  farmerProfileId          String
  farmerProfile            FarmerProfile          @relation(fields: [farmerProfileId], references: [id], onDelete: Restrict)

  amountInr         Decimal       @db.Decimal(12, 2)
  paymentMode       String        @default("DBT_PFMS") // DBT via PFMS / Razorpay
  bankAccountNumber String?
  ifscCode          String?
  utrNumber         String? // Unique Transaction Reference from Bank
  status            PaymentStatus @default(PENDING)
  failureReason     String?
  disbursedAt       DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([farmerProfileId, status])
  @@index([paymentReference])
}

// ------------------------------------------------------------------------------
// 8. FORECASTS, WEATHER & ANOMALIES
// ------------------------------------------------------------------------------

model WeatherData {
  id                  String            @id @default(uuid())
  procurementCenterId String
  procurementCenter   ProcurementCenter @relation(fields: [procurementCenterId], references: [id], onDelete: Cascade)
  recordedDate        DateTime          @db.Date
  temperatureCelsius  Decimal           @db.Decimal(5, 2)
  humidityPercentage  Decimal           @db.Decimal(5, 2)
  rainfallMm          Decimal           @db.Decimal(6, 2)
  weatherCondition    String // Sunny, Rain, Cloudy, Storm
  dataSource          String            @default("IMD_API")

  createdAt DateTime @default(now())

  @@index([procurementCenterId, recordedDate])
}

model LoadForecast {
  id                       String            @id @default(uuid())
  procurementCenterId      String
  procurementCenter        ProcurementCenter @relation(fields: [procurementCenterId], references: [id], onDelete: Cascade)
  forecastDate             DateTime          @db.Date
  predictedArrivalQuintals Decimal           @db.Decimal(12, 2)
  confidenceIntervalLow    Decimal           @db.Decimal(12, 2)
  confidenceIntervalHigh   Decimal           @db.Decimal(12, 2)
  modelName                String            @default("ARIMA-Load-v1")

  createdAt DateTime @default(now())

  @@index([procurementCenterId, forecastDate])
}

model PriceForecast {
  id                   String   @id @default(uuid())
  cropId               String
  crop                 Crop     @relation(fields: [cropId], references: [id], onDelete: Cascade)
  forecastMonth        DateTime @db.Date
  predictedMarketPrice Decimal  @db.Decimal(10, 2)
  trendDirection       String // UPWARD, FLAT, DOWNWARD
  modelName            String   @default("RandomForest-Price-v1")

  createdAt DateTime @default(now())

  @@index([cropId, forecastMonth])
}

model Anomaly {
  id                String          @id @default(uuid())
  type              AnomalyType
  severity          AnomalySeverity
  title             String
  description       String
  relatedEntityType String // "Booking", "FarmerProfile", "ProcurementTransaction"
  relatedEntityId   String
  detectedByModel   String // "IsolationForest-v1"
  isResolved        Boolean         @default(false)
  resolvedByUserId  String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([type, severity, isResolved])
}

// ------------------------------------------------------------------------------
// 9. NOTIFICATIONS & DISPUTES
// ------------------------------------------------------------------------------

model Notification {
  id         String              @id @default(uuid())
  userId     String
  user       User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  channel    NotificationChannel @default(IN_APP)
  title      String
  message    String
  isRead     Boolean             @default(false)
  sentStatus String              @default("DELIVERED")

  createdAt DateTime @default(now())

  @@index([userId, isRead])
}

model Dispute {
  id                       String                  @id @default(uuid())
  disputeNumber            String                  @unique // e.g., DSP-2026-0041
  farmerId                 String
  farmer                   User                    @relation("FarmerDisputes", fields: [farmerId], references: [id], onDelete: Restrict)
  bookingId                String?
  booking                  Booking?                @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  procurementTransactionId String?
  procurementTransaction   ProcurementTransaction? @relation(fields: [procurementTransactionId], references: [id], onDelete: SetNull)

  category        String // "MOISTURE_GRADING", "WEIGHT_DISCREPANCY", "PAYMENT_DELAY"
  statement       String
  status          DisputeStatus @default(OPEN)
  resolutionNotes String?
  resolvedAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([farmerId, status])
}

// ------------------------------------------------------------------------------
// 10. AUDIT ARCHITECTURE (Append-only Cryptographic Hash Chaining)
// ------------------------------------------------------------------------------

model AuditEvent {
  id             String   @id @default(uuid())
  sequenceNumber BigInt   @default(autoincrement()) // Monotonically increasing sequence
  actorId        String?
  actor          User?    @relation("UserAuditEvents", fields: [actorId], references: [id], onDelete: SetNull)
  action         String // e.g., "BOOKING_CREATED", "MSP_LOCKED", "GATE_CHECKIN", "GRADE_RECORDED", "PAYMENT_INITIATED"
  entityType     String // "Booking", "ProcurementTransaction", "Payment"
  entityId       String
  timestamp      DateTime @default(now())
  metadata       Json // Structured snapshot of parameters and context

  // Ledger Hash Chaining:
  // SHA-256(previousHash + sequenceNumber + timestamp + action + entityType + entityId + metadata)
  previousHash String
  currentHash  String

  createdAt DateTime @default(now())

  @@index([sequenceNumber])
  @@index([entityType, entityId])
  @@index([action])
  @@index([timestamp])
}
```
