// ==============================================================================
// KisanFlow — Phase 5 Verification: Dashboards Engine Test Suite
// ==============================================================================

import { prisma } from '../apps/api/src/config/prisma.ts';
import { DashboardService } from '../apps/api/src/services/dashboardService.ts';

const p: any = prisma;

async function runDashboardTests() {
  console.log('\n======================================================');
  console.log('🧪 KISANFLOW PHASE 5: DASHBOARDS TEST SUITE');
  console.log('======================================================\n');

  // Find or create active farmer
  let farmerUser = await p.user.findFirst({ where: { phone: '9876543210' } });
  if (!farmerUser) {
    farmerUser = await p.user.create({
      data: {
        phone: '9876543210',
        name: 'Ramesh Patel',
        role: 'FARMER',
        isActive: true,
      },
    });
  }

  let farmerProfile = await p.farmerProfile.findFirst({ where: { userId: farmerUser.id } });
  if (!farmerProfile) {
    farmerProfile = await p.farmerProfile.create({
      data: {
        userId: farmerUser.id,
        fullName: 'Ramesh Patel',
        primaryDistrict: 'Indore',
        primaryState: 'Madhya Pradesh',
        pincode: '452001',
        address: 'Village Sanwer',
        village: 'Sanwer',
        bankAccountNumber: '123456789012',
        bankIfsc: 'SBIN0001234',
        aadhaarHash: 'hash-aadhaar-123',
      },
    });
  }

  // Ensure Center exists
  let center = await p.procurementCenter.findFirst();
  if (!center) {
    center = await p.procurementCenter.create({
      data: {
        code: 'MPC-IND-01',
        name: 'Indore Central Mandi',
        locationAddress: 'Sanwer Road, Indore',
        latitude: 22.7196,
        longitude: 75.8577,
        district: 'Indore',
        state: 'Madhya Pradesh',
        dailyCapacityQuintals: 500,
        isActive: true,
      },
    });
  }

  // Ensure Crop exists
  let crop = await p.crop.findFirst();
  if (!crop) {
    crop = await p.crop.create({
      data: {
        code: 'WHEAT',
        name: 'Wheat (Gehun)',
        category: 'CEREAL',
        standardMoistureLimit: 12.0,
      },
    });
  }

  // Ensure Farm exists
  let farm = await p.farm.findFirst({ where: { farmerProfileId: farmerProfile.id } });
  if (!farm) {
    farm = await p.farm.create({
      data: {
        farmerProfileId: farmerProfile.id,
        farmName: 'Sanwer Field A',
        landParcelNumber: 'SURV-1029',
        totalAreaAcres: 5.0,
        district: 'Indore',
        state: 'Madhya Pradesh',
      },
    });
  }

  // Ensure Farmer Crop exists
  let farmerCrop = await p.farmerCrop.findFirst({
    where: { farmerProfileId: farmerProfile.id, cropId: crop.id },
  });
  if (!farmerCrop) {
    farmerCrop = await p.farmerCrop.create({
      data: {
        farmerProfileId: farmerProfile.id,
        farmId: farm.id,
        cropId: crop.id,
        season: 'RABI',
        sowingDate: new Date('2025-11-01'),
        cultivatedArea: 5.0,
        expectedYield: 100.0,
        status: 'VERIFIED',
      },
    });
  }

  // Ensure MSP Rate exists
  let mspRate = await p.mSPRate.findFirst({ where: { cropId: crop.id, isActive: true } });
  if (!mspRate) {
    mspRate = await p.mSPRate.create({
      data: {
        cropId: crop.id,
        season: 'RABI',
        marketingYear: 2026,
        ratePerQuintal: 2275.0,
        bonusPerQuintal: 50.0,
        effectiveDate: new Date('2025-10-01'),
        expiryDate: new Date('2026-09-30'),
        sourceReference: 'Govt Order 2025-26',
        isActive: true,
      },
    });
  }

  // Ensure Booking exists
  let booking = await p.booking.findFirst({ where: { farmerProfileId: farmerProfile.id } });
  if (!booking) {
    booking = await p.booking.create({
      data: {
        bookingNumber: 'BK-IND-2026-001',
        farmerProfileId: farmerProfile.id,
        procurementCenterId: center.id,
        cropId: crop.id,
        bookingDate: new Date(),
        estimatedQuantityQuintals: 50.0,
        lockedRatePerQuintal: 2275.0,
        status: 'COMPLETED',
        tokenNumber: 'GT-001',
      },
    });
  }

  // Ensure Quality Inspection exists
  let inspection = await p.qualityInspection.findFirst({ where: { bookingId: booking.id } });
  if (!inspection) {
    inspection = await p.qualityInspection.create({
      data: {
        bookingId: booking.id,
        procurementCenterId: center.id,
        farmerProfileId: farmerProfile.id,
        cropId: crop.id,
        sampleReference: 'SMP-IND-001',
        moisturePercentage: 11.2,
        standardMoistureLimit: 12.0,
        isMoisturePass: true,
        finalGrade: 'GRADE_A',
        isHumanVerified: true,
        baseRatePerQuintal: 2275.0,
        effectiveRatePerQuintal: 2275.0,
        status: 'COMPLETED',
      },
    });
  }

  // Ensure Weighment exists
  let weighment = await p.weighment.findFirst({ where: { bookingId: booking.id } });
  if (!weighment) {
    weighment = await p.weighment.create({
      data: {
        bookingId: booking.id,
        procurementCenterId: center.id,
        cropId: crop.id,
        grossWeightQuintals: 62.0,
        tareWeightQuintals: 12.0,
        netWeightQuintals: 50.0,
        lockedRatePerQuintal: 2275.0,
        qualityGrade: 'GRADE_A',
        effectiveRatePerQuintal: 2275.0,
        finalPayableAmount: 113750.0,
        status: 'COMPLETED',
      },
    });
  }

  // Ensure Settlement exists
  let settlement = await p.settlement.findFirst({ where: { bookingId: booking.id } });
  if (!settlement) {
    settlement = await p.settlement.create({
      data: {
        settlementReference: 'SET-IND-2026-001',
        bookingId: booking.id,
        farmerProfileId: farmerProfile.id,
        cropId: crop.id,
        grossAmount: 113750.0,
        deductions: 0.0,
        netPayableAmount: 113750.0,
        status: 'SETTLED',
      },
    });
  }

  // Ensure Payment exists
  let payment = await p.payment.findFirst({ where: { settlementId: settlement.id } });
  if (!payment) {
    payment = await p.payment.create({
      data: {
        paymentReference: 'PAY-DBT-2026-001',
        settlementId: settlement.id,
        farmerProfileId: farmerProfile.id,
        amountInr: 113750.0,
        currency: 'INR',
        paymentMode: 'DBT_PFMS',
        status: 'SUCCESS',
        utrNumber: 'UTR998877665544',
        isSimulated: true,
        disbursedAt: new Date(),
      },
    });
  }

  // Ensure Transport exists
  let transport = await p.transportRequest.findFirst({ where: { bookingId: booking.id } });
  if (!transport) {
    transport = await p.transportRequest.create({
      data: {
        requestReference: 'TR-IND-2026-001',
        bookingId: booking.id,
        procurementCenterId: center.id,
        cropId: crop.id,
        destinationName: 'FCI Central Silo Indore',
        destinationType: 'SILO',
        quantityQuintals: 50.0,
        status: 'DELIVERED',
        dispatchedAt: new Date(),
        deliveredAt: new Date(),
      },
    });
  }

  // =========================================================================
  // TEST 1: Farmer Dashboard
  // =========================================================================
  console.log('--- Test 1: Farmer Dashboard Calculation ---');
  const farmerDashboard = await DashboardService.getFarmerDashboard(farmerUser.id);
  console.log(`✅ Farmer Profile: ${farmerDashboard.farmer.fullName} (${farmerDashboard.farmer.profileCompletionPercentage}% complete)`);
  console.log(`✅ Registered Crops: ${farmerDashboard.crops.totalRegistered}`);
  console.log(`✅ Total Bookings: ${farmerDashboard.bookings.totalBookings}`);
  console.log(`✅ Procured Volume: ${farmerDashboard.procurement.totalProcuredQuintals} Quintals`);
  console.log(`✅ Procurement Value: ₹${farmerDashboard.procurement.totalProcurementValueInr}`);
  console.log(`✅ Total Paid: ₹${farmerDashboard.payments.totalPaidInr}, Latest UTR: ${farmerDashboard.payments.latestUtrNumber}`);
  console.log(`✅ Transport Status: ${farmerDashboard.transport.totalShipments} shipments, ${farmerDashboard.transport.deliveredCount} delivered`);

  if (farmerDashboard.procurement.totalProcuredQuintals !== 50) {
    throw new Error(`❌ Expected 50 quintals procured, got ${farmerDashboard.procurement.totalProcuredQuintals}`);
  }
  if (farmerDashboard.payments.totalPaidInr !== 113750) {
    throw new Error(`❌ Expected ₹113750 paid, got ${farmerDashboard.payments.totalPaidInr}`);
  }

  // =========================================================================
  // TEST 2: Center Dashboard
  // =========================================================================
  console.log('\n--- Test 2: Center Operator Dashboard Calculation ---');
  const centerDashboard = await DashboardService.getCenterDashboard(
    center.id,
    { id: 'admin-user', role: 'SUPER_ADMIN' }
  );

  console.log(`✅ Center: ${centerDashboard.center.name} (${centerDashboard.center.code})`);
  console.log(`✅ Capacity Utilization: ${centerDashboard.capacity.utilizationPercentage}% (${centerDashboard.capacity.allocatedCapacityQuintals}/${centerDashboard.capacity.totalDailyCapacityQuintals} Qtl)`);
  console.log(`✅ Quality Inspections: ${centerDashboard.quality.totalInspections}, Avg Moisture: ${centerDashboard.quality.averageMoisturePercentage}%`);
  console.log(`✅ Quality Grades: Grade A = ${centerDashboard.quality.gradeDistribution.gradeA}`);
  console.log(`✅ Total Procured Quantity: ${centerDashboard.procurement.totalProcuredQuantityQuintals} Qtl, Value: ₹${centerDashboard.procurement.totalProcurementValueInr}`);
  console.log(`✅ Payments Processed: ${centerDashboard.payments.successfulPaymentsCount} successful (₹${centerDashboard.payments.successfulAmountInr})`);

  if (centerDashboard.procurement.totalProcuredQuantityQuintals < 50) {
    throw new Error('❌ Expected at least 50 quintals in center procurement metrics');
  }

  // Center Authorization Check (Unauthorized operator rejected)
  console.log('\n--- Test 2b: Center Dashboard Authorization Check ---');
  try {
    await DashboardService.getCenterDashboard(
      center.id,
      { id: 'other-operator', role: 'CENTER_OPERATOR', operatorCenterId: 'different-center-id' }
    );
    throw new Error('❌ Center operator from another center was improperly authorized!');
  } catch (err: any) {
    if (err.statusCode === 403 || err.message.includes('Forbidden')) {
      console.log(`✅ Center Authorization Verified: Cross-center operator blocked (${err.message})`);
    } else {
      throw err;
    }
  }

  // =========================================================================
  // TEST 3: Admin Dashboard
  // =========================================================================
  console.log('\n--- Test 3: Admin System-Wide Dashboard Calculation ---');
  const adminDashboard = await DashboardService.getAdminDashboard();

  console.log(`✅ Total Farmers: ${adminDashboard.farmers.totalFarmers}`);
  console.log(`✅ Crop Registrations: ${adminDashboard.crops.totalRegistrations}`);
  console.log(`✅ Completed Procurements: ${adminDashboard.procurement.completedProcurementsCount}`);
  console.log(`✅ Total Procurement Volume: ${adminDashboard.procurement.totalQuantityQuintals} Qtl`);
  console.log(`✅ Total Procurement Value: ₹${adminDashboard.procurement.totalProcurementValueInr}`);
  console.log(`✅ Active MSP Rates: ${adminDashboard.msp.activeRatesCount}`);
  console.log(`✅ Payment Success Rate: ${adminDashboard.payments.paymentSuccessRatePercentage}% (Disbursed: ₹${adminDashboard.payments.totalDisbursedAmountInr})`);
  console.log(`✅ Logistics Moved: ${adminDashboard.logistics.totalQuantityMovedQuintals} Qtl (Delivered: ${adminDashboard.logistics.deliveredCount})`);
  console.log(`✅ Centers Leaderboard: Top Center = ${adminDashboard.centers.centerProcurementLeaderboard[0]?.centerName}`);

  if (adminDashboard.farmers.totalFarmers < 1) {
    throw new Error('❌ Expected at least 1 farmer in admin dashboard');
  }
  if (adminDashboard.procurement.totalQuantityQuintals < 50) {
    throw new Error('❌ Expected at least 50 quintals in admin total volume');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL DASHBOARD TESTS PASSED PERFECTLY!');
  console.log('======================================================\n');
}

runDashboardTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Dashboard test failed:', err);
    process.exit(1);
  });
