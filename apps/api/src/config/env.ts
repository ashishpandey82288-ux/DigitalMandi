// ==============================================================================
// KisanFlow — Environment Variable Validation & Configuration
// ==============================================================================

import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().default('kisanflow-dev-secret-do-not-use-in-production'),
  ALLOWED_ORIGINS: z.string().optional(),
  DATABASE_URL: z.string().optional().default('postgresql://kisanflow_user:kisanflow_secure_password@localhost:5432/kisanflow_db?schema=public'),
  REDIS_URL: z.string().optional().default('redis://localhost:6379'),
  ML_SERVICE_URL: z.string().default('http://localhost:8000'),
  DEMO_MODE: z.coerce.boolean().default(true),
  
  // Weather (Open-Meteo)
  WEATHER_API_URL: z.string().default('https://api.open-meteo.com/v1/forecast'),
  WEATHER_API_KEY: z.string().optional(),
  WEATHER_PROVIDER: z.string().default('open-meteo'),

  // AI & Translation (Gemini)
  GEMINI_API_KEY: z.string().optional(),
  TRANSLATION_PROVIDER: z.string().default('gemini'),
  BHASHINI_API_KEY: z.string().optional(),

  // Government Open Data (data.gov.in)
  DATA_GOV_API_URL: z.string().default('https://api.data.gov.in'),
  DATA_GOV_API_KEY: z.string().optional(),
  DATA_GOV_MANDI_RESOURCE_ID: z.string().optional(),
  DATA_GOV_KCC_RESOURCE_ID: z.string().optional(),

  // DBT & Payments (Simulation Mode)
  DBT_MODE: z.string().default('simulation'),
  DBT_API_URL: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),

  // DILRMP — Mandatory Official Land Cadastral API Configuration (DO NOT CHANGE)
  DILRMP_API_URL: z.string().default('https://api.dilrmp.nic.in/land/v1'),

  // Legacy / Compatibility variables
  IMD_API_URL: z.string().optional(),
  ENAM_API_URL: z.string().optional(),
  KCC_API_URL: z.string().optional(),

  // Authentication & Communications
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  WHATSAPP_API_URL: z.string().optional(),
  IVR_API_URL: z.string().optional(),
  SMS_API_URL: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.warn('⚠️ Warning: Some environment variables have defaults or format issues:');
  console.warn(JSON.stringify(parsedEnv.error.format(), null, 2));
}

export const env = parsedEnv.success ? parsedEnv.data : envSchema.parse({});

// Guarantee process.env populated for third-party libraries (e.g., Prisma datasource)
if (!process.env.DATABASE_URL && env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}
if (!process.env.REDIS_URL && env.REDIS_URL) {
  process.env.REDIS_URL = env.REDIS_URL;
}
if (!process.env.JWT_SECRET && env.JWT_SECRET) {
  process.env.JWT_SECRET = env.JWT_SECRET;
}
