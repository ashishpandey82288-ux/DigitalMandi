// ==============================================================================
// KisanFlow — Synthetic Demo Seed Script (Phase 2 RBAC & Auth Configured)
// DISCLAIMER: ALL DATA GENERATED HEREIN IS SYNTHETIC/DEMO DATA FOR DEVELOPMENT
// AND SMART INDIA HACKATHON 2026 BENCHMARKING ONLY. IT IS NOT REAL GOVERNMENT DATA.
// ==============================================================================

import {
  PrismaClient,
  UserRole,
  CropSeason,
  BookingStatus,
  BayStatus,
} from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function computeHash(previousHash: string, data: string): string {
  return crypto.createHash('sha256').update(previousHash + data).digest('hex');
}

async function main() {
  console.log('🌱 Starting KisanFlow synthetic database seeding (Phase 2)...');

  // 1. Clear existing demo records in reverse dependency order
  await prisma.userCenterAssignment.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.procurementTransaction.deleteMany();
  await prisma.cropGrading.deleteMany();
  await prisma.bayAssignment.deleteMany();
  await prisma.queueEntry.deleteMany();
  await prisma.gateCheckin.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.bookingSlot.deleteMany();
  await prisma.centerBay.deleteMany();
  await prisma.weatherData.deleteMany();
  await prisma.loadForecast.deleteMany();
  await prisma.priceForecast.deleteMany();
  await prisma.anomaly.deleteMany();
  await prisma.mSPRate.deleteMany();
  await prisma.crop.deleteMany();
  await prisma.farmerCrop.deleteMany();
  await prisma.farm.deleteMany();
  await prisma.farmerProfile.deleteMany();
  await prisma.procurementCenter.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned previous synthetic records.');

  // 2. Create 5 Procurement Centers across India
  const centerLocations = [
    {
      code: 'PC-HR-KAR-01',
      name: 'Karnal Central Agri Procurement Hub',
      locationAddress: 'GT Road, Near Anaj Mandi, Sector 3',
      district: 'Karnal',
      state: 'Haryana',
      latitude: 29.6857,
      longitude: 76.9905,
      dailyCapacityQuintals: 15000,
      slotDurationMinutes: 90,
      operatingHoursStart: '08:00',
      operatingHoursEnd: '18:00',
    },
    {
      code: 'PC-PB-LUD-02',
      name: 'Ludhiana Integrated Mandi Facility',
      locationAddress: 'Ferozepur Road, Grain Market complex',
      district: 'Ludhiana',
      state: 'Punjab',
      latitude: 30.901,
      longitude: 75.8573,
      dailyCapacityQuintals: 18000,
      slotDurationMinutes: 90,
      operatingHoursStart: '07:30',
      operatingHoursEnd: '18:30',
    },
    {
      code: 'PC-MP-IND-03',
      name: 'Indore Malwa Krishi Upaj Hub',
      locationAddress: 'Chhavani Grain Market, AB Road',
      district: 'Indore',
      state: 'Madhya Pradesh',
      latitude: 22.7196,
      longitude: 75.8577,
      dailyCapacityQuintals: 12000,
      slotDurationMinutes: 90,
      operatingHoursStart: '08:30',
      operatingHoursEnd: '17:30',
    },
    {
      code: 'PC-MH-NAG-04',
      name: 'Nagpur Vidarbha Agro Procurement Center',
      locationAddress: 'Kalamna Market Yard, Ring Road',
      district: 'Nagpur',
      state: 'Maharashtra',
      latitude: 21.1458,
      longitude: 79.0882,
      dailyCapacityQuintals: 10000,
      slotDurationMinutes: 90,
      operatingHoursStart: '08:00',
      operatingHoursEnd: '17:00',
    },
    {
      code: 'PC-RJ-JAI-05',
      name: 'Jaipur Shekhawati Mandi Center',
      locationAddress: 'Surajpole Mandi, Delhi Highway',
      district: 'Jaipur',
      state: 'Rajasthan',
      latitude: 26.9124,
      longitude: 75.7873,
      dailyCapacityQuintals: 9500,
      slotDurationMinutes: 90,
      operatingHoursStart: '08:00',
      operatingHoursEnd: '18:00',
    },
  ];

  const createdCenters = [];
  for (const c of centerLocations) {
    const center = await prisma.procurementCenter.create({
      data: c,
    });
    createdCenters.push(center);

    for (let bayNo = 1; bayNo <= 4; bayNo++) {
      await prisma.centerBay.create({
        data: {
          procurementCenterId: center.id,
          bayNumber: bayNo,
          name: `Unloading & Inspection Bay ${bayNo}`,
          capacityQuintals: 500,
          status: BayStatus.AVAILABLE,
          isActive: true,
        },
      });
    }

    await prisma.weatherData.create({
      data: {
        procurementCenterId: center.id,
        recordedDate: new Date(),
        temperatureCelsius: 28.5,
        humidityPercentage: 54.0,
        rainfallMm: 0.0,
        weatherCondition: 'Clear / Sunny',
        dataSource: 'IMD_DEMO_SYNTHETIC',
      },
    });
  }
  console.log(`✅ Created ${createdCenters.length} synthetic procurement centers.`);

  // 3. Create Crops
  const cropsData = [
    { name: 'Wheat (Gehun)', code: 'WHT-01', category: 'Cereals', standardMoistureLimit: 12.0 },
    { name: 'Paddy / Rice (Dhan)', code: 'PDY-02', category: 'Cereals', standardMoistureLimit: 17.0 },
    { name: 'Mustard (Sarson)', code: 'MST-03', category: 'Oilseeds', standardMoistureLimit: 8.0 },
    { name: 'Soybean', code: 'SYB-04', category: 'Oilseeds', standardMoistureLimit: 10.0 },
    { name: 'Cotton (Kapas)', code: 'CTN-05', category: 'Fibre', standardMoistureLimit: 8.5 },
  ];

  const createdCrops = [];
  for (const cr of cropsData) {
    const crop = await prisma.crop.create({ data: cr });
    createdCrops.push(crop);
  }

  // 4. Create Official MSP Rates
  const mspValues: Record<string, number> = {
    'WHT-01': 2275.0,
    'PDY-02': 2300.0,
    'MST-03': 5650.0,
    'SYB-04': 4892.0,
    'CTN-05': 7121.0,
  };

  const createdMspRates = [];
  for (const crop of createdCrops) {
    const rate = await prisma.mSPRate.create({
      data: {
        cropId: crop.id,
        season: crop.code === 'WHT-01' || crop.code === 'MST-03' ? CropSeason.RABI : CropSeason.KHARIF,
        marketingYear: 2026,
        ratePerQuintal: mspValues[crop.code] || 2500.0,
        effectiveDate: new Date('2026-04-01'),
        expiryDate: new Date('2027-03-31'),
        sourceReference: 'DEMO-DAC&FW/MSP-2026/SYNTHETIC',
        bonusPerQuintal: 0,
        isActive: true,
      },
    });
    createdMspRates.push(rate);
  }

  // 5. Create Deterministic Demo Users for SIH 2026 & RBAC Verification
  // Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      id: 'user-demo-superadmin-01',
      name: 'National Super Admin',
      phone: '+91-9876543299',
      email: 'demo.superadmin@kisanflow.local',
      role: UserRole.SUPER_ADMIN,
    },
  });

  // Govt Admin
  const adminUser = await prisma.user.create({
    data: {
      id: 'user-demo-admin-01',
      name: 'Rameshwar Sharma (Govt Admin)',
      phone: '+91-9876543210',
      email: 'demo.admin@kisanflow.local',
      role: UserRole.GOVERNMENT_ADMIN,
    },
  });

  const karnalCenter = createdCenters[0];

  // Karnal Center Operator
  const operatorUser = await prisma.user.create({
    data: {
      id: 'user-demo-operator-01',
      name: 'Suresh Verma (Karnal Operator)',
      phone: '+91-9876543211',
      email: 'demo.operator@kisanflow.local',
      role: UserRole.CENTER_OPERATOR,
      operatorCenterId: karnalCenter.id,
    },
  });

  // Karnal Quality Inspector
  const inspectorUser = await prisma.user.create({
    data: {
      id: 'user-demo-inspector-01',
      name: 'Anjali Sharma (Quality Inspector)',
      phone: '+91-9876543212',
      email: 'demo.inspector@kisanflow.local',
      role: UserRole.QUALITY_INSPECTOR,
      operatorCenterId: karnalCenter.id,
    },
  });

  // Assign Center Operator & Inspector to Karnal Center in UserCenterAssignment
  await prisma.userCenterAssignment.createMany({
    data: [
      {
        userId: operatorUser.id,
        procurementCenterId: karnalCenter.id,
        role: UserRole.CENTER_OPERATOR,
      },
      {
        userId: inspectorUser.id,
        procurementCenterId: karnalCenter.id,
        role: UserRole.QUALITY_INSPECTOR,
      },
    ],
  });

  // 6. Create Demo Farmers with Land Parcels
  // Farmer 1: Harpreet Singh (Owns farm-farmer-01)
  const farmer1User = await prisma.user.create({
    data: {
      id: 'user-demo-farmer-01',
      name: 'Harpreet Singh',
      phone: '+91-9812345601',
      email: 'demo.farmer@kisanflow.local',
      role: UserRole.FARMER,
    },
  });

  const farmer1Profile = await prisma.farmerProfile.create({
    data: {
      id: 'prof-farmer-01',
      userId: farmer1User.id,
      primaryDistrict: 'Karnal',
      primaryState: 'Haryana',
      pincode: '132001',
      kisanCreditCard: 'KCC-HR-99881',
      preferredLanguage: 'hi',
      bankAccountNumber: 'XXXXXX5432',
      bankIfsc: 'SBIN0001234',
      aadhaarHash: crypto.createHash('sha256').update(farmer1User.phone).digest('hex'),
    },
  });

  const farm1 = await prisma.farm.create({
    data: {
      id: 'farm-farmer-01',
      farmerProfileId: farmer1Profile.id,
      landParcelNumber: 'KH-882/19',
      district: 'Karnal',
      state: 'Haryana',
      village: 'Taraori',
      totalAreaAcres: 6.5,
      verifiedArea: 6.5,
      isLandVerified: true,
      soilType: 'Alluvial Loam',
    },
  });

  // Farmer 2: Gurdeep Dhillon (Owns farm-farmer-02)
  const farmer2User = await prisma.user.create({
    data: {
      id: 'user-demo-farmer-02',
      name: 'Gurdeep Dhillon',
      phone: '+91-9812345602',
      email: 'demo.farmer2@kisanflow.local',
      role: UserRole.FARMER,
    },
  });

  const farmer2Profile = await prisma.farmerProfile.create({
    data: {
      id: 'prof-farmer-02',
      userId: farmer2User.id,
      primaryDistrict: 'Ludhiana',
      primaryState: 'Punjab',
      pincode: '141001',
      kisanCreditCard: 'KCC-PB-44123',
      preferredLanguage: 'pa',
      bankAccountNumber: 'XXXXXX9876',
      bankIfsc: 'PUNB0004321',
      aadhaarHash: crypto.createHash('sha256').update(farmer2User.phone).digest('hex'),
    },
  });

  await prisma.farm.create({
    data: {
      id: 'farm-farmer-02',
      farmerProfileId: farmer2Profile.id,
      landParcelNumber: 'KH-102/4',
      district: 'Ludhiana',
      state: 'Punjab',
      village: 'Samrala',
      totalAreaAcres: 10.0,
      verifiedArea: 10.0,
      isLandVerified: true,
      soilType: 'Clay Loam',
    },
  });

  console.log('✅ Created demo farmers with verified land parcels (IDOR ready).');

  // 7. Create Demo Booking Slot & Booking with MSP Lock
  const wheatCrop = createdCrops[0];
  const wheatMsp = createdMspRates[0];

  const today = new Date();
  const slotDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const startTime = new Date(slotDate);
  startTime.setHours(9, 0, 0, 0);
  const endTime = new Date(slotDate);
  endTime.setHours(10, 30, 0, 0);

  const bookingSlot = await prisma.bookingSlot.create({
    data: {
      procurementCenterId: karnalCenter.id,
      slotDate,
      startTime,
      endTime,
      maxCapacityQuintals: 300,
      bookedCapacityQuintals: 50,
      isAvailable: true,
    },
  });

  const demoBooking = await prisma.booking.create({
    data: {
      bookingNumber: 'BK-202609-001',
      farmerProfileId: farmer1Profile.id,
      farmId: farm1.id,
      cropId: wheatCrop.id,
      procurementCenterId: karnalCenter.id,
      bookingSlotId: bookingSlot.id,
      lockedMspRateId: wheatMsp.id,
      lockedRatePerQuintal: wheatMsp.ratePerQuintal,
      estimatedQuantityQuintals: 50.0,
      securePin: '482910',
      qrCodeSignature: 'HMAC-SHA256:DEMO-TOKEN-KF-001',
      status: BookingStatus.CONFIRMED,
    },
  });
  console.log('✅ Created demo booking with MSP Lock.');

  // 8. Create Demo Cryptographic Audit Events Chain (Genesis + Booking)
  const genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const event1Data = JSON.stringify({ system: 'KisanFlow', event: 'SYSTEM_INITIALIZED', phase: '2' });
  const hash1 = computeHash(genesisHash, event1Data);

  await prisma.auditEvent.create({
    data: {
      actorId: superAdmin.id,
      action: 'SYSTEM_GENESIS',
      entityType: 'SystemConfig',
      entityId: 'ROOT-01',
      metadata: { note: 'Synthetic genesis block for audit trail' },
      previousHash: genesisHash,
      currentHash: hash1,
      sequenceNumber: 1,
    },
  });

  const event2Data = JSON.stringify({
    bookingNumber: demoBooking.bookingNumber,
    farmerId: farmer1User.id,
    lockedMsp: Number(wheatMsp.ratePerQuintal),
    crop: wheatCrop.name,
  });
  const hash2 = computeHash(hash1, event2Data);

  await prisma.auditEvent.create({
    data: {
      actorId: farmer1User.id,
      action: 'BOOKING_CREATED_MSP_LOCKED',
      entityType: 'Booking',
      entityId: demoBooking.id,
      metadata: {
        bookingNumber: demoBooking.bookingNumber,
        lockedRate: Number(wheatMsp.ratePerQuintal),
        cropCode: wheatCrop.code,
      },
      previousHash: hash1,
      currentHash: hash2,
      sequenceNumber: 2,
    },
  });
  console.log('✅ Created tamper-evident SHA-256 cryptographic audit ledger.');

  console.log('🎉 KisanFlow Phase 2 synthetic database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
