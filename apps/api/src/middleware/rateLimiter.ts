// ==============================================================================
// KisanFlow — In-Memory Sliding-Window Rate Limiter & Abuse Protection
// Protects authentication, booking creation, payments, and AI inference endpoints
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse.ts';
import { logger } from '../utils/logger.ts';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  code?: string;
  skipFailedRequests?: boolean;
}

interface ClientTracker {
  count: number;
  resetTime: number;
}

const clientStores = new Map<string, Map<string, ClientTracker>>();

/**
 * Creates a rate limiting middleware based on in-memory sliding window counters
 */
export function createRateLimiter(options: RateLimitConfig) {
  const storeId = `${options.windowMs}-${options.maxRequests}`;
  if (!clientStores.has(storeId)) {
    clientStores.set(storeId, new Map<string, ClientTracker>());
  }
  const store = clientStores.get(storeId)!;

  // Periodic cleanup of expired entries
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (now > value.resetTime) {
        store.delete(key);
      }
    }
  }, Math.max(60000, options.windowMs / 2));

  return (req: Request, res: Response, next: NextFunction): void => {
    // Determine client identifier: authenticated user ID or remote IP
    const clientId = (req as any).user?.id || req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-client';
    const now = Date.now();

    let tracker = store.get(String(clientId));
    if (!tracker || now > tracker.resetTime) {
      tracker = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      store.set(String(clientId), tracker);
    } else {
      tracker.count++;
    }

    const remaining = Math.max(0, options.maxRequests - tracker.count);
    const resetSeconds = Math.ceil((tracker.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (tracker.count > options.maxRequests) {
      res.setHeader('Retry-After', resetSeconds);
      logger.warn(
        `Rate limit exceeded for client ${clientId} on ${req.method} ${req.originalUrl} (${tracker.count}/${options.maxRequests})`,
        'RateLimiter'
      );
      sendError(
        res,
        options.message || 'Too many requests. Please slow down and try again later.',
        429,
        options.code || 'RATE_LIMIT_EXCEEDED'
      );
      return;
    }

    next();
  };
}

// Preset rate limiters for high-risk operations
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50,
  message: 'Too many authentication attempts. Please try again after a few minutes.',
  code: 'AUTH_RATE_LIMIT_EXCEEDED',
});

export const bookingRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 60,
  message: 'Booking request limit reached. Please wait before creating more slot reservations.',
  code: 'BOOKING_RATE_LIMIT_EXCEEDED',
});

export const paymentRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 40,
  message: 'Payment action threshold reached. Please allow time between DBT batches.',
  code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
});

export const gradingRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: 'Quality grading inference rate limit reached.',
  code: 'GRADING_RATE_LIMIT_EXCEEDED',
});
