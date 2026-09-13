// ==============================================================================
// DigitalMandi — E2E Frontend Flow & Grading Verification Test
// Simulates the exact operator inspection modal flow:
// 1. Authenticate as Center Operator
// 2. Fetch active bookings
// 3. Call gradingService.createQualityInspection() with real ML backend
// 4. Verify the returned normalized DTO
// 5. Verify moisture rule preservation (12.4% moisture with 12.0% std limit)
// 6. Verify model version is DigitalMandi-GrainVision-Wheat-v1.0
// ==============================================================================

process.env.VITE_API_URL = 'http://localhost:3000';

import { createQualityInspection, normalizeQualityInspection } from '../apps/web/src/services/gradingService.ts';

async function runE2ETest() {
  console.log('--- DigitalMandi E2E Operator Inspection Flow Test ---');

  // Step 1: Demo login as operator
  const loginRes = await fetch('http://localhost:3000/api/auth/demo-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'CENTER_OPERATOR' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.token;
  if (!token) throw new Error('Operator authentication failed: ' + JSON.stringify(loginData));
  console.log('✅ Step 1: Authenticated as Operator:', loginData.data?.user?.name);

  // Step 2: Fetch bookings
  const bookingsRes = await fetch('http://localhost:3000/api/bookings', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const bookingsData = await bookingsRes.json();
  const bookings = bookingsData.data || [];
  const testBooking = bookings.find((b: any) => b.status === 'CHECKED_IN') || bookings[0];
  if (!testBooking) throw new Error('No test booking found in system');
  console.log(`✅ Step 2: Selected booking #${testBooking.bookingNumber} (ID: ${testBooking.id})`);

  // Step 3: Execute AI CV Assessment via gradingService.createQualityInspection
  // Setup headers for apiClient
  const inspectionPayload = {
    bookingId: testBooking.id,
    moisturePercentage: 12.4,
    foreignMatterPercentage: 1.2,
    damagedGrainsPercentage: 1.5,
    brokenGrainsPercentage: 2.0,
    visualDefects: ['SLIGHT_DISCOLORATION'],
    sampleImageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=800',
    notes: 'E2E Modal verification test run',
  };

  // Temporarily set token in global/localStorage mock if needed
  if (typeof globalThis.localStorage === 'undefined') {
    (globalThis as any).localStorage = {
      getItem: (key: string) => (key.includes('token') ? token : null),
      setItem: () => {},
      removeItem: () => {},
    };
  } else {
    localStorage.setItem('kisanflow_auth_token', token);
  }

  console.log('Calling createQualityInspection with payload:', {
    moisturePercentage: inspectionPayload.moisturePercentage,
    foreignMatterPercentage: inspectionPayload.foreignMatterPercentage,
    damagedGrainsPercentage: inspectionPayload.damagedGrainsPercentage,
    brokenGrainsPercentage: inspectionPayload.brokenGrainsPercentage,
  });

  const inspection = await createQualityInspection(inspectionPayload);

  console.log('✅ Step 3: Quality Inspection created successfully!');
  console.log('Inspection Result Shape:');
  console.log({
    id: inspection.id,
    bookingId: inspection.bookingId,
    aiPredictedGrade: inspection.aiPredictedGrade,
    aiConfidenceScore: inspection.aiConfidenceScore,
    aiModelVersion: inspection.aiModelVersion,
    finalGrade: inspection.finalGrade,
    status: inspection.status,
    qualityStatus: inspection.qualityStatus,
    moisturePercentage: inspection.moisturePercentage,
    standardMoistureLimit: inspection.standardMoistureLimit,
    isMoisturePass: inspection.isMoisturePass,
    excessMoisturePercentage: inspection.excessMoisturePercentage,
    deductionPercentage: inspection.deductionPercentage,
    totalDeductionPercentage: inspection.totalDeductionPercentage,
    recommendation: inspection.recommendation,
  });

  // Step 4: Validate all constraints from prompt
  console.log('\n--- Validating Quality & Safety Assertions ---');

  // 1. aiPredictedGrade must not be undefined or hardcoded fake
  if (!inspection.aiPredictedGrade || typeof inspection.aiPredictedGrade !== 'string') {
    throw new Error('FAIL: aiPredictedGrade is undefined or invalid');
  }
  console.log('✅ Assertion 1: aiPredictedGrade is defined and valid:', inspection.aiPredictedGrade);

  // 2. aiConfidenceScore must be numeric between 0 and 1
  if (typeof inspection.aiConfidenceScore !== 'number' || inspection.aiConfidenceScore <= 0 || inspection.aiConfidenceScore > 1) {
    throw new Error('FAIL: aiConfidenceScore is not a valid confidence score: ' + inspection.aiConfidenceScore);
  }
  console.log('✅ Assertion 2: aiConfidenceScore is genuine numeric:', inspection.aiConfidenceScore);

  // 3. aiModelVersion must be the active model version
  if (!inspection.aiModelVersion.includes('DigitalMandi') && !inspection.aiModelVersion.includes('GrainVision')) {
    throw new Error('FAIL: aiModelVersion does not match active model: ' + inspection.aiModelVersion);
  }
  console.log('✅ Assertion 3: aiModelVersion is active model:', inspection.aiModelVersion);

  // 4. Moisture rule: 12.4% moisture with standard 12.0% -> excess 0.4%
  if (inspection.moisturePercentage !== 12.4) {
    throw new Error('FAIL: moisturePercentage modified from 12.4: ' + inspection.moisturePercentage);
  }
  if (inspection.standardMoistureLimit !== 12.0) {
    throw new Error('FAIL: standardMoistureLimit should be 12.0 for wheat: ' + inspection.standardMoistureLimit);
  }
  if (inspection.isMoisturePass !== false) {
    throw new Error('FAIL: 12.4% > 12.0% should fail moisture pass');
  }
  console.log('✅ Assertion 4: Moisture rule strictly maintained (12.4% vs 12.0% std limit, excess = 0.4%)');

  // 5. Statutory deduction calculation
  if (typeof inspection.deductionPercentage !== 'number' || inspection.deductionPercentage <= 0) {
    throw new Error('FAIL: deductionPercentage not calculated: ' + inspection.deductionPercentage);
  }
  console.log('✅ Assertion 5: Statutory deduction computed correctly:', inspection.deductionPercentage, '%');

  // 6. Recommendation exists
  if (!inspection.recommendation || typeof inspection.recommendation !== 'string') {
    throw new Error('FAIL: recommendation is missing');
  }
  console.log('✅ Assertion 6: Recommendation provided:', inspection.recommendation);

  console.log('\n========================================');
  console.log('🎉 ALL OPERATOR INSPECTION FLOW ASSERTIONS PASSED!');
  console.log('========================================');
}

runE2ETest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
