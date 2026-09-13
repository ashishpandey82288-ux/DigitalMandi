// ==============================================================================
// DigitalMandi — Quality Inspection & Grading Response Mapping Tests
// Verifies all 8 required edge cases and guarantees no undefined access crashes
// ==============================================================================

import { normalizeQualityInspection } from '../apps/web/src/services/gradingService.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING GRADING RESPONSE MAPPING & RESILIENCE TESTS');
  console.log('================================================================\n');

  // Case 1: Valid ML response (Direct DTO from backend)
  try {
    const validDto = {
      id: 'insp-001',
      bookingId: 'BK-202609-001',
      sampleReference: 'SMP-2026-001',
      aiPredictedGrade: 'GRADE_A',
      aiConfidenceScore: 0.96,
      aiModelVersion: 'DigitalMandi-GrainVision-Wheat-v1.0',
      aiInferenceStatus: 'COMPLETED',
      finalGrade: 'GRADE_A',
      moisturePercentage: 11.5,
      standardMoistureLimit: 12.0,
      isMoisturePass: true,
      excessMoisturePercentage: 0.0,
      foreignMatterPercentage: 0.8,
      damagedGrainsPercentage: 1.2,
      brokenGrainsPercentage: 2.1,
      deductionPercentage: 0,
      deductionAmountPerQuintal: 0,
      status: 'COMPLETED',
      otherQualityParameters: {
        recommendation: 'Exceptional FAQ standard. Meets Grade-A premium quality threshold.',
        analysis: { moisture: { status: 'OPTIMAL' } },
      },
    };

    const res1 = normalizeQualityInspection(validDto);
    assert(res1.aiPredictedGrade === 'GRADE_A', 'Case 1 - Valid ML response: aiPredictedGrade mapped');
    assert(res1.aiConfidenceScore === 0.96, 'Case 1 - Valid ML response: aiConfidenceScore mapped');
    assert(res1.aiModelVersion === 'DigitalMandi-GrainVision-Wheat-v1.0', 'Case 1 - Valid ML response: aiModelVersion preserved');
    assert(res1.totalDeductionPercentage === 0, 'Case 1 - Valid ML response: totalDeductionPercentage mapped');
  } catch (err: any) {
    assert(false, 'Case 1 - Valid ML response failed with exception', err.message);
  }

  // Case 2: Missing / Null result object
  try {
    normalizeQualityInspection(null);
    assert(false, 'Case 2 - Null result should throw clean error');
  } catch (err: any) {
    assert(
      !err.message.includes('Cannot read properties of undefined'),
      'Case 2 - Rejects null payload cleanly without TypeError'
    );
  }

  // Case 3: Missing predicted grade (Graceful degradation)
  try {
    const missingGrade = {
      id: 'insp-003',
      bookingId: 'BK-202609-003',
      moisturePercentage: 12.4,
      standardMoistureLimit: 12.0,
      deductionPercentage: 1.0,
      status: 'COMPLETED',
    };
    const res3 = normalizeQualityInspection(missingGrade);
    assert(res3.aiPredictedGrade === undefined, 'Case 3 - Missing predicted grade safely handled as undefined');
    assert(res3.finalGrade === 'FAQ', 'Case 3 - Fallback finalGrade provided');
    assert(typeof res3 === 'object', 'Case 3 - Result object is valid and non-crashing');
  } catch (err: any) {
    assert(false, 'Case 3 - Missing predicted grade threw exception', err.message);
  }

  // Case 4: Missing confidence score
  try {
    const missingConf = {
      id: 'insp-004',
      bookingId: 'BK-202609-004',
      aiPredictedGrade: 'GRADE_B',
      aiConfidenceScore: null,
      deductionPercentage: 2.5,
    };
    const res4 = normalizeQualityInspection(missingConf);
    assert(res4.aiConfidenceScore === undefined, 'Case 4 - Missing confidence handled without NaN or crash');
    assert(res4.aiPredictedGrade === 'GRADE_B', 'Case 4 - Grade preserved when confidence is absent');
  } catch (err: any) {
    assert(false, 'Case 4 - Missing confidence threw exception', err.message);
  }

  // Case 5: Wrapped response ({ data: responseDto })
  try {
    const wrappedDto = {
      data: {
        id: 'insp-005',
        bookingId: 'BK-202609-005',
        aiPredictedGrade: 'GRADE_A',
        aiConfidenceScore: 0.94,
        aiModelVersion: 'DigitalMandi-GrainVision-Wheat-v1.0',
        deductionPercentage: 0,
      },
    };
    const res5 = normalizeQualityInspection(wrappedDto);
    assert(res5.id === 'insp-005', 'Case 5 - Wrapped response unnested correctly');
    assert(res5.aiPredictedGrade === 'GRADE_A', 'Case 5 - Wrapped aiPredictedGrade accessible');
  } catch (err: any) {
    assert(false, 'Case 5 - Wrapped response failed', err.message);
  }

  // Case 6: ML Unavailable / Heuristic fallback response
  try {
    const fallbackDto = {
      id: 'insp-006',
      bookingId: 'BK-202609-006',
      aiModelVersion: 'KisanFlow-AgriVision-CV-Inference/v3.2.0-faq-standard',
      aiConfidenceScore: 0.88,
      aiInferenceStatus: 'REVIEW_REQUIRED',
      aiPredictedGrade: 'GRADE_B',
      finalGrade: 'GRADE_B',
      deductionPercentage: 2.0,
      otherQualityParameters: {
        recommendation: 'Manual inspector verification recommended.',
      },
    };
    const res6 = normalizeQualityInspection(fallbackDto);
    assert(res6.aiInferenceStatus === 'REVIEW_REQUIRED', 'Case 6 - Inference status REVIEW_REQUIRED captured');
    assert(res6.aiModelVersion?.includes('Inference'), 'Case 6 - Fallback model version preserved');
    assert(res6.recommendation?.includes('Manual inspector'), 'Case 6 - Recommendation message extracted');
  } catch (err: any) {
    assert(false, 'Case 6 - Fallback response handling failed', err.message);
  }

  // Case 7: Severe defect rejection response
  try {
    const rejectedDto = {
      id: 'insp-007',
      bookingId: 'BK-202609-007',
      aiPredictedGrade: 'BELOW_FAQ',
      finalGrade: 'BELOW_FAQ',
      moisturePercentage: 16.5,
      standardMoistureLimit: 12.0,
      isMoisturePass: false,
      excessMoisturePercentage: 4.5,
      status: 'REJECTED',
      deductionPercentage: 100,
    };
    const res7 = normalizeQualityInspection(rejectedDto);
    assert(res7.aiPredictedGrade === 'BELOW_FAQ', 'Case 7 - BELOW_FAQ grade mapped');
    assert(res7.isMoisturePass === false, 'Case 7 - Moisture failure boolean preserved');
    assert(res7.status === 'REJECTED', 'Case 7 - REJECTED status captured');
  } catch (err: any) {
    assert(false, 'Case 7 - Rejected response handling failed', err.message);
  }

  // Case 8: Exact production API response shape from grading.controller.ts
  try {
    const prodShape = {
      id: '86fe497c-9b6e-4ad2-ba28-bc6b472cae2d',
      bookingId: 'f0c43621-e02d-4589-9133-d922904bca78',
      bookingNumber: 'BK-202609-001',
      farmerProfileId: 'farmer-profile-1',
      farmerName: 'Ashish Kumar',
      cropId: 'crop-wheat-01',
      cropName: 'Wheat',
      cropCode: 'WHEAT',
      procurementCenterId: 'PC-MP-SEH-01',
      sampleReference: 'SMP-202609-123456',
      inspectionTimestamp: new Date().toISOString(),
      status: 'COMPLETED',
      moisturePercentage: 12.4,
      standardMoistureLimit: 12.0,
      isMoisturePass: false,
      excessMoisturePercentage: 0.4,
      foreignMatterPercentage: 1.2,
      damagedGrainsPercentage: 1.5,
      brokenGrainsPercentage: 2.0,
      otherQualityParameters: {
        analysis: {
          moisture: { measured: 12.4, status: 'PASS' },
          foreignMatter: { measured: 1.2, status: 'ACCEPTABLE' },
          damagedGrains: { measured: 1.5, status: 'SOUND' },
          brokenGrains: { measured: 2.0, status: 'INTACT' },
        },
        recommendation: 'Good FAQ standard. Meets Grade-B standard tolerance.',
        ruleApplied: 'Statutory 1% moisture tolerance deduction applied.',
      },
      aiModelVersion: 'DigitalMandi-GrainVision-Wheat-v1.0',
      aiConfidenceScore: 0.93,
      aiInferenceStatus: 'COMPLETED',
      aiPredictedGrade: 'GRADE_B',
      finalGrade: 'GRADE_B',
      isHumanVerified: false,
      verifiedByUserId: null,
      verifiedAt: null,
      reviewRemarks: null,
      deductionType: 'MOISTURE_EXCESS',
      deductionPercentage: 1.0,
      deductionAmountPerQuintal: 22.75,
      lockedMspRate: 2275.0,
      effectiveRatePerQuintal: 2252.25,
      remarks: 'Statutory 1% moisture tolerance deduction applied.',
      evidenceImageUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res8 = normalizeQualityInspection(prodShape);
    assert(res8.id === '86fe497c-9b6e-4ad2-ba28-bc6b472cae2d', 'Case 8 - ID matches production shape');
    assert(res8.aiPredictedGrade === 'GRADE_B', 'Case 8 - aiPredictedGrade: GRADE_B');
    assert(res8.aiConfidenceScore === 0.93, 'Case 8 - aiConfidenceScore: 0.93');
    assert(res8.aiModelVersion === 'DigitalMandi-GrainVision-Wheat-v1.0', 'Case 8 - Model version is DigitalMandi-GrainVision-Wheat-v1.0');
    assert(res8.totalDeductionPercentage === 1.0, 'Case 8 - totalDeductionPercentage normalized from deductionPercentage');
    assert(res8.moisturePercentage === 12.4, 'Case 8 - moisturePercentage preserved at 12.4%');
    assert(res8.standardMoistureLimit === 12.0, 'Case 8 - standardMoistureLimit preserved at 12.0%');
    assert(res8.recommendation?.includes('Grade-B'), 'Case 8 - recommendation extracted from otherQualityParameters');
    assert(res8.parameterAnalysis?.moisture?.status === 'PASS', 'Case 8 - parameterAnalysis.moisture.status preserved');
  } catch (err: any) {
    assert(false, 'Case 8 - Exact production shape failed', err.message);
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
