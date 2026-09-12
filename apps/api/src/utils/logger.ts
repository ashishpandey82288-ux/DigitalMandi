// ==============================================================================
// KisanFlow — Structured Logger Utility
// ==============================================================================

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: unknown;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'jwt',
  'jwt_secret',
  'authorization',
  'apikey',
  'api_key',
  'gemini_api_key',
  'razorpay_key_secret',
  'firebase_private_key',
  'privatekey',
  'private_key',
  'client_secret',
]);

function sanitizeData(data: unknown, depth = 0): unknown {
  if (depth > 5 || data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, depth + 1));
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('token')) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeData(value, depth + 1);
    }
  }
  return sanitized;
}

function formatLog(level: LogLevel, message: string, context?: string, data?: unknown): LogPayload {
  const cleanData = data !== undefined ? sanitizeData(data) : undefined;
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {}),
    ...(cleanData !== undefined ? { data: cleanData } : {}),
  };
}

export const logger = {
  info(message: string, context?: string, data?: unknown) {
    const log = formatLog('info', message, context, data);
    console.log(`[INFO] [${log.timestamp}]${context ? ` [${context}]` : ''} ${message}`, log.data !== undefined ? log.data : '');
  },
  warn(message: string, context?: string, data?: unknown) {
    const log = formatLog('warn', message, context, data);
    console.warn(`[WARN] [${log.timestamp}]${context ? ` [${context}]` : ''} ${message}`, log.data !== undefined ? log.data : '');
  },
  error(message: string, context?: string, data?: unknown) {
    const log = formatLog('error', message, context, data);
    console.error(`[ERROR] [${log.timestamp}]${context ? ` [${context}]` : ''} ${message}`, log.data !== undefined ? log.data : '');
  },
  debug(message: string, context?: string, data?: unknown) {
    if (process.env.NODE_ENV === 'development') {
      const log = formatLog('debug', message, context, data);
      console.debug(`[DEBUG] [${log.timestamp}]${context ? ` [${context}]` : ''} ${message}`, log.data !== undefined ? log.data : '');
    }
  },
};
