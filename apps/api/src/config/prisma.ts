// ==============================================================================
// KisanFlow — Prisma Database Client Instance with Multi-Process File-Sync
// Automatically falls back to high-fidelity synchronized store when PostgreSQL is offline
// ==============================================================================

import crypto from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { env } from './env.ts';
import {
  memoryStore,
  MemoryFarm,
  MemoryFarmerCrop,
  MemoryFarmerProfile,
  MemoryProcurementCenter,
  MemoryCenterBay,
  MemoryBookingSlot,
  MemoryBooking,
  MemoryQualityInspection,
  MemoryWeighment,
  MemorySettlement,
  MemoryPayment,
  MemoryTransporter,
  MemoryVehicle,
  MemoryDriver,
  MemoryTransportDestination,
  MemoryTransportRequest,
  MemoryTransportLoad,
  MemoryNotification,
} from './prismaMemoryStore.ts';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const realPrisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: [],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = realPrisma;
}

let forceMemoryMode = false;

function isDbConnectionError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as Error).message || String(err);
  return (
    msg.includes("Can't reach database server") ||
    msg.includes('connection unavailable') ||
    msg.includes('Connection timeout') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('P1001')
  );
}

// Memory implementations for models with inter-process file sync
const memoryHandlers = {
  user: {
    findUnique: async (args: { where: { id?: string; phone?: string; email?: string } }) => {
      memoryStore.loadFromDisk();
      const user = memoryStore.users.find(
        (u) =>
          (args.where.id && u.id === args.where.id) ||
          (args.where.phone && u.phone === args.where.phone) ||
          (args.where.email && u.email === args.where.email)
      );
      return user ? { ...user } : null;
    },
    findFirst: async (args?: { where?: { id?: string; phone?: string } }) => {
      memoryStore.loadFromDisk();
      if (!args?.where) return memoryStore.users[0] ? { ...memoryStore.users[0] } : null;
      const user = memoryStore.users.find(
        (u) =>
          (args.where?.id && u.id === args.where.id) ||
          (args.where?.phone && u.phone === args.where.phone)
      );
      return user ? { ...user } : null;
    },
    findMany: async () => {
      memoryStore.loadFromDisk();
      return memoryStore.users.map((u) => ({ ...u }));
    },
    create: async (args: { data: any }) => {
      memoryStore.loadFromDisk();
      const existing = memoryStore.users.find(
        (u) => (args.data.phone && u.phone === args.data.phone) || (args.data.id && u.id === args.data.id)
      );
      if (existing) {
        return { ...existing };
      }
      const newUser = {
        id: args.data.id || crypto.randomUUID(),
        phone: args.data.phone || '9999999999',
        email: args.data.email || null,
        name: args.data.name || null,
        role: args.data.role || 'FARMER',
        isActive: args.data.isActive !== undefined ? args.data.isActive : true,
        passwordHash: args.data.passwordHash || 'mock-hash',
        operatorCenterId: args.data.operatorCenterId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.users.push(newUser);
      memoryStore.saveToDisk();
      return { ...newUser };
    },
    update: async (args: { where: { id?: string }; data: any }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.users.findIndex((u) => u.id === args.where.id);
      if (idx >= 0) {
        memoryStore.users[idx] = { ...memoryStore.users[idx], ...args.data, updatedAt: new Date() };
        memoryStore.saveToDisk();
        return { ...memoryStore.users[idx] };
      }
      return null;
    },
  },

  farmerProfile: {
    findUnique: async (args: { where: { id?: string; userId?: string }; select?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const p = memoryStore.farmerProfiles.find(
        (fp) =>
          (args.where.id && fp.id === args.where.id) ||
          (args.where.userId && fp.userId === args.where.userId)
      );
      if (!p) return null;
      const res = { ...p };
      if (args.select) {
        const filtered: Record<string, unknown> = {};
        for (const key of Object.keys(args.select)) {
          if (args.select[key]) {
            filtered[key] = (res as Record<string, unknown>)[key];
          }
        }
        return filtered;
      }
      return res;
    },
    findFirst: async (args: { where: { id?: string; userId?: string } }) => {
      memoryStore.loadFromDisk();
      const p = memoryStore.farmerProfiles.find(
        (fp) =>
          (args.where.id && fp.id === args.where.id) ||
          (args.where.userId && fp.userId === args.where.userId)
      );
      return p ? { ...p } : null;
    },
    findMany: async () => {
      memoryStore.loadFromDisk();
      return memoryStore.farmerProfiles.map((p) => ({ ...p }));
    },
    update: async (args: { where: { id?: string; userId?: string }; data: Partial<MemoryFarmerProfile> }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.farmerProfiles.findIndex(
        (fp) =>
          (args.where.id && fp.id === args.where.id) ||
          (args.where.userId && fp.userId === args.where.userId)
      );
      if (idx === -1) {
        throw new Error('Farmer profile not found for update');
      }
      const updated = {
        ...memoryStore.farmerProfiles[idx],
        ...args.data,
        updatedAt: new Date(),
      };
      memoryStore.farmerProfiles[idx] = updated;
      memoryStore.saveToDisk();
      return { ...updated };
    },
    create: async (args: { data: Omit<MemoryFarmerProfile, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `prof-${crypto.randomUUID()}`;
      const now = new Date();
      const newProfile: MemoryFarmerProfile = {
        ...args.data,
        id,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.farmerProfiles.push(newProfile);
      memoryStore.saveToDisk();
      return { ...newProfile };
    },
  },

  farm: {
    findUnique: async (args: { where: { id: string }; include?: { farmerProfile?: { select?: { userId?: boolean } } } }) => {
      memoryStore.loadFromDisk();
      const farm = memoryStore.farms.find((f) => f.id === args.where.id);
      if (!farm) return null;
      const res: Record<string, unknown> = { ...farm };
      if (args.include?.farmerProfile) {
        const profile = memoryStore.farmerProfiles.find((fp) => fp.id === farm.farmerProfileId);
        res.farmerProfile = profile ? { userId: profile.userId } : { userId: '' };
      }
      return res;
    },
    findFirst: async (args: { where: { id?: string; farmerProfileId?: string; landParcelNumber?: string }; select?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const farm = memoryStore.farms.find((f) => {
        let match = true;
        if (args.where.id && f.id !== args.where.id) match = false;
        if (args.where.farmerProfileId && f.farmerProfileId !== args.where.farmerProfileId) match = false;
        if (args.where.landParcelNumber && f.landParcelNumber !== args.where.landParcelNumber) match = false;
        return match;
      });
      if (!farm) return null;
      if (args.select) {
        const filtered: Record<string, unknown> = {};
        for (const key of Object.keys(args.select)) {
          if (args.select[key]) {
            filtered[key] = (farm as unknown as Record<string, unknown>)[key];
          }
        }
        return filtered;
      }
      return { ...farm };
    },
    findMany: async (args?: { where?: { farmerProfileId?: string }; select?: Record<string, boolean>; orderBy?: Record<string, string> }) => {
      memoryStore.loadFromDisk();
      let result = memoryStore.farms;
      if (args?.where?.farmerProfileId) {
        result = result.filter((f) => f.farmerProfileId === args.where!.farmerProfileId);
      }
      return result.map((f) => ({ ...f }));
    },
    create: async (args: { data: Omit<MemoryFarm, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `farm-${crypto.randomUUID()}`;
      const now = new Date();
      const newFarm: MemoryFarm = {
        ...args.data,
        id,
        totalAreaAcres: args.data.totalAreaAcres instanceof Prisma.Decimal ? args.data.totalAreaAcres : new Prisma.Decimal(args.data.totalAreaAcres),
        verifiedArea: args.data.verifiedArea ? (args.data.verifiedArea instanceof Prisma.Decimal ? args.data.verifiedArea : new Prisma.Decimal(args.data.verifiedArea)) : null,
        latitude: args.data.latitude ? (args.data.latitude instanceof Prisma.Decimal ? args.data.latitude : new Prisma.Decimal(args.data.latitude)) : null,
        longitude: args.data.longitude ? (args.data.longitude instanceof Prisma.Decimal ? args.data.longitude : new Prisma.Decimal(args.data.longitude)) : null,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.farms.push(newFarm);
      memoryStore.saveToDisk();
      return { ...newFarm };
    },
    update: async (args: { where: { id: string }; data: Partial<MemoryFarm> }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.farms.findIndex((f) => f.id === args.where.id);
      if (idx === -1) {
        throw new Error('Farm not found for update');
      }
      const existing = memoryStore.farms[idx];
      const updated: MemoryFarm = {
        ...existing,
        ...args.data,
        totalAreaAcres: args.data.totalAreaAcres !== undefined
          ? (args.data.totalAreaAcres instanceof Prisma.Decimal ? args.data.totalAreaAcres : new Prisma.Decimal(args.data.totalAreaAcres))
          : existing.totalAreaAcres,
        updatedAt: new Date(),
      };
      memoryStore.farms[idx] = updated;
      memoryStore.saveToDisk();
      return { ...updated };
    },
    delete: async (args: { where: { id: string } }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.farms.findIndex((f) => f.id === args.where.id);
      if (idx === -1) throw new Error('Farm not found for deletion');
      const deleted = memoryStore.farms.splice(idx, 1)[0];
      memoryStore.saveToDisk();
      return { ...deleted };
    },
  },

  crop: {
    findUnique: async (args: { where: { id?: string; code?: string }; include?: { mspRates?: boolean }; select?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const crop = memoryStore.crops.find(
        (c) => (args.where.id && c.id === args.where.id) || (args.where.code && c.code === args.where.code)
      );
      if (!crop) return null;
      const res: Record<string, unknown> = { ...crop };
      if (args.include?.mspRates) {
        res.mspRates = memoryStore.mspRates.filter((m) => m.cropId === crop.id && m.isActive);
      }
      if (args.select) {
        const filtered: Record<string, unknown> = {};
        for (const key of Object.keys(args.select)) {
          if (args.select[key]) {
            filtered[key] = res[key];
          }
        }
        return filtered;
      }
      return res;
    },
    findFirst: async (args?: { where?: { id?: string; code?: string }; include?: { mspRates?: boolean } }) => {
      memoryStore.loadFromDisk();
      if (!args || !args.where) {
        const crop = memoryStore.crops[0];
        if (!crop) return null;
        const res: Record<string, unknown> = { ...crop };
        if (args?.include?.mspRates) {
          res.mspRates = memoryStore.mspRates.filter((m) => m.cropId === crop.id && m.isActive);
        }
        return res;
      }
      const crop = memoryStore.crops.find(
        (c) => (args.where?.id && c.id === args.where.id) || (args.where?.code && c.code === args.where.code)
      );
      if (!crop) return null;
      const res: Record<string, unknown> = { ...crop };
      if (args.include?.mspRates) {
        res.mspRates = memoryStore.mspRates.filter((m) => m.cropId === crop.id && m.isActive);
      }
      return res;
    },
    findMany: async (args?: { where?: { isActive?: boolean; category?: string }; include?: { mspRates?: boolean } }) => {
      memoryStore.loadFromDisk();
      let res = memoryStore.crops;
      if (args?.where) {
        if (args.where.isActive !== undefined) {
          res = res.filter((c) => c.isActive === args.where!.isActive);
        }
        if (args.where.category) {
          res = res.filter((c) => c.category.toLowerCase() === args.where!.category!.toLowerCase());
        }
      }
      return res.map((c) => {
        const item: Record<string, unknown> = { ...c };
        if (args?.include?.mspRates) {
          item.mspRates = memoryStore.mspRates.filter((m) => m.cropId === c.id && m.isActive);
        }
        return item;
      });
    },
    count: async (args?: { where?: { isActive?: boolean; category?: string } }) => {
      memoryStore.loadFromDisk();
      let res = memoryStore.crops;
      if (args?.where) {
        if (args.where.isActive !== undefined) {
          res = res.filter((c) => c.isActive === args.where!.isActive);
        }
        if (args.where.category) {
          res = res.filter((c) => c.category.toLowerCase() === args.where!.category!.toLowerCase());
        }
      }
      return res.length;
    },
  },

  mSPRate: {
    findMany: async (args?: { where?: { cropId?: string; isActive?: boolean; marketingYear?: number; season?: string }; include?: { crop?: boolean } }) => {
      memoryStore.loadFromDisk();
      let list = memoryStore.mspRates;
      if (args?.where) {
        if (args.where.cropId) list = list.filter((m) => m.cropId === args.where!.cropId);
        if (args.where.isActive !== undefined) list = list.filter((m) => m.isActive === args.where!.isActive);
        if (args.where.marketingYear) list = list.filter((m) => m.marketingYear === args.where!.marketingYear);
        if (args.where.season) list = list.filter((m) => m.season === args.where!.season);
      }
      return list.map((m) => {
        const item: Record<string, unknown> = { ...m };
        if (args?.include?.crop) {
          item.crop = memoryStore.crops.find((c) => c.id === m.cropId) || null;
        }
        return item;
      });
    },
    findFirst: async (args?: { where?: { cropId?: string; isActive?: boolean; marketingYear?: number; season?: string }; include?: { crop?: boolean } }) => {
      memoryStore.loadFromDisk();
      let list = memoryStore.mspRates;
      if (args?.where) {
        if (args.where.cropId) list = list.filter((m) => m.cropId === args.where!.cropId);
        if (args.where.isActive !== undefined) list = list.filter((m) => m.isActive === args.where!.isActive);
        if (args.where.marketingYear) list = list.filter((m) => m.marketingYear === args.where!.marketingYear);
        if (args.where.season) list = list.filter((m) => m.season === args.where!.season);
      }
      const m = list[0];
      if (!m) return null;
      const item: Record<string, unknown> = { ...m };
      if (args?.include?.crop) {
        item.crop = memoryStore.crops.find((c) => c.id === m.cropId) || null;
      }
      return item;
    },
    count: async () => {
      memoryStore.loadFromDisk();
      return memoryStore.mspRates.length;
    },
  },

  farmerCrop: {
    findUnique: async (args: { where: { id: string }; include?: { crop?: unknown; farm?: unknown } }) => {
      memoryStore.loadFromDisk();
      const fc = memoryStore.farmerCrops.find((c) => c.id === args.where.id);
      if (!fc) return null;
      const res: Record<string, unknown> = { ...fc };
      if (args.include?.crop) {
        res.crop = memoryStore.crops.find((c) => c.id === fc.cropId) || null;
      }
      if (args.include?.farm) {
        res.farm = memoryStore.farms.find((f) => f.id === fc.farmId) || null;
      }
      return res;
    },
    findFirst: async (args: { where: { id?: string; farmerProfileId?: string }; include?: { crop?: unknown; farm?: unknown } }) => {
      memoryStore.loadFromDisk();
      const fc = memoryStore.farmerCrops.find((c) => {
        let match = true;
        if (args.where.id && c.id !== args.where.id) match = false;
        if (args.where.farmerProfileId && c.farmerProfileId !== args.where.farmerProfileId) match = false;
        return match;
      });
      if (!fc) return null;
      const res: Record<string, unknown> = { ...fc };
      if (args.include?.crop) {
        res.crop = memoryStore.crops.find((c) => c.id === fc.cropId) || null;
      }
      if (args.include?.farm) {
        res.farm = memoryStore.farms.find((f) => f.id === fc.farmId) || null;
      }
      return res;
    },
    findMany: async (args?: {
      where?: {
        farmerProfileId?: string;
        farmId?: string;
        id?: { not?: string };
        status?: { not?: string };
      };
      include?: { crop?: unknown; farm?: unknown };
      select?: Record<string, boolean>;
      orderBy?: Record<string, string>;
    }) => {
      memoryStore.loadFromDisk();
      let list = memoryStore.farmerCrops;
      if (args?.where) {
        if (args.where.farmerProfileId) {
          list = list.filter((c) => c.farmerProfileId === args.where!.farmerProfileId);
        }
        if (args.where.farmId) {
          list = list.filter((c) => c.farmId === args.where!.farmId);
        }
        if (args.where.id?.not) {
          list = list.filter((c) => c.id !== args.where!.id!.not);
        }
        if (args.where.status?.not) {
          list = list.filter((c) => c.status !== args.where!.status!.not);
        }
      }
      return list.map((fc) => {
        if (args?.select) {
          const filtered: Record<string, unknown> = {};
          for (const key of Object.keys(args.select)) {
            if (args.select[key]) {
              filtered[key] = (fc as unknown as Record<string, unknown>)[key];
            }
          }
          return filtered;
        }
        const item: Record<string, unknown> = { ...fc };
        if (args?.include?.crop) {
          item.crop = memoryStore.crops.find((c) => c.id === fc.cropId) || null;
        }
        if (args?.include?.farm) {
          item.farm = memoryStore.farms.find((f) => f.id === fc.farmId) || null;
        }
        return item;
      });
    },
    create: async (args: {
      data: Omit<MemoryFarmerCrop, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
      include?: { crop?: unknown; farm?: unknown };
    }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `fcrop-${crypto.randomUUID()}`;
      const now = new Date();
      const newRecord: MemoryFarmerCrop = {
        ...args.data,
        id,
        cultivatedArea: args.data.cultivatedArea instanceof Prisma.Decimal ? args.data.cultivatedArea : new Prisma.Decimal(args.data.cultivatedArea),
        expectedYield: args.data.expectedYield ? (args.data.expectedYield instanceof Prisma.Decimal ? args.data.expectedYield : new Prisma.Decimal(args.data.expectedYield)) : null,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.farmerCrops.push(newRecord);
      memoryStore.saveToDisk();

      const res: Record<string, unknown> = { ...newRecord };
      if (args.include?.crop) {
        res.crop = memoryStore.crops.find((c) => c.id === newRecord.cropId) || null;
      }
      if (args.include?.farm) {
        res.farm = memoryStore.farms.find((f) => f.id === newRecord.farmId) || null;
      }
      return res;
    },
    update: async (args: {
      where: { id: string };
      data: Partial<MemoryFarmerCrop>;
      include?: { crop?: unknown; farm?: unknown };
    }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.farmerCrops.findIndex((c) => c.id === args.where.id);
      if (idx === -1) throw new Error('FarmerCrop not found for update');
      const existing = memoryStore.farmerCrops[idx];
      const updated: MemoryFarmerCrop = {
        ...existing,
        ...args.data,
        cultivatedArea: args.data.cultivatedArea !== undefined
          ? (args.data.cultivatedArea instanceof Prisma.Decimal ? args.data.cultivatedArea : new Prisma.Decimal(args.data.cultivatedArea))
          : existing.cultivatedArea,
        expectedYield: args.data.expectedYield !== undefined
          ? (args.data.expectedYield ? (args.data.expectedYield instanceof Prisma.Decimal ? args.data.expectedYield : new Prisma.Decimal(args.data.expectedYield)) : null)
          : existing.expectedYield,
        updatedAt: new Date(),
      };
      memoryStore.farmerCrops[idx] = updated;
      memoryStore.saveToDisk();

      const res: Record<string, unknown> = { ...updated };
      if (args.include?.crop) {
        res.crop = memoryStore.crops.find((c) => c.id === updated.cropId) || null;
      }
      if (args.include?.farm) {
        res.farm = memoryStore.farms.find((f) => f.id === updated.farmId) || null;
      }
      return res;
    },
    delete: async (args: { where: { id: string } }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.farmerCrops.findIndex((c) => c.id === args.where.id);
      if (idx === -1) throw new Error('FarmerCrop not found for deletion');
      const deleted = memoryStore.farmerCrops.splice(idx, 1)[0];
      memoryStore.saveToDisk();
      return { ...deleted };
    },
    deleteMany: async () => {
      memoryStore.loadFromDisk();
      const count = memoryStore.farmerCrops.length;
      memoryStore.farmerCrops = [];
      memoryStore.saveToDisk();
      return { count };
    },
  },

  auditEvent: {
    findFirst: async (args?: {
      where?: {
        entityType?: string;
        action?: string;
        entityId?: string;
      };
      orderBy?: { sequenceNumber?: 'desc' | 'asc' };
      select?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.auditEvents];
      if (args?.where) {
        if (args.where.entityType) {
          list = list.filter((e) => e.entityType === args.where!.entityType);
        }
        if (args.where.action) {
          list = list.filter((e) => e.action === args.where!.action);
        }
        if (args.where.entityId) {
          list = list.filter((e) => e.entityId === args.where!.entityId);
        }
      }
      if (args?.orderBy?.sequenceNumber === 'desc') {
        list.sort((a, b) => b.sequenceNumber - a.sequenceNumber);
      } else if (args?.orderBy?.sequenceNumber === 'asc') {
        list.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      }
      const item = list[0] || null;
      if (!item) return null;
      if (args?.select) {
        const filtered: Record<string, unknown> = {};
        for (const key of Object.keys(args.select)) {
          if (args.select[key]) {
            filtered[key] = (item as unknown as Record<string, unknown>)[key];
          }
        }
        return filtered;
      }
      return { ...item };
    },
    findMany: async (args?: {
      where?: {
        entityType?: string;
        action?: string;
        entityId?: string;
      };
      orderBy?: { sequenceNumber?: 'desc' | 'asc' };
      take?: number;
    }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.auditEvents];
      if (args?.where) {
        if (args.where.entityType) {
          list = list.filter((e) => e.entityType === args.where!.entityType);
        }
        if (args.where.action) {
          list = list.filter((e) => e.action === args.where!.action);
        }
        if (args.where.entityId) {
          list = list.filter((e) => e.entityId === args.where!.entityId);
        }
      }
      if (args?.orderBy?.sequenceNumber === 'desc') {
        list.sort((a, b) => b.sequenceNumber - a.sequenceNumber);
      }
      if (args?.take) {
        list = list.slice(0, args.take);
      }
      return list.map((e) => ({ ...e }));
    },
    create: async (args: {
      data: {
        actorId?: string | null;
        action: string;
        entityType: string;
        entityId: string;
        metadata?: unknown;
        previousHash: string;
        currentHash: string;
        sequenceNumber?: number;
        timestamp?: Date;
      };
    }) => {
      memoryStore.loadFromDisk();
      const nextSeq = args.data.sequenceNumber || memoryStore.auditEvents.length + 1;
      const newEvent = {
        id: `audit-${crypto.randomUUID()}`,
        sequenceNumber: nextSeq,
        actorId: args.data.actorId || null,
        action: args.data.action,
        entityType: args.data.entityType,
        entityId: args.data.entityId,
        timestamp: args.data.timestamp || new Date(),
        metadata: (args.data.metadata as Record<string, unknown>) || {},
        previousHash: args.data.previousHash,
        currentHash: args.data.currentHash,
      };
      memoryStore.auditEvents.push(newEvent);
      memoryStore.saveToDisk();
      return { ...newEvent };
    },
  },

  procurementCenter: {
    findUnique: async (args: { where: { id?: string; code?: string }; include?: { centerBays?: boolean; bays?: boolean; bookingSlots?: boolean } }) => {
      memoryStore.loadFromDisk();
      const pc = memoryStore.procurementCenters.find(
        (c) => (args.where.id && c.id === args.where.id) || (args.where.code && c.code === args.where.code)
      );
      if (!pc) return null;
      const res: Record<string, unknown> = { ...pc };
      if (args.include?.centerBays || args.include?.bays) {
        res.centerBays = memoryStore.centerBays.filter((b) => b.procurementCenterId === pc.id).map((b) => ({ ...b }));
        res.bays = res.centerBays;
      }
      if (args.include?.bookingSlots) {
        res.bookingSlots = memoryStore.bookingSlots.filter((s) => s.procurementCenterId === pc.id).map((s) => ({ ...s }));
      }
      return res;
    },
    findFirst: async (args?: { where?: { id?: string; code?: string; isActive?: boolean } }) => {
      memoryStore.loadFromDisk();
      if (!args?.where) return memoryStore.procurementCenters[0] ? { ...memoryStore.procurementCenters[0] } : null;
      const pc = memoryStore.procurementCenters.find((c) => {
        if (args.where?.id && c.id !== args.where.id) return false;
        if (args.where?.code && c.code !== args.where.code) return false;
        if (args.where?.isActive !== undefined && c.isActive !== args.where.isActive) return false;
        return true;
      });
      return pc ? { ...pc } : null;
    },
    findMany: async (args?: {
      where?: { isActive?: boolean; district?: string; state?: string };
      include?: { centerBays?: boolean; bays?: boolean; bookingSlots?: boolean };
    }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.procurementCenters];
      if (args?.where) {
        if (args.where.isActive !== undefined) list = list.filter((c) => c.isActive === args.where!.isActive);
        if (args.where.district) list = list.filter((c) => c.district.toLowerCase() === args.where!.district!.toLowerCase());
        if (args.where.state) list = list.filter((c) => c.state.toLowerCase() === args.where!.state!.toLowerCase());
      }
      return list.map((pc) => {
        const item: Record<string, unknown> = { ...pc };
        if (args?.include?.centerBays || args?.include?.bays) {
          item.centerBays = memoryStore.centerBays.filter((b) => b.procurementCenterId === pc.id).map((b) => ({ ...b }));
          item.bays = item.centerBays;
        }
        if (args?.include?.bookingSlots) {
          item.bookingSlots = memoryStore.bookingSlots.filter((s) => s.procurementCenterId === pc.id).map((s) => ({ ...s }));
        }
        return item;
      });
    },
  },

  centerBay: {
    findUnique: async (args: { where: { id?: string } }) => {
      memoryStore.loadFromDisk();
      const bay = memoryStore.centerBays.find((b) => b.id === args.where.id);
      return bay ? { ...bay } : null;
    },
    findFirst: async (args?: { where?: { id?: string; procurementCenterId?: string; bayNumber?: number; isActive?: boolean } }) => {
      memoryStore.loadFromDisk();
      if (!args?.where) return memoryStore.centerBays[0] ? { ...memoryStore.centerBays[0] } : null;
      const bay = memoryStore.centerBays.find((b) => {
        if (args.where?.id && b.id !== args.where.id) return false;
        if (args.where?.procurementCenterId && b.procurementCenterId !== args.where.procurementCenterId) return false;
        if (args.where?.bayNumber !== undefined && b.bayNumber !== args.where.bayNumber) return false;
        if (args.where?.isActive !== undefined && b.isActive !== args.where.isActive) return false;
        return true;
      });
      return bay ? { ...bay } : null;
    },
    findMany: async (args?: { where?: { procurementCenterId?: string; isActive?: boolean; status?: string } }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.centerBays];
      if (args?.where) {
        if (args.where.procurementCenterId) list = list.filter((b) => b.procurementCenterId === args.where!.procurementCenterId);
        if (args.where.isActive !== undefined) list = list.filter((b) => b.isActive === args.where!.isActive);
        if (args.where.status) list = list.filter((b) => b.status === args.where!.status);
      }
      return list.map((b) => ({ ...b }));
    },
  },

  bookingSlot: {
    findUnique: async (args: { where: { id: string }; include?: { procurementCenter?: boolean; centerBay?: boolean } }) => {
      memoryStore.loadFromDisk();
      const s = memoryStore.bookingSlots.find((slot) => slot.id === args.where.id);
      if (!s) return null;
      const res: Record<string, unknown> = { ...s };
      if (args.include?.procurementCenter) {
        res.procurementCenter = memoryStore.procurementCenters.find((c) => c.id === s.procurementCenterId) || null;
      }
      if (args.include?.centerBay && s.centerBayId) {
        res.centerBay = memoryStore.centerBays.find((b) => b.id === s.centerBayId) || null;
      }
      return res;
    },
    findFirst: async (args?: { where?: { id?: string; procurementCenterId?: string; centerBayId?: string; isAvailable?: boolean } }) => {
      memoryStore.loadFromDisk();
      if (!args?.where) return memoryStore.bookingSlots[0] ? { ...memoryStore.bookingSlots[0] } : null;
      const s = memoryStore.bookingSlots.find((slot) => {
        if (args.where?.id && slot.id !== args.where.id) return false;
        if (args.where?.procurementCenterId && slot.procurementCenterId !== args.where.procurementCenterId) return false;
        if (args.where?.centerBayId && slot.centerBayId !== args.where.centerBayId) return false;
        if (args.where?.isAvailable !== undefined && slot.isAvailable !== args.where.isAvailable) return false;
        return true;
      });
      return s ? { ...s } : null;
    },
    findMany: async (args?: {
      where?: { procurementCenterId?: string; centerBayId?: string; slotDate?: Date | string; isAvailable?: boolean };
      include?: { procurementCenter?: boolean; centerBay?: boolean };
    }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.bookingSlots];
      if (args?.where) {
        if (args.where.procurementCenterId) list = list.filter((s) => s.procurementCenterId === args.where!.procurementCenterId);
        if (args.where.centerBayId) list = list.filter((s) => s.centerBayId === args.where!.centerBayId);
        if (args.where.isAvailable !== undefined) list = list.filter((s) => s.isAvailable === args.where!.isAvailable);
        if (args.where.slotDate) {
          const targetDate = typeof args.where.slotDate === 'string' ? args.where.slotDate.substring(0, 10) : args.where.slotDate.toISOString().substring(0, 10);
          list = list.filter((s) => s.slotDate.toISOString().substring(0, 10) === targetDate);
        }
      }
      return list.map((s) => {
        const item: Record<string, unknown> = { ...s };
        if (args?.include?.procurementCenter) {
          item.procurementCenter = memoryStore.procurementCenters.find((c) => c.id === s.procurementCenterId) || null;
        }
        if (args?.include?.centerBay && s.centerBayId) {
          item.centerBay = memoryStore.centerBays.find((b) => b.id === s.centerBayId) || null;
        }
        return item;
      });
    },
    update: async (args: {
      where: { id: string };
      data: Partial<MemoryBookingSlot>;
      include?: { procurementCenter?: boolean; centerBay?: boolean };
    }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.bookingSlots.findIndex((s) => s.id === args.where.id);
      if (idx === -1) throw new Error('BookingSlot not found for update');
      const existing = memoryStore.bookingSlots[idx];
      const updated: MemoryBookingSlot = {
        ...existing,
        ...args.data,
        bookedCapacityQuintals:
          args.data.bookedCapacityQuintals !== undefined
            ? args.data.bookedCapacityQuintals instanceof Prisma.Decimal
              ? args.data.bookedCapacityQuintals
              : new Prisma.Decimal(args.data.bookedCapacityQuintals)
            : existing.bookedCapacityQuintals,
        maxCapacityQuintals:
          args.data.maxCapacityQuintals !== undefined
            ? args.data.maxCapacityQuintals instanceof Prisma.Decimal
              ? args.data.maxCapacityQuintals
              : new Prisma.Decimal(args.data.maxCapacityQuintals)
            : existing.maxCapacityQuintals,
        updatedAt: new Date(),
      };
      memoryStore.bookingSlots[idx] = updated;
      memoryStore.saveToDisk();

      const res: Record<string, unknown> = { ...updated };
      if (args.include?.procurementCenter) {
        res.procurementCenter = memoryStore.procurementCenters.find((c) => c.id === updated.procurementCenterId) || null;
      }
      if (args.include?.centerBay && updated.centerBayId) {
        res.centerBay = memoryStore.centerBays.find((b) => b.id === updated.centerBayId) || null;
      }
      return res;
    },
  },

  booking: {
    findUnique: async (args: {
      where: { id?: string; bookingNumber?: string; bookingReference?: string; tokenNumber?: string; OR?: any[] };
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      if (args.where.OR && Array.isArray(args.where.OR)) {
        const b = memoryStore.bookings.find((bk) =>
          args.where.OR!.some((cond: any) =>
            (cond.id && bk.id === cond.id) ||
            (cond.bookingNumber && bk.bookingNumber === cond.bookingNumber) ||
            (cond.bookingReference && bk.bookingReference === cond.bookingReference) ||
            (cond.tokenNumber && bk.tokenNumber === cond.tokenNumber)
          )
        );
        return b ? hydrateBooking(b, args.include) : null;
      }
      const b = memoryStore.bookings.find(
        (bk) =>
          (args.where.id && bk.id === args.where.id) ||
          (args.where.bookingNumber && bk.bookingNumber === args.where.bookingNumber) ||
          (args.where.bookingReference && bk.bookingReference === args.where.bookingReference) ||
          (args.where.tokenNumber && bk.tokenNumber === args.where.tokenNumber)
      );
      if (!b) return null;
      return hydrateBooking(b, args.include);
    },
    findFirst: async (args?: {
      where?: { id?: string; bookingNumber?: string; bookingReference?: string; tokenNumber?: string; farmerProfileId?: string; OR?: any[] };
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      if (!args?.where) return memoryStore.bookings[0] ? hydrateBooking(memoryStore.bookings[0], args?.include) : null;
      
      if (args.where.OR && Array.isArray(args.where.OR)) {
        const b = memoryStore.bookings.find((bk) => {
          if (args.where?.farmerProfileId && bk.farmerProfileId !== args.where.farmerProfileId) return false;
          return args.where!.OR!.some((cond: any) =>
            (cond.id && bk.id === cond.id) ||
            (cond.bookingNumber && bk.bookingNumber === cond.bookingNumber) ||
            (cond.bookingReference && bk.bookingReference === cond.bookingReference) ||
            (cond.tokenNumber && bk.tokenNumber === cond.tokenNumber)
          );
        });
        return b ? hydrateBooking(b, args?.include) : null;
      }

      const b = memoryStore.bookings.find((bk) => {
        if (args.where?.id && bk.id !== args.where.id) return false;
        if (args.where?.bookingNumber && bk.bookingNumber !== args.where.bookingNumber) return false;
        if (args.where?.bookingReference && bk.bookingReference !== args.where.bookingReference) return false;
        if (args.where?.tokenNumber && bk.tokenNumber !== args.where.tokenNumber) return false;
        if (args.where?.farmerProfileId && bk.farmerProfileId !== args.where.farmerProfileId) return false;
        return true;
      });
      return b ? hydrateBooking(b, args?.include) : null;
    },
    findMany: async (args?: {
      where?: {
        farmerProfileId?: string;
        procurementCenterId?: string;
        cropId?: string;
        status?: string;
        tokenNumber?: string;
      };
      include?: Record<string, boolean>;
      orderBy?: { createdAt?: 'asc' | 'desc' };
    }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.bookings];
      if (args?.where) {
        if (args.where.farmerProfileId) list = list.filter((b) => b.farmerProfileId === args.where!.farmerProfileId);
        if (args.where.procurementCenterId) list = list.filter((b) => b.procurementCenterId === args.where!.procurementCenterId);
        if (args.where.cropId) list = list.filter((b) => b.cropId === args.where!.cropId);
        if (args.where.status) list = list.filter((b) => b.status === args.where!.status);
        if (args.where.tokenNumber) list = list.filter((b) => b.tokenNumber === args.where!.tokenNumber);
      }
      if (args?.orderBy?.createdAt === 'asc') {
        list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      } else {
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return list.map((b) => hydrateBooking(b, args?.include));
    },
    create: async (args: {
      data: Omit<MemoryBooking, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `book-${crypto.randomUUID()}`;
      const now = new Date();
      const newBooking: MemoryBooking = {
        ...args.data,
        id,
        estimatedQuantityQuintals:
          args.data.estimatedQuantityQuintals instanceof Prisma.Decimal
            ? args.data.estimatedQuantityQuintals
            : new Prisma.Decimal(args.data.estimatedQuantityQuintals),
        lockedRatePerQuintal:
          args.data.lockedRatePerQuintal instanceof Prisma.Decimal
            ? args.data.lockedRatePerQuintal
            : new Prisma.Decimal(args.data.lockedRatePerQuintal),
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.bookings.push(newBooking);
      memoryStore.saveToDisk();
      return hydrateBooking(newBooking, args.include);
    },
    update: async (args: {
      where: { id: string };
      data: Partial<MemoryBooking>;
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.bookings.findIndex((b) => b.id === args.where.id);
      if (idx === -1) throw new Error('Booking not found for update');
      const existing = memoryStore.bookings[idx];
      const updated: MemoryBooking = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      memoryStore.bookings[idx] = updated;
      memoryStore.saveToDisk();
      return hydrateBooking(updated, args.include);
    },
  },

  qualityInspection: {
    findUnique: async (args: { where: { id?: string; bookingId?: string; sampleReference?: string }; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const qi = memoryStore.qualityInspections.find(
        (q) =>
          (args.where.id && q.id === args.where.id) ||
          (args.where.bookingId && q.bookingId === args.where.bookingId) ||
          (args.where.sampleReference && q.sampleReference === args.where.sampleReference)
      );
      return qi ? hydrateQualityInspection(qi, args.include) : null;
    },
    findFirst: async (args?: {
      where?: { id?: string; bookingId?: string; sampleReference?: string; farmerProfileId?: string; procurementCenterId?: string };
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      if (!args?.where) return memoryStore.qualityInspections[0] ? hydrateQualityInspection(memoryStore.qualityInspections[0], args?.include) : null;
      const qi = memoryStore.qualityInspections.find(
        (q) =>
          (args.where?.id && q.id === args.where.id) ||
          (args.where?.bookingId && q.bookingId === args.where.bookingId) ||
          (args.where?.sampleReference && q.sampleReference === args.where.sampleReference) ||
          (args.where?.farmerProfileId && q.farmerProfileId === args.where.farmerProfileId) ||
          (args.where?.procurementCenterId && q.procurementCenterId === args.where.procurementCenterId)
      );
      return qi ? hydrateQualityInspection(qi, args?.include) : null;
    },
    findMany: async (args?: {
      where?: { bookingId?: string; farmerProfileId?: string; procurementCenterId?: string; cropId?: string; status?: string };
      include?: Record<string, boolean>;
      orderBy?: { createdAt?: 'asc' | 'desc' };
    }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.qualityInspections];
      if (args?.where) {
        if (args.where.bookingId) list = list.filter((q) => q.bookingId === args.where!.bookingId);
        if (args.where.farmerProfileId) list = list.filter((q) => q.farmerProfileId === args.where!.farmerProfileId);
        if (args.where.procurementCenterId) list = list.filter((q) => q.procurementCenterId === args.where!.procurementCenterId);
        if (args.where.cropId) list = list.filter((q) => q.cropId === args.where!.cropId);
        if (args.where.status) list = list.filter((q) => q.status === args.where!.status);
      }
      if (args?.orderBy?.createdAt === 'asc') {
        list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      } else {
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return list.map((q) => hydrateQualityInspection(q, args?.include));
    },
    create: async (args: {
      data: Omit<MemoryQualityInspection, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `insp-${crypto.randomUUID()}`;
      const now = new Date();
      const newInsp: MemoryQualityInspection = {
        ...args.data,
        id,
        moisturePercentage: args.data.moisturePercentage instanceof Prisma.Decimal ? args.data.moisturePercentage : new Prisma.Decimal(args.data.moisturePercentage ?? 0),
        standardMoistureLimit: args.data.standardMoistureLimit instanceof Prisma.Decimal ? args.data.standardMoistureLimit : new Prisma.Decimal(args.data.standardMoistureLimit ?? 12),
        excessMoisturePercentage: args.data.excessMoisturePercentage instanceof Prisma.Decimal ? args.data.excessMoisturePercentage : new Prisma.Decimal(args.data.excessMoisturePercentage ?? 0),
        foreignMatterPercentage: args.data.foreignMatterPercentage ? (args.data.foreignMatterPercentage instanceof Prisma.Decimal ? args.data.foreignMatterPercentage : new Prisma.Decimal(args.data.foreignMatterPercentage)) : null,
        damagedGrainsPercentage: args.data.damagedGrainsPercentage ? (args.data.damagedGrainsPercentage instanceof Prisma.Decimal ? args.data.damagedGrainsPercentage : new Prisma.Decimal(args.data.damagedGrainsPercentage)) : null,
        brokenGrainsPercentage: args.data.brokenGrainsPercentage ? (args.data.brokenGrainsPercentage instanceof Prisma.Decimal ? args.data.brokenGrainsPercentage : new Prisma.Decimal(args.data.brokenGrainsPercentage)) : null,
        aiConfidenceScore: args.data.aiConfidenceScore instanceof Prisma.Decimal ? args.data.aiConfidenceScore : new Prisma.Decimal(args.data.aiConfidenceScore ?? 0.95),
        deductionPercentage: args.data.deductionPercentage instanceof Prisma.Decimal ? args.data.deductionPercentage : new Prisma.Decimal(args.data.deductionPercentage ?? 0),
        deductionAmountPerQuintal: args.data.deductionAmountPerQuintal instanceof Prisma.Decimal ? args.data.deductionAmountPerQuintal : new Prisma.Decimal(args.data.deductionAmountPerQuintal ?? 0),
        lockedMspRate: args.data.lockedMspRate instanceof Prisma.Decimal ? args.data.lockedMspRate : new Prisma.Decimal(args.data.lockedMspRate ?? 2275),
        effectiveRatePerQuintal: args.data.effectiveRatePerQuintal instanceof Prisma.Decimal ? args.data.effectiveRatePerQuintal : new Prisma.Decimal(args.data.effectiveRatePerQuintal ?? 2275),
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.qualityInspections.push(newInsp);
      memoryStore.saveToDisk();
      return hydrateQualityInspection(newInsp, args.include);
    },
    update: async (args: {
      where: { id: string };
      data: Partial<MemoryQualityInspection>;
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.qualityInspections.findIndex((q) => q.id === args.where.id);
      if (idx === -1) throw new Error('Quality inspection not found for update');
      const existing = memoryStore.qualityInspections[idx];
      const updated: MemoryQualityInspection = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      memoryStore.qualityInspections[idx] = updated;
      memoryStore.saveToDisk();
      return hydrateQualityInspection(updated, args.include);
    },
  },

  cropGrading: {
    findUnique: async (args: { where: { id?: string; sampleReference?: string } }) => {
      memoryStore.loadFromDisk();
      const qi = memoryStore.qualityInspections.find(
        (q) =>
          (args.where.id && q.id === args.where.id) ||
          (args.where.sampleReference && q.sampleReference === args.where.sampleReference)
      );
      return qi ? hydrateQualityInspection(qi) : null;
    },
    findFirst: async (args?: { where?: { id?: string } }) => {
      memoryStore.loadFromDisk();
      if (!args?.where) return memoryStore.qualityInspections[0] ? hydrateQualityInspection(memoryStore.qualityInspections[0]) : null;
      const qi = memoryStore.qualityInspections.find((q) => args.where?.id && q.id === args.where.id);
      return qi ? hydrateQualityInspection(qi) : null;
    },
    findMany: async () => {
      memoryStore.loadFromDisk();
      return memoryStore.qualityInspections.map((q) => hydrateQualityInspection(q));
    },
  },

  weighment: {
    findUnique: async (args: { where: { id?: string; bookingId?: string }; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const w = memoryStore.weighments.find(
        (item) => (args.where.id && item.id === args.where.id) || (args.where.bookingId && item.bookingId === args.where.bookingId)
      );
      return w ? hydrateWeighment(w, args.include) : null;
    },
    findFirst: async (args?: { where?: { id?: string; bookingId?: string }; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      if (!args?.where) return memoryStore.weighments[0] ? hydrateWeighment(memoryStore.weighments[0], args?.include) : null;
      const w = memoryStore.weighments.find(
        (item) => (args.where?.id && item.id === args.where.id) || (args.where?.bookingId && item.bookingId === args.where.bookingId)
      );
      return w ? hydrateWeighment(w, args?.include) : null;
    },
    findMany: async (args?: {
      where?: { bookingId?: string; procurementCenterId?: string; weighingOperatorId?: string };
      include?: Record<string, boolean>;
      orderBy?: { createdAt?: 'asc' | 'desc' };
    }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.weighments];
      if (args?.where) {
        if (args.where.bookingId) list = list.filter((w) => w.bookingId === args.where!.bookingId);
        if (args.where.procurementCenterId) list = list.filter((w) => w.procurementCenterId === args.where!.procurementCenterId);
        if (args.where.weighingOperatorId) list = list.filter((w) => w.weighingOperatorId === args.where!.weighingOperatorId);
      }
      if (args?.orderBy?.createdAt === 'asc') {
        list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      } else {
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return list.map((w) => hydrateWeighment(w, args?.include));
    },
    create: async (args: {
      data: Omit<MemoryWeighment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `wgh-${crypto.randomUUID()}`;
      const now = new Date();
      const newWgh: MemoryWeighment = {
        ...args.data,
        id,
        grossWeightQuintals: args.data.grossWeightQuintals instanceof Prisma.Decimal ? args.data.grossWeightQuintals : new Prisma.Decimal(args.data.grossWeightQuintals ?? 0),
        tareWeightQuintals: args.data.tareWeightQuintals instanceof Prisma.Decimal ? args.data.tareWeightQuintals : new Prisma.Decimal(args.data.tareWeightQuintals ?? 0),
        netWeightQuintals: args.data.netWeightQuintals instanceof Prisma.Decimal ? args.data.netWeightQuintals : new Prisma.Decimal(args.data.netWeightQuintals ?? 0),
        lockedMspRate: args.data.lockedMspRate instanceof Prisma.Decimal ? args.data.lockedMspRate : new Prisma.Decimal(args.data.lockedMspRate ?? 2275),
        deductionValue: args.data.deductionValue instanceof Prisma.Decimal ? args.data.deductionValue : new Prisma.Decimal(args.data.deductionValue ?? 0),
        effectiveRatePerQuintal: args.data.effectiveRatePerQuintal instanceof Prisma.Decimal ? args.data.effectiveRatePerQuintal : new Prisma.Decimal(args.data.effectiveRatePerQuintal ?? 2275),
        finalPayableAmount: args.data.finalPayableAmount instanceof Prisma.Decimal ? args.data.finalPayableAmount : new Prisma.Decimal(args.data.finalPayableAmount ?? 0),
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.weighments.push(newWgh);
      memoryStore.saveToDisk();
      return hydrateWeighment(newWgh, args.include);
    },
    update: async (args: {
      where: { id: string };
      data: Partial<MemoryWeighment>;
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.weighments.findIndex((w) => w.id === args.where.id);
      if (idx === -1) throw new Error('Weighment not found for update');
      const existing = memoryStore.weighments[idx];
      const updated: MemoryWeighment = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      memoryStore.weighments[idx] = updated;
      memoryStore.saveToDisk();
      return hydrateWeighment(updated, args.include);
    },
  },

  settlement: {
    findUnique: async (args: { where: { id?: string; bookingId?: string; settlementReference?: string }; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const s = memoryStore.settlements.find(
        (item) =>
          (args.where.id && item.id === args.where.id) ||
          (args.where.bookingId && item.bookingId === args.where.bookingId) ||
          (args.where.settlementReference && item.settlementReference === args.where.settlementReference)
      );
      return s ? hydrateSettlement(s, args.include) : null;
    },
    findFirst: async (args?: {
      where?: { id?: string; bookingId?: string; settlementReference?: string; farmerProfileId?: string; status?: any };
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      if (!args?.where) return memoryStore.settlements[0] ? hydrateSettlement(memoryStore.settlements[0], args?.include) : null;
      const s = memoryStore.settlements.find((item) => {
        if (args.where?.id && item.id !== args.where.id) return false;
        if (args.where?.bookingId && item.bookingId !== args.where.bookingId) return false;
        if (args.where?.settlementReference && item.settlementReference !== args.where.settlementReference) return false;
        if (args.where?.farmerProfileId && item.farmerProfileId !== args.where.farmerProfileId) return false;
        if (args.where?.status && item.status !== args.where.status) return false;
        return true;
      });
      return s ? hydrateSettlement(s, args?.include) : null;
    },
    findMany: async (args?: {
      where?: { bookingId?: string; farmerProfileId?: string; cropId?: string; status?: any };
      include?: Record<string, boolean>;
      orderBy?: { createdAt?: 'asc' | 'desc' };
    }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.settlements];
      if (args?.where) {
        if (args.where.bookingId) list = list.filter((s) => s.bookingId === args.where!.bookingId);
        if (args.where.farmerProfileId) list = list.filter((s) => s.farmerProfileId === args.where!.farmerProfileId);
        if (args.where.cropId) list = list.filter((s) => s.cropId === args.where!.cropId);
        if (args.where.status) list = list.filter((s) => s.status === args.where!.status);
      }
      if (args?.orderBy?.createdAt === 'asc') {
        list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      } else {
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return list.map((s) => hydrateSettlement(s, args?.include));
    },
    create: async (args: {
      data: Omit<MemorySettlement, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `stl-${crypto.randomUUID()}`;
      const now = new Date();
      const newStl: MemorySettlement = {
        ...args.data,
        id,
        grossAmount: args.data.grossAmount instanceof Prisma.Decimal ? args.data.grossAmount : new Prisma.Decimal(args.data.grossAmount),
        deductions: args.data.deductions instanceof Prisma.Decimal ? args.data.deductions : new Prisma.Decimal(args.data.deductions),
        netPayableAmount: args.data.netPayableAmount instanceof Prisma.Decimal ? args.data.netPayableAmount : new Prisma.Decimal(args.data.netPayableAmount),
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.settlements.push(newStl);
      memoryStore.saveToDisk();
      return hydrateSettlement(newStl, args.include);
    },
    update: async (args: {
      where: { id?: string; bookingId?: string; settlementReference?: string };
      data: Partial<MemorySettlement>;
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.settlements.findIndex(
        (s) =>
          (args.where.id && s.id === args.where.id) ||
          (args.where.bookingId && s.bookingId === args.where.bookingId) ||
          (args.where.settlementReference && s.settlementReference === args.where.settlementReference)
      );
      if (idx === -1) throw new Error('Settlement not found for update');
      const existing = memoryStore.settlements[idx];
      const updated: MemorySettlement = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      memoryStore.settlements[idx] = updated;
      memoryStore.saveToDisk();
      return hydrateSettlement(updated, args.include);
    },
  },

  payment: {
    findUnique: async (args: { where: { id?: string; paymentReference?: string; idempotencyKey?: string }; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const p = memoryStore.payments.find(
        (item) =>
          (args.where.id && item.id === args.where.id) ||
          (args.where.paymentReference && item.paymentReference === args.where.paymentReference) ||
          (args.where.idempotencyKey && item.idempotencyKey === args.where.idempotencyKey)
      );
      return p ? hydratePayment(p, args.include) : null;
    },
    findFirst: async (args?: {
      where?: { id?: string; settlementId?: string; paymentReference?: string; idempotencyKey?: string; farmerProfileId?: string; status?: any };
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      if (!args?.where) return memoryStore.payments[0] ? hydratePayment(memoryStore.payments[0], args?.include) : null;
      const p = memoryStore.payments.find((item) => {
        if (args.where?.id && item.id !== args.where.id) return false;
        if (args.where?.settlementId && item.settlementId !== args.where.settlementId) return false;
        if (args.where?.paymentReference && item.paymentReference !== args.where.paymentReference) return false;
        if (args.where?.idempotencyKey && item.idempotencyKey !== args.where.idempotencyKey) return false;
        if (args.where?.farmerProfileId && item.farmerProfileId !== args.where.farmerProfileId) return false;
        if (args.where?.status && item.status !== args.where.status) return false;
        return true;
      });
      return p ? hydratePayment(p, args?.include) : null;
    },
    findMany: async (args?: {
      where?: { settlementId?: string; farmerProfileId?: string; status?: any };
      include?: Record<string, boolean>;
      orderBy?: { createdAt?: 'asc' | 'desc' };
    }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.payments];
      if (args?.where) {
        if (args.where.settlementId) list = list.filter((p) => p.settlementId === args.where!.settlementId);
        if (args.where.farmerProfileId) list = list.filter((p) => p.farmerProfileId === args.where!.farmerProfileId);
        if (args.where.status) list = list.filter((p) => p.status === args.where!.status);
      }
      if (args?.orderBy?.createdAt === 'asc') {
        list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      } else {
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return list.map((p) => hydratePayment(p, args?.include));
    },
    create: async (args: {
      data: Omit<MemoryPayment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `pay-${crypto.randomUUID()}`;
      const now = new Date();
      const newPay: MemoryPayment = {
        ...args.data,
        id,
        amountInr: args.data.amountInr instanceof Prisma.Decimal ? args.data.amountInr : new Prisma.Decimal(args.data.amountInr),
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.payments.push(newPay);
      memoryStore.saveToDisk();
      return hydratePayment(newPay, args.include);
    },
    update: async (args: {
      where: { id: string };
      data: Partial<MemoryPayment>;
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.payments.findIndex((p) => p.id === args.where.id);
      if (idx === -1) throw new Error('Payment not found for update');
      const existing = memoryStore.payments[idx];
      const updated: MemoryPayment = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      memoryStore.payments[idx] = updated;
      memoryStore.saveToDisk();
      return hydratePayment(updated, args.include);
    },
  },
  transporter: {
    findMany: async (args?: { where?: Partial<MemoryTransporter>; include?: Record<string, boolean>; orderBy?: any }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.transporters];
      if (args?.where) {
        list = list.filter((t) => {
          for (const [key, val] of Object.entries(args.where!)) {
            if (val !== undefined && (t as any)[key] !== val) return false;
          }
          return true;
        });
      }
      return list.map((t) => hydrateTransporter(t, args?.include));
    },
    findUnique: async (args: { where: { id?: string; code?: string }; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const item = memoryStore.transporters.find(
        (t) => (args.where.id && t.id === args.where.id) || (args.where.code && t.code === args.where.code)
      );
      if (!item) return null;
      return hydrateTransporter(item, args.include);
    },
    findFirst: async (args?: { where?: Partial<MemoryTransporter>; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.transporters];
      if (args?.where) {
        list = list.filter((t) => {
          for (const [key, val] of Object.entries(args.where!)) {
            if (val !== undefined && (t as any)[key] !== val) return false;
          }
          return true;
        });
      }
      if (list.length === 0) return null;
      return hydrateTransporter(list[0], args?.include);
    },
    create: async (args: { data: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `transporter-${crypto.randomUUID()}`;
      const now = new Date();
      const newTr: MemoryTransporter = {
        id,
        code: args.data.code,
        name: args.data.name,
        phone: args.data.phone,
        email: args.data.email || null,
        address: args.data.address || null,
        registrationNumber: args.data.registrationNumber || null,
        isActive: args.data.isActive ?? true,
        verificationStatus: args.data.verificationStatus || 'VERIFIED',
        metadata: args.data.metadata || null,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.transporters.push(newTr);
      memoryStore.saveToDisk();
      return hydrateTransporter(newTr, args.include);
    },
    update: async (args: { where: { id?: string; code?: string }; data: Partial<MemoryTransporter>; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.transporters.findIndex(
        (t) => (args.where.id && t.id === args.where.id) || (args.where.code && t.code === args.where.code)
      );
      if (idx === -1) throw new Error('Transporter not found for update');
      const existing = memoryStore.transporters[idx];
      const updated: MemoryTransporter = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      memoryStore.transporters[idx] = updated;
      memoryStore.saveToDisk();
      return hydrateTransporter(updated, args.include);
    },
  },
  vehicle: {
    findMany: async (args?: { where?: any; include?: Record<string, boolean>; orderBy?: any }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.vehicles];
      if (args?.where) {
        list = list.filter((v) => {
          for (const [key, val] of Object.entries(args.where!)) {
            if (val !== undefined && (v as any)[key] !== val) return false;
          }
          return true;
        });
      }
      return list.map((v) => hydrateVehicle(v, args?.include));
    },
    findUnique: async (args: { where: { id?: string; registrationNumber?: string }; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const item = memoryStore.vehicles.find(
        (v) => (args.where.id && v.id === args.where.id) || (args.where.registrationNumber && v.registrationNumber === args.where.registrationNumber)
      );
      if (!item) return null;
      return hydrateVehicle(item, args.include);
    },
    findFirst: async (args?: { where?: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.vehicles];
      if (args?.where) {
        list = list.filter((v) => {
          for (const [key, val] of Object.entries(args.where!)) {
            if (val !== undefined && (v as any)[key] !== val) return false;
          }
          return true;
        });
      }
      if (list.length === 0) return null;
      return hydrateVehicle(list[0], args?.include);
    },
    create: async (args: { data: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `vehicle-${crypto.randomUUID()}`;
      const now = new Date();
      const newVeh: MemoryVehicle = {
        id,
        registrationNumber: args.data.registrationNumber,
        transporterId: args.data.transporterId || null,
        vehicleType: args.data.vehicleType || 'TRUCK_10_TON',
        capacityQuintals: args.data.capacityQuintals instanceof Prisma.Decimal ? args.data.capacityQuintals : new Prisma.Decimal(args.data.capacityQuintals),
        capacityUnit: args.data.capacityUnit || 'QUINTAL',
        isActive: args.data.isActive ?? true,
        verificationStatus: args.data.verificationStatus || 'VERIFIED',
        currentLocation: args.data.currentLocation || null,
        metadata: args.data.metadata || null,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.vehicles.push(newVeh);
      memoryStore.saveToDisk();
      return hydrateVehicle(newVeh, args.include);
    },
    update: async (args: { where: { id?: string; registrationNumber?: string }; data: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.vehicles.findIndex(
        (v) => (args.where.id && v.id === args.where.id) || (args.where.registrationNumber && v.registrationNumber === args.where.registrationNumber)
      );
      if (idx === -1) throw new Error('Vehicle not found for update');
      const existing = memoryStore.vehicles[idx];
      const updated: MemoryVehicle = {
        ...existing,
        ...args.data,
        capacityQuintals: args.data.capacityQuintals
          ? (args.data.capacityQuintals instanceof Prisma.Decimal ? args.data.capacityQuintals : new Prisma.Decimal(args.data.capacityQuintals))
          : existing.capacityQuintals,
        updatedAt: new Date(),
      };
      memoryStore.vehicles[idx] = updated;
      memoryStore.saveToDisk();
      return hydrateVehicle(updated, args.include);
    },
  },
  driver: {
    findMany: async (args?: { where?: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.drivers];
      if (args?.where) {
        list = list.filter((d) => {
          for (const [key, val] of Object.entries(args.where!)) {
            if (val !== undefined && (d as any)[key] !== val) return false;
          }
          return true;
        });
      }
      return list.map((d) => hydrateDriver(d, args?.include));
    },
    findUnique: async (args: { where: { id?: string; phone?: string }; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const item = memoryStore.drivers.find(
        (d) => (args.where.id && d.id === args.where.id) || (args.where.phone && d.phone === args.where.phone)
      );
      if (!item) return null;
      return hydrateDriver(item, args.include);
    },
    findFirst: async (args?: { where?: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.drivers];
      if (args?.where) {
        list = list.filter((d) => {
          for (const [key, val] of Object.entries(args.where!)) {
            if (val !== undefined && (d as any)[key] !== val) return false;
          }
          return true;
        });
      }
      if (list.length === 0) return null;
      return hydrateDriver(list[0], args?.include);
    },
    create: async (args: { data: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `driver-${crypto.randomUUID()}`;
      const now = new Date();
      const newDrv: MemoryDriver = {
        id,
        name: args.data.name,
        phone: args.data.phone,
        licenseNumber: args.data.licenseNumber || null,
        transporterId: args.data.transporterId || null,
        isActive: args.data.isActive ?? true,
        verificationStatus: args.data.verificationStatus || 'VERIFIED',
        metadata: args.data.metadata || null,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.drivers.push(newDrv);
      memoryStore.saveToDisk();
      return hydrateDriver(newDrv, args.include);
    },
    update: async (args: { where: { id: string }; data: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.drivers.findIndex((d) => d.id === args.where.id);
      if (idx === -1) throw new Error('Driver not found for update');
      const existing = memoryStore.drivers[idx];
      const updated: MemoryDriver = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      memoryStore.drivers[idx] = updated;
      memoryStore.saveToDisk();
      return hydrateDriver(updated, args.include);
    },
  },
  transportDestination: {
    findMany: async (args?: { where?: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.transportDestinations];
      if (args?.where) {
        list = list.filter((d) => {
          for (const [key, val] of Object.entries(args.where!)) {
            if (val !== undefined && (d as any)[key] !== val) return false;
          }
          return true;
        });
      }
      return list.map((d) => hydrateTransportDestination(d));
    },
    findUnique: async (args: { where: { id?: string; code?: string } }) => {
      memoryStore.loadFromDisk();
      const item = memoryStore.transportDestinations.find(
        (d) => (args.where.id && d.id === args.where.id) || (args.where.code && d.code === args.where.code)
      );
      if (!item) return null;
      return hydrateTransportDestination(item);
    },
    findFirst: async (args?: { where?: any }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.transportDestinations];
      if (args?.where) {
        list = list.filter((d) => {
          for (const [key, val] of Object.entries(args.where!)) {
            if (val !== undefined && (d as any)[key] !== val) return false;
          }
          return true;
        });
      }
      if (list.length === 0) return null;
      return hydrateTransportDestination(list[0]);
    },
    create: async (args: { data: any }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `dest-${crypto.randomUUID()}`;
      const now = new Date();
      const newDest: MemoryTransportDestination = {
        id,
        code: args.data.code,
        name: args.data.name,
        destinationType: args.data.destinationType || 'WAREHOUSE',
        address: args.data.address,
        district: args.data.district,
        state: args.data.state,
        pincode: args.data.pincode || null,
        contactPerson: args.data.contactPerson || null,
        contactPhone: args.data.contactPhone || null,
        capacityQuintals: args.data.capacityQuintals ? new Prisma.Decimal(args.data.capacityQuintals) : null,
        isActive: args.data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.transportDestinations.push(newDest);
      memoryStore.saveToDisk();
      return hydrateTransportDestination(newDest);
    },
    update: async (args: { where: { id: string }; data: any }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.transportDestinations.findIndex((d) => d.id === args.where.id);
      if (idx === -1) throw new Error('TransportDestination not found for update');
      const existing = memoryStore.transportDestinations[idx];
      const updated: MemoryTransportDestination = {
        ...existing,
        ...args.data,
        capacityQuintals: args.data.capacityQuintals !== undefined
          ? (args.data.capacityQuintals ? new Prisma.Decimal(args.data.capacityQuintals) : null)
          : existing.capacityQuintals,
        updatedAt: new Date(),
      };
      memoryStore.transportDestinations[idx] = updated;
      memoryStore.saveToDisk();
      return hydrateTransportDestination(updated);
    },
  },
  transportRequest: {
    findMany: async (args?: { where?: any; include?: Record<string, boolean>; orderBy?: any }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.transportRequests];
      if (args?.where) {
        list = list.filter((tr) => {
          for (const [key, val] of Object.entries(args.where!)) {
            if (val !== undefined && (tr as any)[key] !== val) return false;
          }
          return true;
        });
      }
      return list.map((tr) => hydrateTransportRequest(tr, args?.include));
    },
    findUnique: async (args: { where: { id?: string; requestReference?: string }; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const item = memoryStore.transportRequests.find(
        (tr) => (args.where.id && tr.id === args.where.id) || (args.where.requestReference && tr.requestReference === args.where.requestReference)
      );
      if (!item) return null;
      return hydrateTransportRequest(item, args.include);
    },
    findFirst: async (args?: { where?: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.transportRequests];
      if (args?.where) {
        list = list.filter((tr) => {
          for (const [key, val] of Object.entries(args.where!)) {
            if (val !== undefined && (tr as any)[key] !== val) return false;
          }
          return true;
        });
      }
      if (list.length === 0) return null;
      return hydrateTransportRequest(list[0], args?.include);
    },
    create: async (args: { data: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `trq-${crypto.randomUUID()}`;
      const now = new Date();
      const newTrq: MemoryTransportRequest = {
        id,
        requestReference: args.data.requestReference,
        bookingId: args.data.bookingId,
        procurementCenterId: args.data.procurementCenterId,
        cropId: args.data.cropId,
        quantityQuintals: args.data.quantityQuintals instanceof Prisma.Decimal ? args.data.quantityQuintals : new Prisma.Decimal(args.data.quantityQuintals),
        quantityUnit: args.data.quantityUnit || 'QUINTAL',
        destinationType: args.data.destinationType || 'WAREHOUSE',
        destinationName: args.data.destinationName,
        destinationAddress: args.data.destinationAddress || args.data.destinationName || '',
        destinationDistrict: args.data.destinationDistrict || null,
        destinationState: args.data.destinationState || null,
        requestedDate: args.data.requestedDate ? new Date(args.data.requestedDate) : now,
        requiredCapacityQuintals: args.data.requiredCapacityQuintals instanceof Prisma.Decimal ? args.data.requiredCapacityQuintals : new Prisma.Decimal(args.data.requiredCapacityQuintals ?? args.data.quantityQuintals ?? 0),
        status: args.data.status || 'REQUESTED',
        vehicleId: args.data.vehicleId || null,
        transporterId: args.data.transporterId || null,
        driverId: args.data.driverId || null,
        driverName: args.data.driverName || null,
        driverPhone: args.data.driverPhone || null,
        assignedAt: args.data.assignedAt ? new Date(args.data.assignedAt) : null,
        dispatchedAt: args.data.dispatchedAt ? new Date(args.data.dispatchedAt) : null,
        arrivedAt: args.data.arrivedAt ? new Date(args.data.arrivedAt) : null,
        deliveredAt: args.data.deliveredAt ? new Date(args.data.deliveredAt) : null,
        cancelledAt: args.data.cancelledAt ? new Date(args.data.cancelledAt) : null,
        cancellationReason: args.data.cancellationReason || null,
        deliveryReceiverName: args.data.deliveryReceiverName || null,
        deliveryReceiverDesignation: args.data.deliveryReceiverDesignation || null,
        deliveryRemarks: args.data.deliveryRemarks || null,
        metadata: args.data.metadata || null,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.transportRequests.push(newTrq);
      memoryStore.saveToDisk();
      return hydrateTransportRequest(newTrq, args.include);
    },
    update: async (args: { where: { id: string }; data: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.transportRequests.findIndex((tr) => tr.id === args.where.id);
      if (idx === -1) throw new Error('TransportRequest not found for update');
      const existing = memoryStore.transportRequests[idx];
      const updated: MemoryTransportRequest = {
        ...existing,
        ...args.data,
        quantityQuintals: args.data.quantityQuintals !== undefined
          ? (args.data.quantityQuintals instanceof Prisma.Decimal ? args.data.quantityQuintals : new Prisma.Decimal(args.data.quantityQuintals))
          : existing.quantityQuintals,
        requiredCapacityQuintals: args.data.requiredCapacityQuintals !== undefined
          ? (args.data.requiredCapacityQuintals instanceof Prisma.Decimal ? args.data.requiredCapacityQuintals : new Prisma.Decimal(args.data.requiredCapacityQuintals))
          : existing.requiredCapacityQuintals,
        assignedAt: args.data.assignedAt !== undefined ? (args.data.assignedAt ? new Date(args.data.assignedAt) : null) : existing.assignedAt,
        dispatchedAt: args.data.dispatchedAt !== undefined ? (args.data.dispatchedAt ? new Date(args.data.dispatchedAt) : null) : existing.dispatchedAt,
        arrivedAt: args.data.arrivedAt !== undefined ? (args.data.arrivedAt ? new Date(args.data.arrivedAt) : null) : existing.arrivedAt,
        deliveredAt: args.data.deliveredAt !== undefined ? (args.data.deliveredAt ? new Date(args.data.deliveredAt) : null) : existing.deliveredAt,
        cancelledAt: args.data.cancelledAt !== undefined ? (args.data.cancelledAt ? new Date(args.data.cancelledAt) : null) : existing.cancelledAt,
        updatedAt: new Date(),
      };
      memoryStore.transportRequests[idx] = updated;
      memoryStore.saveToDisk();
      return hydrateTransportRequest(updated, args.include);
    },
  },
  transportLoad: {
    findMany: async (args?: { where?: any; include?: Record<string, boolean>; orderBy?: any }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.transportLoads];
      if (args?.where) {
        list = list.filter((tl) => {
          for (const [key, val] of Object.entries(args.where!)) {
            if (val !== undefined && (tl as any)[key] !== val) return false;
          }
          return true;
        });
      }
      return list.map((tl) => hydrateTransportLoad(tl, args?.include));
    },
    findUnique: async (args: { where: { id?: string; loadReference?: string }; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const item = memoryStore.transportLoads.find(
        (tl) => (args.where.id && tl.id === args.where.id) || (args.where.loadReference && tl.loadReference === args.where.loadReference)
      );
      if (!item) return null;
      return hydrateTransportLoad(item, args.include);
    },
    findFirst: async (args?: { where?: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.transportLoads];
      if (args?.where) {
        list = list.filter((tl) => {
          for (const [key, val] of Object.entries(args.where!)) {
            if (val !== undefined && (tl as any)[key] !== val) return false;
          }
          return true;
        });
      }
      if (list.length === 0) return null;
      return hydrateTransportLoad(list[0], args?.include);
    },
    create: async (args: { data: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `load-${crypto.randomUUID()}`;
      const now = new Date();
      const newLoad: MemoryTransportLoad = {
        id,
        loadReference: args.data.loadReference,
        transportRequestId: args.data.transportRequestId,
        bookingId: args.data.bookingId,
        vehicleId: args.data.vehicleId,
        sourceCenterId: args.data.sourceCenterId,
        destinationName: args.data.destinationName,
        cropId: args.data.cropId,
        quantityQuintals: args.data.quantityQuintals instanceof Prisma.Decimal ? args.data.quantityQuintals : new Prisma.Decimal(args.data.quantityQuintals),
        quantityUnit: args.data.quantityUnit || 'QUINTAL',
        loadingStartedAt: args.data.loadingStartedAt ? new Date(args.data.loadingStartedAt) : null,
        loadedAt: args.data.loadedAt ? new Date(args.data.loadedAt) : now,
        dispatchedAt: args.data.dispatchedAt ? new Date(args.data.dispatchedAt) : null,
        arrivedAt: args.data.arrivedAt ? new Date(args.data.arrivedAt) : null,
        deliveredAt: args.data.deliveredAt ? new Date(args.data.deliveredAt) : null,
        status: args.data.status || 'LOADED',
        metadata: args.data.metadata || null,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.transportLoads.push(newLoad);
      memoryStore.saveToDisk();
      return hydrateTransportLoad(newLoad, args.include);
    },
    update: async (args: { where: { id: string }; data: any; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.transportLoads.findIndex((tl) => tl.id === args.where.id);
      if (idx === -1) throw new Error('TransportLoad not found for update');
      const existing = memoryStore.transportLoads[idx];
      const updated: MemoryTransportLoad = {
        ...existing,
        ...args.data,
        quantityQuintals: args.data.quantityQuintals !== undefined
          ? (args.data.quantityQuintals instanceof Prisma.Decimal ? args.data.quantityQuintals : new Prisma.Decimal(args.data.quantityQuintals))
          : existing.quantityQuintals,
        dispatchedAt: args.data.dispatchedAt !== undefined ? (args.data.dispatchedAt ? new Date(args.data.dispatchedAt) : null) : existing.dispatchedAt,
        arrivedAt: args.data.arrivedAt !== undefined ? (args.data.arrivedAt ? new Date(args.data.arrivedAt) : null) : existing.arrivedAt,
        deliveredAt: args.data.deliveredAt !== undefined ? (args.data.deliveredAt ? new Date(args.data.deliveredAt) : null) : existing.deliveredAt,
        updatedAt: new Date(),
      };
      memoryStore.transportLoads[idx] = updated;
      memoryStore.saveToDisk();
      return hydrateTransportLoad(updated, args.include);
    },
  },
  notification: {
    findMany: async (args?: {
      where?: {
        userId?: string;
        type?: string;
        isRead?: boolean;
        entityType?: string;
        entityId?: string;
      };
      include?: Record<string, boolean>;
      orderBy?: { createdAt?: 'asc' | 'desc' };
      take?: number;
      skip?: number;
    }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.notifications];
      if (args?.where) {
        if (args.where.userId) list = list.filter((n) => n.userId === args.where!.userId);
        if (args.where.type) list = list.filter((n) => n.type === args.where!.type);
        if (args.where.isRead !== undefined) list = list.filter((n) => n.isRead === args.where!.isRead);
        if (args.where.entityType) list = list.filter((n) => n.entityType === args.where!.entityType);
        if (args.where.entityId) list = list.filter((n) => n.entityId === args.where!.entityId);
      }
      if (args?.orderBy?.createdAt === 'asc') {
        list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      } else {
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      if (args?.skip) {
        list = list.slice(args.skip);
      }
      if (args?.take) {
        list = list.slice(0, args.take);
      }
      return list.map((n) => hydrateNotification(n, args?.include));
    },
    findUnique: async (args: { where: { id: string }; include?: Record<string, boolean> }) => {
      memoryStore.loadFromDisk();
      const item = memoryStore.notifications.find((n) => n.id === args.where.id);
      if (!item) return null;
      return hydrateNotification(item, args.include);
    },
    findFirst: async (args?: {
      where?: {
        id?: string;
        userId?: string;
        type?: string;
        isRead?: boolean;
        entityType?: string;
        entityId?: string;
      };
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.notifications];
      if (args?.where) {
        if (args.where.id) list = list.filter((n) => n.id === args.where!.id);
        if (args.where.userId) list = list.filter((n) => n.userId === args.where!.userId);
        if (args.where.type) list = list.filter((n) => n.type === args.where!.type);
        if (args.where.isRead !== undefined) list = list.filter((n) => n.isRead === args.where!.isRead);
        if (args.where.entityType) list = list.filter((n) => n.entityType === args.where!.entityType);
        if (args.where.entityId) list = list.filter((n) => n.entityId === args.where!.entityId);
      }
      if (list.length === 0) return null;
      return hydrateNotification(list[0], args?.include);
    },
    count: async (args?: {
      where?: {
        userId?: string;
        type?: string;
        isRead?: boolean;
        entityType?: string;
        entityId?: string;
      };
    }) => {
      memoryStore.loadFromDisk();
      let list = [...memoryStore.notifications];
      if (args?.where) {
        if (args.where.userId) list = list.filter((n) => n.userId === args.where!.userId);
        if (args.where.type) list = list.filter((n) => n.type === args.where!.type);
        if (args.where.isRead !== undefined) list = list.filter((n) => n.isRead === args.where!.isRead);
        if (args.where.entityType) list = list.filter((n) => n.entityType === args.where!.entityType);
        if (args.where.entityId) list = list.filter((n) => n.entityId === args.where!.entityId);
      }
      return list.length;
    },
    create: async (args: {
      data: Omit<MemoryNotification, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      const id = args.data.id || `notif-${crypto.randomUUID()}`;
      const now = new Date();
      const newNotif: MemoryNotification = {
        id,
        userId: args.data.userId,
        type: args.data.type || 'SYSTEM',
        title: args.data.title,
        message: args.data.message,
        severity: args.data.severity || 'INFO',
        channel: args.data.channel || 'IN_APP',
        isRead: args.data.isRead ?? false,
        sentStatus: args.data.sentStatus || 'DELIVERED',
        entityType: args.data.entityType || null,
        entityId: args.data.entityId || null,
        reference: args.data.reference || null,
        metadata: args.data.metadata || null,
        readAt: args.data.readAt || null,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.notifications.push(newNotif);
      memoryStore.saveToDisk();
      return hydrateNotification(newNotif, args.include);
    },
    update: async (args: {
      where: { id: string };
      data: Partial<MemoryNotification>;
      include?: Record<string, boolean>;
    }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.notifications.findIndex((n) => n.id === args.where.id);
      if (idx === -1) throw new Error('Notification not found for update');
      const existing = memoryStore.notifications[idx];
      const updated: MemoryNotification = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      memoryStore.notifications[idx] = updated;
      memoryStore.saveToDisk();
      return hydrateNotification(updated, args.include);
    },
    updateMany: async (args: {
      where: { userId?: string; id?: string; isRead?: boolean };
      data: Partial<MemoryNotification>;
    }) => {
      memoryStore.loadFromDisk();
      let count = 0;
      memoryStore.notifications = memoryStore.notifications.map((n) => {
        let match = true;
        if (args.where.userId && n.userId !== args.where.userId) match = false;
        if (args.where.id && n.id !== args.where.id) match = false;
        if (args.where.isRead !== undefined && n.isRead !== args.where.isRead) match = false;
        if (match) {
          count++;
          return {
            ...n,
            ...args.data,
            updatedAt: new Date(),
          };
        }
        return n;
      });
      memoryStore.saveToDisk();
      return { count };
    },
    delete: async (args: { where: { id: string } }) => {
      memoryStore.loadFromDisk();
      const idx = memoryStore.notifications.findIndex((n) => n.id === args.where.id);
      if (idx === -1) throw new Error('Notification not found for delete');
      const deleted = memoryStore.notifications.splice(idx, 1)[0];
      memoryStore.saveToDisk();
      return hydrateNotification(deleted);
    },
  },
};

function hydrateNotification(n: MemoryNotification, include?: Record<string, boolean>) {
  const item: Record<string, unknown> = { ...n };
  if (include?.user) {
    const user = memoryStore.users.find((u) => u.id === n.userId);
    item.user = user ? { id: user.id, name: user.name, phone: user.phone, email: user.email } : null;
  }
  return item;
}

function hydrateSettlement(s: MemorySettlement, include?: Record<string, boolean>) {
  const item: Record<string, unknown> = { ...s };
  if (include?.booking) {
    const booking = memoryStore.bookings.find((b) => b.id === s.bookingId);
    item.booking = booking ? hydrateBooking(booking) : null;
  }
  if (include?.farmerProfile) {
    const prof = memoryStore.farmerProfiles.find((fp) => fp.id === s.farmerProfileId);
    if (prof) {
      const user = memoryStore.users.find((u) => u.id === prof.userId);
      item.farmerProfile = {
        ...prof,
        user: user ? { id: user.id, name: user.name, phone: user.phone, email: user.email } : null,
      };
    } else {
      item.farmerProfile = null;
    }
  }
  if (include?.crop) {
    item.crop = memoryStore.crops.find((c) => c.id === s.cropId) || null;
  }
  if (include?.payments) {
    item.payments = memoryStore.payments.filter((p) => p.settlementId === s.id).map((p) => hydratePayment(p));
  }
  return item;
}

function hydratePayment(p: MemoryPayment, include?: Record<string, boolean>) {
  const item: Record<string, unknown> = { ...p };
  if (include?.settlement) {
    const settlement = memoryStore.settlements.find((s) => s.id === p.settlementId);
    item.settlement = settlement ? hydrateSettlement(settlement) : null;
  }
  if (include?.farmerProfile) {
    const prof = memoryStore.farmerProfiles.find((fp) => fp.id === p.farmerProfileId);
    if (prof) {
      const user = memoryStore.users.find((u) => u.id === prof.userId);
      item.farmerProfile = {
        ...prof,
        user: user ? { id: user.id, name: user.name, phone: user.phone, email: user.email } : null,
      };
    } else {
      item.farmerProfile = null;
    }
  }
  return item;
}


function hydrateQualityInspection(qi: MemoryQualityInspection, include?: Record<string, boolean>) {
  const item: Record<string, unknown> = { ...qi };
  if (include?.booking) {
    const booking = memoryStore.bookings.find((b) => b.id === qi.bookingId);
    item.booking = booking ? hydrateBooking(booking) : null;
  }
  if (include?.farmerProfile) {
    const prof = memoryStore.farmerProfiles.find((fp) => fp.id === qi.farmerProfileId);
    if (prof) {
      const user = memoryStore.users.find((u) => u.id === prof.userId);
      item.farmerProfile = {
        ...prof,
        user: user ? { id: user.id, name: user.name, phone: user.phone, email: user.email } : null,
      };
    } else {
      item.farmerProfile = null;
    }
  }
  if (include?.crop) {
    item.crop = memoryStore.crops.find((c) => c.id === qi.cropId) || null;
  }
  if (include?.procurementCenter) {
    item.procurementCenter = memoryStore.procurementCenters.find((c) => c.id === qi.procurementCenterId) || null;
  }
  if (include?.inspector && qi.inspectorId) {
    const user = memoryStore.users.find((u) => u.id === qi.inspectorId);
    item.inspector = user ? { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role } : null;
  }
  return item;
}

function hydrateWeighment(w: MemoryWeighment, include?: Record<string, boolean>) {
  const item: Record<string, unknown> = { ...w };
  if (include?.booking) {
    const booking = memoryStore.bookings.find((b) => b.id === w.bookingId);
    item.booking = booking ? hydrateBooking(booking) : null;
  }
  if (include?.procurementCenter) {
    item.procurementCenter = memoryStore.procurementCenters.find((c) => c.id === w.procurementCenterId) || null;
  }
  if (include?.weighingOperator) {
    const user = memoryStore.users.find((u) => u.id === w.weighingOperatorId);
    item.weighingOperator = user ? { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role } : null;
  }
  return item;
}

function hydrateBooking(b: MemoryBooking, include?: Record<string, boolean>) {
  const item: Record<string, unknown> = { ...b };
  if (include?.farmerProfile) {
    const prof = memoryStore.farmerProfiles.find((fp) => fp.id === b.farmerProfileId);
    if (prof) {
      const user = memoryStore.users.find((u) => u.id === prof.userId);
      item.farmerProfile = {
        ...prof,
        user: user ? { id: user.id, name: user.name, phone: user.phone, email: user.email } : null,
      };
    } else {
      item.farmerProfile = null;
    }
  }
  if (include?.farm) {
    item.farm = memoryStore.farms.find((f) => f.id === b.farmId) || null;
  }
  if (include?.crop) {
    item.crop = memoryStore.crops.find((c) => c.id === b.cropId) || null;
  }
  if (include?.procurementCenter) {
    item.procurementCenter = memoryStore.procurementCenters.find((c) => c.id === b.procurementCenterId) || null;
  }
  if (include?.centerBay && b.centerBayId) {
    item.centerBay = memoryStore.centerBays.find((bay) => bay.id === b.centerBayId) || null;
  }
  if (include?.bookingSlot) {
    item.bookingSlot = memoryStore.bookingSlots.find((s) => s.id === b.bookingSlotId) || null;
  }
  if (include?.lockedMspRate) {
    item.lockedMspRate = memoryStore.mspRates.find((m) => m.id === b.lockedMspRateId) || null;
  }
  return item;
}

function hydrateTransporter(t: MemoryTransporter, include?: Record<string, boolean>) {
  const item: Record<string, unknown> = { ...t };
  if (include?.vehicles) {
    item.vehicles = memoryStore.vehicles.filter((v) => v.transporterId === t.id).map((v) => hydrateVehicle(v));
  }
  if (include?.drivers) {
    item.drivers = memoryStore.drivers.filter((d) => d.transporterId === t.id).map((d) => hydrateDriver(d));
  }
  if (include?.transportRequests) {
    item.transportRequests = memoryStore.transportRequests.filter((tr) => tr.transporterId === t.id).map((tr) => hydrateTransportRequest(tr));
  }
  return item;
}

function hydrateVehicle(v: MemoryVehicle, include?: Record<string, boolean>) {
  const item: Record<string, unknown> = { ...v };
  if (include?.transporter && v.transporterId) {
    item.transporter = memoryStore.transporters.find((t) => t.id === v.transporterId) || null;
  }
  if (include?.loads) {
    item.loads = memoryStore.transportLoads.filter((l) => l.vehicleId === v.id).map((l) => hydrateTransportLoad(l));
  }
  return item;
}

function hydrateDriver(d: MemoryDriver, include?: Record<string, boolean>) {
  const item: Record<string, unknown> = { ...d };
  if (include?.transporter && d.transporterId) {
    item.transporter = memoryStore.transporters.find((t) => t.id === d.transporterId) || null;
  }
  return item;
}

function hydrateTransportDestination(dest: MemoryTransportDestination) {
  return { ...dest };
}

function hydrateTransportRequest(tr: MemoryTransportRequest, include?: Record<string, boolean>) {
  const item: Record<string, unknown> = { ...tr };
  if (include?.booking) {
    const booking = memoryStore.bookings.find((b) => b.id === tr.bookingId);
    item.booking = booking ? hydrateBooking(booking) : null;
  }
  if (include?.procurementCenter) {
    item.procurementCenter = memoryStore.procurementCenters.find((c) => c.id === tr.procurementCenterId) || null;
  }
  if (include?.crop) {
    item.crop = memoryStore.crops.find((c) => c.id === tr.cropId) || null;
  }
  if (include?.vehicle && tr.vehicleId) {
    const veh = memoryStore.vehicles.find((v) => v.id === tr.vehicleId);
    item.vehicle = veh ? hydrateVehicle(veh) : null;
  }
  if (include?.transporter && tr.transporterId) {
    item.transporter = memoryStore.transporters.find((t) => t.id === tr.transporterId) || null;
  }
  if (include?.driver && tr.driverId) {
    item.driver = memoryStore.drivers.find((d) => d.id === tr.driverId) || null;
  }
  if (include?.loads) {
    item.loads = memoryStore.transportLoads.filter((l) => l.transportRequestId === tr.id).map((l) => hydrateTransportLoad(l));
  }
  return item;
}

function hydrateTransportLoad(tl: MemoryTransportLoad, include?: Record<string, boolean>) {
  const item: Record<string, unknown> = { ...tl };
  if (include?.vehicle) {
    const veh = memoryStore.vehicles.find((v) => v.id === tl.vehicleId);
    item.vehicle = veh ? hydrateVehicle(veh) : null;
  }
  if (include?.transportRequest) {
    const tr = memoryStore.transportRequests.find((r) => r.id === tl.transportRequestId);
    item.transportRequest = tr ? hydrateTransportRequest(tr) : null;
  }
  return item;
}

// Generic Proxy that catches DB connection issues and diverts to memoryHandlers
function createResilientPrismaClient(client: PrismaClient): PrismaClient {
  return new Proxy(client, {
    get(target, prop: string | symbol, receiver) {
      if (prop === '$queryRaw') {
        return async () => {
          if (forceMemoryMode) return [{ '?column?': 1 }];
          try {
            return await (target as any)[prop];
          } catch (err) {
            if (isDbConnectionError(err)) {
              forceMemoryMode = true;
              return [{ '?column?': 1 }];
            }
            throw err;
          }
        };
      }

      if (prop === '$disconnect') {
        return async () => {
          try {
            await target.$disconnect();
          } catch {
            // Ignore disconnect errors
          }
        };
      }

      if (typeof prop === 'string' && prop in memoryHandlers) {
        const memoryModel = (memoryHandlers as any)[prop];
        return new Proxy((target as any)[prop] || {}, {
          get(modelTarget, method: string) {
            return async (...args: any[]) => {
              if (forceMemoryMode || typeof modelTarget[method] !== 'function') {
                if (memoryModel[method]) {
                  return memoryModel[method](...args);
                }
              }
              try {
                return await modelTarget[method](...args);
              } catch (err) {
                if (isDbConnectionError(err) || (err as any)?.code === 'P2021' || (err as any)?.code === 'P2022') {
                  if (memoryModel[method]) {
                    return memoryModel[method](...args);
                  }
                }
                throw err;
              }
            };
          },
        });
      }

      return Reflect.get(target, prop, receiver);
    },
  });
}

export const prisma: PrismaClient & {
  qualityInspection: any;
  weighment: any;
  cropGrading: any;
  settlement: any;
  payment: any;
  transporter: any;
  vehicle: any;
  driver: any;
  transportDestination: any;
  transportRequest: any;
  transportLoad: any;
  notification: any;
} = createResilientPrismaClient(realPrisma) as any;

export async function checkDatabaseConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const timeoutPromise = new Promise<{ connected: boolean; error: string }>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout - Database in standby')), 5000)
    );

    await Promise.race([realPrisma.$queryRaw`SELECT 1`, timeoutPromise]);
    forceMemoryMode = false;
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    forceMemoryMode = true;
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Database connection unavailable',
    };
  }
}
