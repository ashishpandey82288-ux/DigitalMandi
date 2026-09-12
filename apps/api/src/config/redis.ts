// ==============================================================================
// KisanFlow — Redis Client Configuration (Cache, Live Queue, Distributed Locks)
// ==============================================================================

import Redis from 'ioredis';
import { env } from './env.ts';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // Stop retrying if Redis is not running locally in Phase 1
        }
        return Math.min(times * 100, 1000);
      },
      showFriendlyErrorStack: true,
    });

    redisClient.on('error', (err) => {
      // Non-fatal error logger for phase 1 development
      if (env.NODE_ENV === 'development') {
        // Suppress repetitive log flood if standalone Redis isn't started
      }
    });
  }
  return redisClient;
}

export async function checkRedisConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  const client = getRedisClient();
  const start = Date.now();
  try {
    if (client.status !== 'ready' && client.status !== 'connecting') {
      await client.connect();
    }
    await client.ping();
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Redis instance unavailable',
    };
  }
}
