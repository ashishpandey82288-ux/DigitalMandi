// ==============================================================================
// KisanFlow — Phase 5: Report Service
// Aggregates domain metrics for Procurement, Payments, Quality, Logistics, & Center Performance
// ==============================================================================

import { prisma } from '../config/prisma.ts';
import {
  ProcurementReportDTO,
  PaymentReportDTO,
  QualityReportDTO,
  LogisticsReportDTO,
  CenterPerformanceReportDTO,
} from '@kisanflow/types';

export class ReportService {
  /**
   * Procurement Report
   */
  public static async getProcurementReport(filters?: {
    startDate?: string;
    endDate?: string;
    cropId?: string;
    centerId?: string;
    state?: string;
    district?: string;
  }): Promise<ProcurementReportDTO> {
    const bookings = await prisma.booking.findMany({
      include: {
        crop: true,
        procurementCenter: true,
        farmerProfile: { include: { user: true } },
      },
      orderBy: { bookingDate: 'desc' },
    });

    const bookingIds = bookings.map((b: any) => b.id);
    const qualityInspections = await (prisma as any).qualityInspection.findMany({
      where: { bookingId: { in: bookingIds } },
    });
    const weighments = await (prisma as any).weighment.findMany({
      where: { bookingId: { in: bookingIds } },
    });

    // Apply filters
    const filteredBookings = bookings.filter((b: any) => {
      if (filters?.cropId && b.cropId !== filters.cropId) return false;
      if (filters?.centerId && b.procurementCenterId !== filters.centerId) return false;
      if (filters?.state && b.procurementCenter?.state !== filters.state) return false;
      if (filters?.district && b.procurementCenter?.district !== filters.district) return false;
      if (filters?.startDate) {
        const start = new Date(filters.startDate).getTime();
        if (new Date(b.bookingDate).getTime() < start) return false;
      }
      if (filters?.endDate) {
        const end = new Date(filters.endDate).getTime();
        if (new Date(b.bookingDate).getTime() > end) return false;
      }
      return true;
    });

    const records: ProcurementReportDTO['records'] = [];
    let totalProcurementValue = 0;
    let totalQuantity = 0;

    const gradeDist = {
      gradeA: { count: 0, quantityQuintals: 0 },
      gradeB: { count: 0, quantityQuintals: 0 },
      gradeC: { count: 0, quantityQuintals: 0 },
      belowFaq: { count: 0, quantityQuintals: 0 },
    };

    const cropMap: Record<string, { cropId: string; cropName: string; cropCode: string; qty: number; val: number }> = {};
    const centerMap: Record<string, { centerId: string; centerName: string; centerCode: string; district: string; qty: number; val: number }> = {};

    filteredBookings.forEach((b: any) => {
      const weighment = weighments.find((w: any) => w.bookingId === b.id);
      const inspection = qualityInspections.find((qi: any) => qi.bookingId === b.id);

      const qty = weighment ? Number(weighment.netWeightQuintals) : Number(b.estimatedQuantityQuintals);
      const lockedRate = Number(b.lockedRatePerQuintal);
      const effectiveRate = weighment ? Number(weighment.effectiveRatePerQuintal) : inspection ? Number(inspection.effectiveRatePerQuintal) : lockedRate;
      const totalVal = weighment ? Number(weighment.finalPayableAmount) : qty * effectiveRate;
      const grade = weighment?.qualityGrade || inspection?.finalGrade || 'GRADE_A';

      if (b.status === 'COMPLETED' || weighment) {
        totalQuantity += qty;
        totalProcurementValue += totalVal;

        if (grade === 'GRADE_A') {
          gradeDist.gradeA.count++;
          gradeDist.gradeA.quantityQuintals += qty;
        } else if (grade === 'GRADE_B') {
          gradeDist.gradeB.count++;
          gradeDist.gradeB.quantityQuintals += qty;
        } else if (grade === 'GRADE_C') {
          gradeDist.gradeC.count++;
          gradeDist.gradeC.quantityQuintals += qty;
        } else {
          gradeDist.belowFaq.count++;
          gradeDist.belowFaq.quantityQuintals += qty;
        }

        // Crop map
        const cId = b.cropId;
        if (!cropMap[cId]) {
          cropMap[cId] = {
            cropId: cId,
            cropName: b.crop?.name || 'Crop',
            cropCode: b.crop?.code || 'CROP',
            qty: 0,
            val: 0,
          };
        }
        cropMap[cId].qty += qty;
        cropMap[cId].val += totalVal;

        // Center map
        const cenId = b.procurementCenterId;
        if (!centerMap[cenId]) {
          centerMap[cenId] = {
            centerId: cenId,
            centerName: b.procurementCenter?.name || 'Center',
            centerCode: b.procurementCenter?.code || 'CENTER',
            district: b.procurementCenter?.district || 'District',
            qty: 0,
            val: 0,
          };
        }
        centerMap[cenId].qty += qty;
        centerMap[cenId].val += totalVal;
      }

      records.push({
        bookingId: b.id,
        bookingNumber: b.bookingNumber,
        date: new Date(b.bookingDate).toISOString(),
        farmerName: b.farmerProfile?.fullName || b.farmerProfile?.user?.name || 'Farmer',
        cropName: b.crop?.name || 'Crop',
        centerName: b.procurementCenter?.name || 'Center',
        quantityQuintals: qty,
        lockedRate,
        effectiveRate,
        totalValueInr: totalVal,
        grade,
      });
    });

    const completedCount = filteredBookings.filter((b: any) => b.status === 'COMPLETED' || b.weighments?.length > 0).length;
    const averageRate = totalQuantity > 0 ? Number((totalProcurementValue / totalQuantity).toFixed(2)) : 0;

    return {
      summary: {
        totalBookings: filteredBookings.length,
        completedProcurements: completedCount,
        totalQuantityQuintals: totalQuantity,
        totalProcurementValueInr: totalProcurementValue,
        averageRatePerQuintal: averageRate,
      },
      qualityGradeDistribution: gradeDist,
      cropBreakdown: Object.values(cropMap).map((c) => ({
        cropId: c.cropId,
        cropName: c.cropName,
        cropCode: c.cropCode,
        quantityQuintals: c.qty,
        procurementValueInr: c.val,
        averageRatePerQuintal: c.qty > 0 ? Number((c.val / c.qty).toFixed(2)) : 0,
      })),
      centerBreakdown: Object.values(centerMap).map((c) => ({
        centerId: c.centerId,
        centerName: c.centerName,
        centerCode: c.centerCode,
        district: c.district,
        quantityQuintals: c.qty,
        procurementValueInr: c.val,
      })),
      records,
    };
  }

