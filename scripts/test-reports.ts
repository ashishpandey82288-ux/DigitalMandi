// ==============================================================================
// KisanFlow — Phase 5 Verification: Operational & Analytical Reports Test Suite
// ==============================================================================

import { ReportService } from '../apps/api/src/services/reportService.ts';

async function runReportTests() {
  console.log('\n======================================================');
  console.log('🧪 KISANFLOW PHASE 5: REPORTING TEST SUITE');
  console.log('======================================================\n');

  // 1. Procurement Report
  console.log('--- Test 1: Procurement Report ---');
  const procReport = await ReportService.getProcurementReport();
  console.log(`✅ Procurement Summary: Total Bookings = ${procReport.summary.totalBookings}, Procured = ${procReport.summary.totalQuantityQuintals} Qtl, Value = ₹${procReport.summary.totalProcurementValueInr}, Avg Rate = ₹${procReport.summary.averageRatePerQuintal}/Qtl`);
  console.log(`✅ Crop Breakdown: ${procReport.cropBreakdown.map((c) => `${c.cropName}: ${c.quantityQuintals} Qtl`).join(', ')}`);
  console.log(`✅ Center Breakdown: ${procReport.centerBreakdown.map((c) => `${c.centerName}: ${c.quantityQuintals} Qtl`).join(', ')}`);
  console.log(`✅ Detailed Records Count: ${procReport.records.length}`);

  if (procReport.summary.totalQuantityQuintals <= 0) {
    throw new Error('❌ Expected positive procured quantity in Procurement Report');
  }

  // 2. Payment Report
  console.log('\n--- Test 2: Payment & Disbursement Report ---');
  const payReport = await ReportService.getPaymentReport();
  console.log(`✅ Payment Summary: Total Settlements = ${payReport.summary.totalSettlements}, Net Payable = ₹${payReport.summary.totalNetPayableInr}, Disbursed = ₹${payReport.summary.totalPaidInr}, Success Rate = ${payReport.summary.successRatePercentage}%`);
  console.log(`✅ Crop Totals Count: ${payReport.cropTotals.length}`);
  console.log(`✅ Detailed Payment Records: ${payReport.records.length}`);

  if (payReport.summary.totalNetPayableInr <= 0) {
    throw new Error('❌ Expected positive net payable in Payment Report');
  }

  // 3. Quality Report
  console.log('\n--- Test 3: Quality & Grading Report ---');
  const qualReport = await ReportService.getQualityReport();
  console.log(`✅ Quality Summary: Total Inspections = ${qualReport.summary.totalInspections}, Passed = ${qualReport.summary.passedCount}, Pass Rate = ${qualReport.summary.passRatePercentage}%, Avg Moisture = ${qualReport.summary.averageMoisturePercentage}%`);
  console.log(`✅ Grade Dist: Grade A = ${qualReport.gradeDistribution.gradeA}, Grade B = ${qualReport.gradeDistribution.gradeB}`);
  console.log(`✅ Detailed Inspection Records: ${qualReport.records.length}`);

  if (qualReport.summary.totalInspections <= 0) {
    throw new Error('❌ Expected positive inspections count in Quality Report');
  }

  // 4. Logistics Report
  console.log('\n--- Test 4: Logistics & Transport Report ---');
  const logReport = await ReportService.getLogisticsReport();
  console.log(`✅ Logistics Summary: Total Requests = ${logReport.summary.totalRequests}, Delivered = ${logReport.summary.delivered}, Volume Moved = ${logReport.summary.totalQuantityMovedQuintals} Qtl, Success Rate = ${logReport.summary.deliverySuccessRatePercentage}%`);
  console.log(`✅ Destination Movement: ${logReport.destinationMovement.map((d) => `${d.destinationName}: ${d.totalQuantityQuintals} Qtl`).join(', ')}`);
  console.log(`✅ Detailed Logistics Records: ${logReport.records.length}`);

  if (logReport.summary.totalRequests <= 0) {
    throw new Error('❌ Expected positive transport requests in Logistics Report');
  }

  // 5. Center Performance Report
  console.log('\n--- Test 5: Center Performance Report ---');
  const centerPerfReport = await ReportService.getCenterPerformanceReport();
  console.log(`✅ Centers Evaluated: ${centerPerfReport.centers.length}`);
  centerPerfReport.centers.forEach((c) => {
    console.log(`   📍 Center: ${c.centerName} (${c.centerCode}) | Procured: ${c.procuredQuantityQuintals} Qtl (Util: ${c.capacityUtilizationPercentage}%) | Quality Pass Rate: ${c.qualityPassRatePercentage}% | Payment Completion: ${c.paymentCompletionRatePercentage}% | Logistics Completion: ${c.transportCompletionRatePercentage}%`);
  });

  if (centerPerfReport.centers.length <= 0) {
    throw new Error('❌ Expected at least 1 center in Center Performance Report');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL REPORTING TESTS PASSED PERFECTLY!');
  console.log('======================================================\n');
}

runReportTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Reporting test failed:', err);
    process.exit(1);
  });
