// ==============================================================================
// KisanFlow — Tamper-Evident Cryptographic Audit Ledger Service
// SHA-256 Hash Chaining for Append-Only Audit Logging
// ==============================================================================

import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.ts';

export interface RecordAuditParams {
  actorId?: string | null;
  action:
    | 'USER_REGISTERED'
    | 'USER_LOGIN'
    | 'USER_LOGOUT'
    | 'ROLE_CHANGED'
    | 'ACCOUNT_DISABLED'
    | 'UNAUTHORIZED_ACCESS_ATTEMPT'
    | 'CENTER_ACCESS_VERIFIED'
    | 'SECURITY_TEST_EXECUTED'
    | string;
  entityType: 'User' | 'ProcurementCenter' | 'Farm' | 'FarmerCrop' | 'Booking' | 'QualityInspection' | 'Weighment' | 'Security' | string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEventDTO {
  id: string;
  sequenceNumber: number | string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  previousHash: string;
  currentHash: string;
}

// In-memory ledger buffer for fast retrieval or DB-offline resilience
const memoryLedger: AuditEventDTO[] = [];
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function computeBlockHash(
  previousHash: string,
  seq: number | string,
  timestamp: string,
  action: string,
  entityType: string,
  entityId: string,
  metadataStr: string
): string {
  const payload = `${previousHash}|${seq}|${timestamp}|${action}|${entityType}|${entityId}|${metadataStr}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Sanitizes metadata to ensure no sensitive authentication data is logged
 */
function sanitizeAuditMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
  if (!metadata) return {};
  const cleaned: Record<string, unknown> = {};

  const forbiddenKeys = [
    'password',
    'pass',
    'token',
    'idtoken',
    'secret',
    'privatekey',
    'authorization',
    'bearer',
    'creditcard',
    'aadhaar',
  ];

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (forbiddenKeys.some((f) => lowerKey.includes(f))) {
      cleaned[key] = '[REDACTED_SECURITY_SENSITIVE]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = sanitizeAuditMetadata(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Records an audit event with cryptographic SHA-256 hash chaining
 */
export async function recordAuditEvent(params: RecordAuditParams): Promise<AuditEventDTO> {
  const timestamp = new Date().toISOString();
  const safeMetadata = sanitizeAuditMetadata(params.metadata);
  const metadataStr = JSON.stringify(safeMetadata);

  // Determine previous hash
  let previousHash = GENESIS_HASH;
  let nextSeq = memoryLedger.length + 1;

  try {
    // Attempt to query latest event from database if available
    const lastDbEvent = await prisma.auditEvent.findFirst({
      orderBy: { sequenceNumber: 'desc' },
      select: { currentHash: true, sequenceNumber: true },
    });

    if (lastDbEvent) {
      previousHash = lastDbEvent.currentHash;
      nextSeq = Number(lastDbEvent.sequenceNumber) + 1;
    } else if (memoryLedger.length > 0) {
      const lastMem = memoryLedger[memoryLedger.length - 1];
      previousHash = lastMem.currentHash;
      nextSeq = Number(lastMem.sequenceNumber) + 1;
    }

    const currentHash = computeBlockHash(
      previousHash,
      nextSeq,
      timestamp,
      params.action,
      params.entityType,
      params.entityId,
      metadataStr
    );

    // Save to Database
    const dbEvent = await prisma.auditEvent.create({
      data: {
        actorId: params.actorId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        timestamp: new Date(timestamp),
        metadata: safeMetadata as Prisma.InputJsonObject,
        previousHash,
        currentHash,
      },
    });

    const eventDto: AuditEventDTO = {
      id: dbEvent.id,
      sequenceNumber: Number(dbEvent.sequenceNumber),
      actorId: dbEvent.actorId,
      action: dbEvent.action,
      entityType: dbEvent.entityType,
      entityId: dbEvent.entityId,
      timestamp: dbEvent.timestamp.toISOString(),
      metadata: safeMetadata,
      previousHash,
      currentHash,
    };

    memoryLedger.push(eventDto);
    return eventDto;
  } catch (err) {
    // DB offline fallback: maintain chain in memory
    const lastMem = memoryLedger.length > 0 ? memoryLedger[memoryLedger.length - 1] : null;
    previousHash = lastMem ? lastMem.currentHash : GENESIS_HASH;
    nextSeq = lastMem ? Number(lastMem.sequenceNumber) + 1 : 1;

    const currentHash = computeBlockHash(
      previousHash,
      nextSeq,
      timestamp,
      params.action,
      params.entityType,
      params.entityId,
      metadataStr
    );

    const fallbackEvent: AuditEventDTO = {
      id: crypto.randomUUID(),
      sequenceNumber: nextSeq,
      actorId: params.actorId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      timestamp,
      metadata: safeMetadata,
      previousHash,
      currentHash,
    };

    memoryLedger.push(fallbackEvent);
    return fallbackEvent;
  }
}

/**
 * Returns latest audit events for administrative verification
 */
export async function getRecentAuditEvents(limit = 20): Promise<AuditEventDTO[]> {
  try {
    const dbEvents = await prisma.auditEvent.findMany({
      take: limit,
      orderBy: { sequenceNumber: 'desc' },
      include: { actor: { select: { id: true, name: true, role: true, email: true } } },
    });

    if (dbEvents.length > 0) {
      return dbEvents.map((e) => ({
        id: e.id,
        sequenceNumber: Number(e.sequenceNumber),
        actorId: e.actorId,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        timestamp: e.timestamp.toISOString(),
        metadata: (e.metadata as Record<string, unknown>) || {},
        previousHash: e.previousHash,
        currentHash: e.currentHash,
      }));
    }
  } catch {
    // Fall back to memory
  }

  return [...memoryLedger].reverse().slice(0, limit);
}

/**
 * Validates the cryptographic SHA-256 integrity of the entire audit chain.
 * Recomputes hashes sequentially and verifies previousHash link continuity.
 */
export async function verifyAuditChainIntegrity(): Promise<{
  valid: boolean;
  totalEvents: number;
  corruptedEventId?: string;
  reason?: string;
}> {
  let events: AuditEventDTO[] = [];

  try {
    const dbEvents = await prisma.auditEvent.findMany({
      orderBy: { sequenceNumber: 'asc' },
    });
    if (dbEvents.length > 0) {
      events = dbEvents.map((e) => ({
        id: e.id,
        sequenceNumber: Number(e.sequenceNumber),
        actorId: e.actorId,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        timestamp: e.timestamp.toISOString(),
        metadata: (e.metadata as Record<string, unknown>) || {},
        previousHash: e.previousHash,
        currentHash: e.currentHash,
      }));
    }
  } catch {
    // fallback
  }

  if (events.length === 0) {
    events = [...memoryLedger].sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber));
  }

  if (events.length === 0) {
    return { valid: true, totalEvents: 0 };
  }

  let expectedPreviousHash = GENESIS_HASH;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Check link continuity
    if (event.previousHash !== expectedPreviousHash) {
      return {
        valid: false,
        totalEvents: events.length,
        corruptedEventId: event.id,
        reason: `Broken chain link at sequence #${event.sequenceNumber}: expected previousHash ${expectedPreviousHash}, found ${event.previousHash}`,
      };
    }

    // Recompute current hash
    const metaStr = JSON.stringify(sanitizeAuditMetadata(event.metadata));
    const recomputedHash = computeBlockHash(
      event.previousHash,
      event.sequenceNumber,
      event.timestamp,
      event.action,
      event.entityType,
      event.entityId,
      metaStr
    );

    if (recomputedHash !== event.currentHash) {
      return {
        valid: false,
        totalEvents: events.length,
        corruptedEventId: event.id,
        reason: `Cryptographic payload mismatch at sequence #${event.sequenceNumber}: stored ${event.currentHash}, recomputed ${recomputedHash}`,
      };
    }

    expectedPreviousHash = event.currentHash;
  }

  return { valid: true, totalEvents: events.length };
}

