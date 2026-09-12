// ==============================================================================
// KisanFlow — Image Storage Service Abstraction
// Supports LocalStorageProvider & Cloud ObjectStorageProvider (R2 / S3 / Supabase)
// ==============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env.ts';
import { logger } from '../utils/logger.ts';

export interface StorageUploadResult {
  key: string;
  url: string;
  provider: 'local' | 'object_storage';
  sizeBytes: number;
}

export interface StorageProvider {
  name: string;
  upload(buffer: Buffer, filename: string, mimeType: string): Promise<StorageUploadResult>;
  get(key: string): Promise<{ data: Buffer; mimeType: string } | null>;
  delete(key: string): Promise<boolean>;
  getUrl(key: string): string;
  isConfigured(): boolean;
}

// ------------------------------------------------------------------------------
// 1. Local Storage Provider (Default / Ephemeral Fallback)
// ------------------------------------------------------------------------------
export class LocalStorageProvider implements StorageProvider {
  public name = 'local';
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      try {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
      } catch (err: any) {
        logger.warn(`Failed to create local uploads directory: ${err.message}`);
      }
    }
  }

  public isConfigured(): boolean {
    return true; // Always operational locally
  }

  public async upload(buffer: Buffer, filename: string, mimeType: string): Promise<StorageUploadResult> {
    const ext = path.extname(filename) || '.jpg';
    const uniqueKey = `crop_quality_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    const targetPath = path.join(this.uploadsDir, uniqueKey);

    await fs.promises.writeFile(targetPath, buffer);

    const baseUrl = env.APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}/uploads/${uniqueKey}`;

    return {
      key: uniqueKey,
      url,
      provider: 'local',
      sizeBytes: buffer.length,
    };
  }

  public async get(key: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const targetPath = path.join(this.uploadsDir, path.basename(key));
    if (!fs.existsSync(targetPath)) {
      return null;
    }
    const data = await fs.promises.readFile(targetPath);
    return { data, mimeType: 'image/jpeg' };
  }

  public async delete(key: string): Promise<boolean> {
    const targetPath = path.join(this.uploadsDir, path.basename(key));
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
      return true;
    }
    return false;
  }

  public getUrl(key: string): string {
    const baseUrl = env.APP_URL || 'http://localhost:3000';
    return `${baseUrl}/uploads/${path.basename(key)}`;
  }
}

// ------------------------------------------------------------------------------
// 2. Cloud Object Storage Provider (Cloudflare R2 / Supabase Storage / S3)
// ------------------------------------------------------------------------------
export class ObjectStorageProvider implements StorageProvider {
  public name = 'object_storage';
  private bucketName?: string;
  private endpoint?: string;
  private accessKeyId?: string;
  private secretAccessKey?: string;
  private publicUrl?: string;

  constructor() {
    this.bucketName = process.env.STORAGE_BUCKET_NAME;
    this.endpoint = process.env.STORAGE_ENDPOINT;
    this.accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
    this.publicUrl = process.env.STORAGE_PUBLIC_URL;
  }

  public isConfigured(): boolean {
    return Boolean(
      this.bucketName &&
      this.endpoint &&
      this.accessKeyId &&
      this.secretAccessKey
    );
  }

  public async upload(buffer: Buffer, filename: string, mimeType: string): Promise<StorageUploadResult> {
    if (!this.isConfigured()) {
      throw new Error('Object storage credentials are not configured.');
    }

    const ext = path.extname(filename) || '.jpg';
    const uniqueKey = `crops/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

    const uploadUrl = `${this.endpoint!.replace(/\/$/, '')}/${this.bucketName}/${uniqueKey}`;
    
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(buffer.length),
        'Authorization': `Bearer ${this.secretAccessKey}`,
      },
      body: buffer as unknown as BodyInit,
    });

    if (!response.ok) {
      throw new Error(`Object storage upload failed with HTTP status ${response.status}`);
    }

    const publicBase = this.publicUrl || `${this.endpoint}/${this.bucketName}`;
    const url = `${publicBase.replace(/\/$/, '')}/${uniqueKey}`;

    return {
      key: uniqueKey,
      url,
      provider: 'object_storage',
      sizeBytes: buffer.length,
    };
  }

  public async get(key: string): Promise<{ data: Buffer; mimeType: string } | null> {
    if (!this.isConfigured()) return null;
    const fetchUrl = `${this.endpoint!.replace(/\/$/, '')}/${this.bucketName}/${key}`;
    const res = await fetch(fetchUrl);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    return { data: Buffer.from(arrayBuf), mimeType };
  }

  public async delete(key: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const fetchUrl = `${this.endpoint!.replace(/\/$/, '')}/${this.bucketName}/${key}`;
    const res = await fetch(fetchUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.secretAccessKey}`,
      },
    });
    return res.ok;
  }

  public getUrl(key: string): string {
    const publicBase = this.publicUrl || `${this.endpoint}/${this.bucketName}`;
    return `${publicBase.replace(/\/$/, '')}/${key}`;
  }
}

// ------------------------------------------------------------------------------
// 3. Facade Service: ImageStorageService
// ------------------------------------------------------------------------------
export class ImageStorageService {
  private localProvider: LocalStorageProvider;
  private objectProvider: ObjectStorageProvider;

  constructor() {
    this.localProvider = new LocalStorageProvider();
    this.objectProvider = new ObjectStorageProvider();
  }

  public getActiveProvider(): StorageProvider {
    if (this.objectProvider.isConfigured()) {
      return this.objectProvider;
    }
    return this.localProvider;
  }

  public async uploadCropQualityImage(
    buffer: Buffer,
    filename: string,
    mimeType: string = 'image/jpeg'
  ): Promise<StorageUploadResult> {
    const provider = this.getActiveProvider();
    try {
      return await provider.upload(buffer, filename, mimeType);
    } catch (err: any) {
      logger.warn(`Primary storage provider [${provider.name}] failed: ${err.message}. Falling back to local storage.`);
      return await this.localProvider.upload(buffer, filename, mimeType);
    }
  }

  public getStatus(): {
    provider: string;
    configured: boolean;
    persistent: boolean;
    storageType: string;
    message: string;
  } {
    if (this.objectProvider.isConfigured()) {
      return {
        provider: 'object_storage',
        configured: true,
        persistent: true,
        storageType: 'S3-Compatible Object Store (R2/Supabase/S3)',
        message: 'Persistent cloud object storage is configured and operational.',
      };
    }

    return {
      provider: 'local',
      configured: false,
      persistent: false,
      storageType: 'Local Ephemeral Filesystem (uploads/)',
      message: 'IMAGE STORAGE: NOT CONFIGURED for cloud persistence. Running on local/ephemeral disk.',
    };
  }
}

export const imageStorageService = new ImageStorageService();
