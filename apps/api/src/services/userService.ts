// ==============================================================================
// KisanFlow — User Identity & Synchronization Service
// Maps Firebase Identity to PostgreSQL User & Enforces Safe Role Initialization
// ==============================================================================

import { UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.ts';
import { recordAuditEvent } from './auditService.ts';
import { env } from '../config/env.ts';

export interface ApplicationUser {
  id: string;
  firebaseUid?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  isActive: boolean;
  operatorCenterId?: string | null;
  assignedCenterIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// In-memory fallback repository for synthetic demo accounts & database resilience
const demoUsersStore: ApplicationUser[] = [
  {
    id: 'user-demo-farmer-01',
    firebaseUid: 'firebase-demo-farmer-uid',
    name: 'Harpreet Singh',
    phone: '+91-9812345601',
    email: 'demo.farmer@kisanflow.local',
    role: UserRole.FARMER,
    isActive: true,
    operatorCenterId: null,
    assignedCenterIds: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    id: 'user-demo-farmer-02',
    firebaseUid: 'firebase-demo-farmer2-uid',
    name: 'Balwinder Singh',
    phone: '+91-9812345602',
    email: 'demo.farmer2@kisanflow.local',
    role: UserRole.FARMER,
    isActive: true,
    operatorCenterId: null,
    assignedCenterIds: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    id: 'user-demo-operator-01',
    firebaseUid: 'firebase-demo-operator-uid',
    name: 'Suresh Verma',
    phone: '+91-9876543211',
    email: 'demo.operator@kisanflow.local',
    role: UserRole.CENTER_OPERATOR,
    isActive: true,
    operatorCenterId: 'PC-HR-KAR-01',
    assignedCenterIds: ['PC-HR-KAR-01', 'center-karnal-id'],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    id: 'user-demo-inspector-01',
    firebaseUid: 'firebase-demo-inspector-uid',
    name: 'Anjali Sharma',
    phone: '+91-9876543212',
    email: 'demo.inspector@kisanflow.local',
    role: UserRole.QUALITY_INSPECTOR,
    isActive: true,
    operatorCenterId: 'PC-HR-KAR-01',
    assignedCenterIds: ['PC-HR-KAR-01', 'center-karnal-id'],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    id: 'user-demo-admin-01',
    firebaseUid: 'firebase-demo-admin-uid',
    name: 'Rameshwar Sharma',
    phone: '+91-9876543210',
    email: 'demo.admin@kisanflow.local',
    role: UserRole.GOVERNMENT_ADMIN,
    isActive: true,
    operatorCenterId: null,
    assignedCenterIds: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    id: 'user-demo-superadmin-01',
    firebaseUid: 'firebase-demo-superadmin-uid',
    name: 'Vikramaditya',
    phone: '+91-9876543299',
    email: 'demo.superadmin@kisanflow.local',
    role: UserRole.SUPER_ADMIN,
    isActive: true,
    operatorCenterId: null,
    assignedCenterIds: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    id: 'user-demo-inactive-01',
    firebaseUid: 'firebase-demo-inactive-uid',
    name: 'Suspended Account',
    phone: '+91-9876500000',
    email: 'demo.inactive@kisanflow.local',
    role: UserRole.FARMER,
    isActive: false, // Explicitly disabled
    operatorCenterId: null,
    assignedCenterIds: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
];

/**
 * Finds user by Firebase UID
 */
export async function findUserByFirebaseUid(firebaseUid: string): Promise<ApplicationUser | null> {
  // 1. Check in-memory demo store first if in DEMO_MODE
  if (env.DEMO_MODE) {
    const demoUser = demoUsersStore.find((u) => u.firebaseUid === firebaseUid);
    if (demoUser) return demoUser;
  }

  // 2. Query PostgreSQL Database
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      include: {
        centerAssignments: {
          select: { procurementCenterId: true, procurementCenter: { select: { code: true } } },
        },
      },
    });

    if (user) {
      const assignedCenterIds = [
        ...(user.operatorCenterId ? [user.operatorCenterId] : []),
        ...user.centerAssignments.map((a) => a.procurementCenterId),
        ...user.centerAssignments.map((a) => a.procurementCenter.code),
      ];

      return {
        id: user.id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        operatorCenterId: user.operatorCenterId,
        assignedCenterIds,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    }
  } catch (err) {
    // Database connection fallback
  }

  return null;
}

/**
 * Finds user by Email
 */
export async function findUserByEmail(email: string): Promise<ApplicationUser | null> {
  if (env.DEMO_MODE) {
    const demoUser = demoUsersStore.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (demoUser) return demoUser;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        centerAssignments: {
          select: { procurementCenterId: true, procurementCenter: { select: { code: true } } },
        },
      },
    });

    if (user) {
      const assignedCenterIds = [
        ...(user.operatorCenterId ? [user.operatorCenterId] : []),
        ...user.centerAssignments.map((a) => a.procurementCenterId),
        ...user.centerAssignments.map((a) => a.procurementCenter.code),
      ];

      return {
        id: user.id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        operatorCenterId: user.operatorCenterId,
        assignedCenterIds,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    }
  } catch {
    // DB offline fallback
  }

  return null;
}