  /**
   * Payment & Disbursement Report
   */
  public static async getPaymentReport(filters?: {
    startDate?: string;
    endDate?: string;
    cropId?: string;
    centerId?: string;
    status?: string;
  }): Promise<PaymentReportDTO> {
    const settlements = await prisma.settlement.findMany({
      include: {
        booking: {
          include: {
            crop: true,
            procurementCenter: true,
            farmerProfile: { include: { user: true } },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const filteredSettlements = settlements.filter((s: any) => {
      if (filters?.cropId && s.booking?.cropId !== filters.cropId) return false;
      if (filters?.centerId && s.booking?.procurementCenterId !== filters.centerId) return false;
      if (filters?.status && s.status !== filters.status) return false;
      if (filters?.startDate) {
        const start = new Date(filters.startDate).getTime();
        if (new Date(s.createdAt).getTime() < start) return false;
      }
      if (filters?.endDate) {
        const end = new Date(filters.endDate).getTime();
        if (new Date(s.createdAt).getTime() > end) return false;
      }
      return true;
    });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalFailed = 0;
    let paymentCount = 0;
    let successfulCount = 0;
    let failedCount = 0;

    const cropMap: Record<string, { cropId: string; cropName: string; count: number; total: number; paid: number }> = {};
    const centerMap: Record<string, { centerId: string; centerName: string; count: number; total: number; paid: number }> = {};
    const records: PaymentReportDTO['records'] = [];

    filteredSettlements.forEach((s: any) => {
      const gross = Number(s.grossAmount);
      const deductions = Number(s.deductions);
      const net = Number(s.netPayableAmount);

      totalGross += gross;
      totalDeductions += deductions;
      totalNet += net;

      const pList = s.payments || [];
      paymentCount += pList.length;

      const successP = pList.find((p: any) => p.status === 'SUCCESS');
      const failedP = pList.find((p: any) => p.status === 'FAILED');

      if (successP) {
        successfulCount++;
        totalPaid += Number(successP.amountInr);
      } else if (failedP) {
        failedCount++;
        totalFailed += net;
        totalPending += net;
      } else {
        totalPending += net;
      }

      // Crop grouping
      const cId = s.cropId || s.booking?.cropId || 'crop-unknown';
      const cName = s.booking?.crop?.name || 'Crop';
      if (!cropMap[cId]) {
        cropMap[cId] = { cropId: cId, cropName: cName, count: 0, total: 0, paid: 0 };
      }
      cropMap[cId].count++;
      cropMap[cId].total += net;
      if (successP) cropMap[cId].paid += Number(successP.amountInr);

      // Center grouping
      const cenId = s.booking?.procurementCenterId || 'center-unknown';
      const cenName = s.booking?.procurementCenter?.name || 'Center';
      if (!centerMap[cenId]) {
        centerMap[cenId] = { centerId: cenId, centerName: cenName, count: 0, total: 0, paid: 0 };
      }
      centerMap[cenId].count++;
      centerMap[cenId].total += net;
      if (successP) centerMap[cenId].paid += Number(successP.amountInr);

      records.push({
        settlementId: s.id,
        settlementReference: s.settlementReference,
        bookingNumber: s.booking?.bookingNumber || 'N/A',
        farmerName: s.booking?.farmerProfile?.fullName || s.booking?.farmerProfile?.user?.name || 'Farmer',
        cropName: cName,
        grossAmount: gross,
        deductions,
        netAmount: net,
        paymentStatus: successP ? 'SUCCESS' : failedP ? 'FAILED' : s.status,
        utrNumber: successP?.utrNumber || null,
        disbursedAt: successP?.disbursedAt ? new Date(successP.disbursedAt).toISOString() : null,
      });
    });

    const successRate = paymentCount > 0 ? Math.round((successfulCount / paymentCount) * 100) : 100;

    return {
      summary: {
        totalSettlements: filteredSettlements.length,
        totalGrossAmountInr: totalGross,
        totalDeductionsInr: totalDeductions,
        totalNetPayableInr: totalNet,
        totalPaidInr: totalPaid,
        totalPendingInr: totalPending,
        totalFailedInr: totalFailed,
        paymentCount,
        successfulPaymentsCount: successfulCount,
        failedPaymentsCount: failedCount,
        successRatePercentage: successRate,
      },
      cropTotals: Object.values(cropMap).map((c) => ({
        cropId: c.cropId,
        cropName: c.cropName,
        settlementsCount: c.count,
        totalAmountInr: c.total,
        paidAmountInr: c.paid,
      })),
      centerTotals: Object.values(centerMap).map((c) => ({
        centerId: c.centerId,
        centerName: c.centerName,
        settlementsCount: c.count,
        totalAmountInr: c.total,
        paidAmountInr: c.paid,
      })),
      records,
    };
  }

  /**
   * Quality & Grading Report
   */
  public static async getQualityReport(filters?: {
    startDate?: string;
    endDate?: string;
    cropId?: string;
    centerId?: string;
  }): Promise<QualityReportDTO> {
    const inspections = await prisma.qualityInspection.findMany({
      include: {
        booking: {
          include: {
            crop: true,
            procurementCenter: true,
          },
        },
      },
      orderBy: { inspectionTimestamp: 'desc' },
    });

    const filtered = inspections.filter((qi: any) => {
      if (filters?.cropId && qi.cropId !== filters.cropId) return false;
      if (filters?.centerId && qi.procurementCenterId !== filters.centerId) return false;
      if (filters?.startDate) {
        const start = new Date(filters.startDate).getTime();
        if (new Date(qi.inspectionTimestamp).getTime() < start) return false;
      }
      if (filters?.endDate) {
        const end = new Date(filters.endDate).getTime();
        if (new Date(qi.inspectionTimestamp).getTime() > end) return false;
      }
      return true;
    });

    let passedCount = 0;
    let failedCount = 0;
    let reviewRequiredCount = 0;
    let totalMoisture = 0;

    const gradeDist = {
      gradeA: 0,
      gradeB: 0,
      gradeC: 0,
      belowFaq: 0,
    };

    const cropStatsMap: Record<string, { cropId: string; cropName: string; total: number; pass: number; fail: number; moistureSum: number }> = {};
    const centerStatsMap: Record<string, { centerId: string; centerName: string; total: number; pass: number; fail: number; moistureSum: number }> = {};
    const records: QualityReportDTO['records'] = [];

    filtered.forEach((qi: any) => {
      const moisture = Number(qi.moisturePercentage);
      const isPass = qi.isMoisturePass && qi.finalGrade !== 'BELOW_FAQ';

      totalMoisture += moisture;
      if (isPass) passedCount++;
      else failedCount++;

      if (!qi.isHumanVerified) reviewRequiredCount++;

      if (qi.finalGrade === 'GRADE_A') gradeDist.gradeA++;
      else if (qi.finalGrade === 'GRADE_B') gradeDist.gradeB++;
      else if (qi.finalGrade === 'GRADE_C') gradeDist.gradeC++;
      else gradeDist.belowFaq++;

      // Crop stats
      const cId = qi.cropId;
      const cName = qi.booking?.crop?.name || 'Wheat';
      if (!cropStatsMap[cId]) {
        cropStatsMap[cId] = { cropId: cId, cropName: cName, total: 0, pass: 0, fail: 0, moistureSum: 0 };
      }
      cropStatsMap[cId].total++;
      if (isPass) cropStatsMap[cId].pass++;
      else cropStatsMap[cId].fail++;
      cropStatsMap[cId].moistureSum += moisture;

      // Center stats
      const cenId = qi.procurementCenterId;
      const cenName = qi.booking?.procurementCenter?.name || 'Center';
      if (!centerStatsMap[cenId]) {
        centerStatsMap[cenId] = { centerId: cenId, centerName: cenName, total: 0, pass: 0, fail: 0, moistureSum: 0 };
      }
      centerStatsMap[cenId].total++;
      if (isPass) centerStatsMap[cenId].pass++;
      else centerStatsMap[cenId].fail++;
      centerStatsMap[cenId].moistureSum += moisture;

      records.push({
        inspectionId: qi.id,
        sampleReference: qi.sampleReference,
        bookingNumber: qi.booking?.bookingNumber || 'N/A',
        cropName: cName,
        moisturePercentage: moisture,
        standardLimit: Number(qi.standardMoistureLimit),
        isMoisturePass: qi.isMoisturePass,
        aiPredictedGrade: qi.aiPredictedGrade,
        finalGrade: qi.finalGrade,
        isHumanVerified: qi.isHumanVerified,
        effectiveRate: Number(qi.effectiveRatePerQuintal),
        status: qi.status,
        inspectedAt: new Date(qi.inspectionTimestamp).toISOString(),
      });
    });

    const avgMoisture = filtered.length > 0 ? Number((totalMoisture / filtered.length).toFixed(2)) : 0;
    const passRate = filtered.length > 0 ? Math.round((passedCount / filtered.length) * 100) : 100;

    return {
      summary: {
        totalInspections: filtered.length,
        passedCount,
        failedCount,
        reviewRequiredCount,
        passRatePercentage: passRate,
        averageMoisturePercentage: avgMoisture,
        standardMoistureLimit: 12.0,
      },
      gradeDistribution: gradeDist,
      cropStats: Object.values(cropStatsMap).map((cs) => ({
        cropId: cs.cropId,
        cropName: cs.cropName,
        inspectionCount: cs.total,
        passCount: cs.pass,
        failCount: cs.fail,
        averageMoisturePercentage: cs.total > 0 ? Number((cs.moistureSum / cs.total).toFixed(2)) : 0,
      })),
      centerStats: Object.values(centerStatsMap).map((cs) => ({
        centerId: cs.centerId,
        centerName: cs.centerName,
        inspectionCount: cs.total,
        passCount: cs.pass,
        failCount: cs.fail,
        averageMoisturePercentage: cs.total > 0 ? Number((cs.moistureSum / cs.total).toFixed(2)) : 0,
      })),
      records,
    };
  }

  /**
   * Logistics & Transport Report
   */
  public static async getLogisticsReport(filters?: {
    startDate?: string;
    endDate?: string;
    cropId?: string;
    centerId?: string;
    transporterId?: string;
    status?: string;
  }): Promise<LogisticsReportDTO> {
    const transportRequests = await prisma.transportRequest.findMany({
      include: {
        booking: {
          include: {
            crop: true,
            procurementCenter: true,
          },
        },
        vehicle: true,
        transporter: true,
      },
      orderBy: { requestedDate: 'desc' },
    });

    const filtered = transportRequests.filter((tr: any) => {
      if (filters?.cropId && tr.cropId !== filters.cropId) return false;
      if (filters?.centerId && tr.procurementCenterId !== filters.centerId) return false;
      if (filters?.transporterId && tr.transporterId !== filters.transporterId) return false;
      if (filters?.status && tr.status !== filters.status) return false;
      if (filters?.startDate) {
        const start = new Date(filters.startDate).getTime();
        if (new Date(tr.requestedDate).getTime() < start) return false;
      }
      if (filters?.endDate) {
        const end = new Date(filters.endDate).getTime();
        if (new Date(tr.requestedDate).getTime() > end) return false;
      }
      return true;
    });

    const counts = {
      requested: 0,
      assigned: 0,
      loaded: 0,
      dispatched: 0,
      inTransit: 0,
      arrived: 0,
      delivered: 0,
      cancelled: 0,
    };

    let totalQuantityMoved = 0;
    const cropMap: Record<string, { cropId: string; cropName: string; qty: number; count: number }> = {};
    const centerMap: Record<string, { centerId: string; centerName: string; qty: number; count: number }> = {};
    const destMap: Record<string, { name: string; type: string; qty: number; count: number }> = {};
    const records: LogisticsReportDTO['records'] = [];

    filtered.forEach((tr: any) => {
      const qty = Number(tr.quantityQuintals);
      totalQuantityMoved += qty;

      if (tr.status === 'REQUESTED') counts.requested++;
      else if (tr.status === 'ASSIGNED') counts.assigned++;
      else if (tr.status === 'LOADED') counts.loaded++;
      else if (tr.status === 'DISPATCHED') counts.dispatched++;
      else if (tr.status === 'IN_TRANSIT') counts.inTransit++;
      else if (tr.status === 'ARRIVED') counts.arrived++;
      else if (tr.status === 'DELIVERED') counts.delivered++;
      else if (tr.status === 'CANCELLED') counts.cancelled++;

      // Crop grouping
      const cId = tr.cropId;
      const cName = tr.booking?.crop?.name || 'Crop';
      if (!cropMap[cId]) {
        cropMap[cId] = { cropId: cId, cropName: cName, qty: 0, count: 0 };
      }
      cropMap[cId].qty += qty;
      cropMap[cId].count++;

      // Center grouping
      const cenId = tr.procurementCenterId;
      const cenName = tr.booking?.procurementCenter?.name || 'Center';
      if (!centerMap[cenId]) {
        centerMap[cenId] = { centerId: cenId, centerName: cenName, qty: 0, count: 0 };
      }
      centerMap[cenId].qty += qty;
      centerMap[cenId].count++;

      // Destination grouping
      const dName = tr.destinationName || 'Warehouse';
      const dType = tr.destinationType || 'WAREHOUSE';
      if (!destMap[dName]) {
        destMap[dName] = { name: dName, type: dType, qty: 0, count: 0 };
      }
      destMap[dName].qty += qty;
      destMap[dName].count++;

      records.push({
        transportRequestId: tr.id,
        requestReference: tr.requestReference,
        bookingNumber: tr.booking?.bookingNumber || 'N/A',
        sourceCenter: cenName,
        destinationName: dName,
        cropName: cName,
        quantityQuintals: qty,
        vehicleRegistration: tr.vehicle?.registrationNumber || null,
        transporterName: tr.transporter?.name || null,
        status: tr.status,
        dispatchedAt: tr.dispatchedAt ? new Date(tr.dispatchedAt).toISOString() : null,
        deliveredAt: tr.deliveredAt ? new Date(tr.deliveredAt).toISOString() : null,
      });
    });

    const finished = counts.delivered;
    const closed = counts.delivered + counts.cancelled;
    const successRate = closed > 0 ? Math.round((finished / closed) * 100) : 100;

    return {
      summary: {
        totalRequests: filtered.length,
        ...counts,
        totalQuantityMovedQuintals: totalQuantityMoved,
        deliverySuccessRatePercentage: successRate,
      },
      cropMovement: Object.values(cropMap).map((c) => ({
        cropId: c.cropId,
        cropName: c.cropName,
        totalQuantityQuintals: c.qty,
        shipmentCount: c.count,
      })),
      centerMovement: Object.values(centerMap).map((c) => ({
        sourceCenterId: c.centerId,
        sourceCenterName: c.centerName,
        totalQuantityQuintals: c.qty,
        shipmentCount: c.count,
      })),
      destinationMovement: Object.values(destMap).map((d) => ({
        destinationName: d.name,
        destinationType: d.type,
        totalQuantityQuintals: d.qty,
        shipmentCount: d.count,
      })),
      records,
    };
  }

  /**
   * Center Performance Report
   */
  public static async getCenterPerformanceReport(filters?: {
    startDate?: string;
    endDate?: string;
    centerId?: string;
    district?: string;
    state?: string;
  }): Promise<CenterPerformanceReportDTO> {
    const centers = await prisma.procurementCenter.findMany();
    const bookings = await prisma.booking.findMany();
    const weighments = await prisma.weighment.findMany();
    const inspections = await prisma.qualityInspection.findMany();
    const settlements = await prisma.settlement.findMany();
    const payments = await prisma.payment.findMany();
    const transportRequests = await prisma.transportRequest.findMany();

    const filteredCenters = centers.filter((c: any) => {
      if (filters?.centerId && c.id !== filters.centerId) return false;
      if (filters?.district && c.district !== filters.district) return false;
      if (filters?.state && c.state !== filters.state) return false;
      return true;
    });

    const results = filteredCenters.map((c: any) => {
      const cBookings = bookings.filter((b: any) => b.procurementCenterId === c.id);
      const cWeighments = weighments.filter((w: any) => w.procurementCenterId === c.id);
      const cInspections = inspections.filter((qi: any) => qi.procurementCenterId === c.id);

      const bookingIds = new Set(cBookings.map((b: any) => b.id));
      const cSettlements = settlements.filter((s: any) => bookingIds.has(s.bookingId));
      const settlementIds = new Set(cSettlements.map((s: any) => s.id));
      const cPayments = payments.filter((p: any) => settlementIds.has(p.settlementId));
      const cTransports = transportRequests.filter((tr: any) => tr.procurementCenterId === c.id);

      const procuredQty = cWeighments.reduce((acc: number, w: any) => acc + Number(w.netWeightQuintals), 0);
      const procuredVal = cWeighments.reduce((acc: number, w: any) => acc + Number(w.finalPayableAmount), 0);

      const capacity = Number(c.dailyCapacityQuintals);
      const capacityUtil = capacity > 0 ? Math.min(100, Math.round((procuredQty / capacity) * 100)) : 0;

      const passedInspections = cInspections.filter((qi: any) => qi.isMoisturePass && qi.finalGrade !== 'BELOW_FAQ').length;
      const qualityPassRate = cInspections.length > 0 ? Math.round((passedInspections / cInspections.length) * 100) : 100;

      const successfulPayments = cPayments.filter((p: any) => p.status === 'SUCCESS').length;
      const paymentCompletionRate = cSettlements.length > 0 ? Math.round((successfulPayments / cSettlements.length) * 100) : 100;

      const deliveredTransports = cTransports.filter((tr: any) => tr.status === 'DELIVERED').length;
      const transportCompletionRate = cTransports.length > 0 ? Math.round((deliveredTransports / cTransports.length) * 100) : 100;

      return {
        centerId: c.id,
        centerCode: c.code,
        centerName: c.name,
        district: c.district,
        state: c.state,
        totalCapacityQuintals: capacity,
        totalBookingsCount: cBookings.length,
        completedProcurementCount: cWeighments.length,
        procuredQuantityQuintals: procuredQty,
        procurementValueInr: procuredVal,
        capacityUtilizationPercentage: capacityUtil,
        qualityPassRatePercentage: qualityPassRate,
        paymentCompletionRatePercentage: paymentCompletionRate,
        transportCompletionRatePercentage: transportCompletionRate,
        averageProcessingMinutes: 45,
      };
    });

    return { centers: results };
  }
}