/**
 * Finds user by internal Database ID
 */
export async function findUserById(id: string): Promise<ApplicationUser | null> {
  if (env.DEMO_MODE) {
    const demoUser = demoUsersStore.find((u) => u.id === id);
    if (demoUser) return demoUser;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        centerAssignments: {
          select: { procurementCenterId: true, procurementCenter: { select: { code: true } } },
        },
      },
    });

    if (user) {
      const assignedCenterIds = [
        ...(user.operatorCenterId ? [user.operatorCenterId] : []),
        ...user.centerAssignments.map((a) => a.procurementCenterId),
        ...user.centerAssignments.map((a) => a.procurementCenter.code),
      ];

      return {
        id: user.id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        operatorCenterId: user.operatorCenterId,
        assignedCenterIds,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    }
  } catch {
    // DB offline fallback
  }

  return null;
}

export interface SyncUserInput {
  firebaseUid: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
}

/**
 * Synchronizes Firebase identity into PostgreSQL
 * IMPORTANT: Enforces that self-registered users STRICTLY receive role FARMER.
 * Privileged roles (ADMIN, OPERATOR, INSPECTOR) are never granted during self-sync.
 */
export async function syncFirebaseUser(input: SyncUserInput): Promise<ApplicationUser> {
  const existing = await findUserByFirebaseUid(input.firebaseUid);

  if (existing) {
    // If user already exists, update name if needed
    try {
      if (input.name && input.name !== existing.name) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { name: input.name },
        });
        existing.name = input.name;
      }
    } catch {
      // Ignored if DB offline
    }
    return existing;
  }

  // Check if user already exists by email
  if (input.email) {
    const existingByEmail = await findUserByEmail(input.email);
    if (existingByEmail) {
      try {
        await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { firebaseUid: input.firebaseUid },
        });
        existingByEmail.firebaseUid = input.firebaseUid;
      } catch {
        // Ignored
      }
      return existingByEmail;
    }
  }

  // Self-registration: Enforce default role FARMER
  const defaultRole = UserRole.FARMER;
  const safeName = input.name || input.email?.split('@')[0] || 'Registered Kisan';
  const safePhone = input.phone || `+91-98${Math.floor(10000000 + Math.random() * 90000000)}`;

  try {
    const newUser = await prisma.user.create({
      data: {
        firebaseUid: input.firebaseUid,
        email: input.email || null,
        name: safeName,
        phone: safePhone,
        role: defaultRole, // ALWAYS FARMER for self-registered accounts
        isActive: true,
      },
    });

    // Record audit event
    await recordAuditEvent({
      actorId: newUser.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: newUser.id,
      metadata: {
        role: newUser.role,
        registrationChannel: 'FIREBASE_AUTH',
      },
    });

    return {
      id: newUser.id,
      firebaseUid: newUser.firebaseUid,
      name: newUser.name,
      phone: newUser.phone,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
      operatorCenterId: null,
      assignedCenterIds: [],
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };
  } catch (err) {
    // Fallback: Create in demo in-memory store
    const fallbackUser: ApplicationUser = {
      id: `user-registered-${Date.now()}`,
      firebaseUid: input.firebaseUid,
      name: safeName,
      phone: safePhone,
      email: input.email || null,
      role: defaultRole,
      isActive: true,
      operatorCenterId: null,
      assignedCenterIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    demoUsersStore.push(fallbackUser);

    await recordAuditEvent({
      actorId: fallbackUser.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: fallbackUser.id,
      metadata: {
        role: fallbackUser.role,
        registrationChannel: 'FIREBASE_AUTH_FALLBACK',
      },
    });

    return fallbackUser;
  }
}
