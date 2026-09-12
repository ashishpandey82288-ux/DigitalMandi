// ==============================================================================
// KisanFlow — Express Application Configuration
// ==============================================================================

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import routes from './routes/index.ts';
import healthRoutes from './routes/health.routes.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import { notFoundHandler } from './middleware/notFound.ts';
import { logger } from './utils/logger.ts';
import { env } from './config/env.ts';

export function createApp(): Express {
  const app = express();

  // 1. Request logging & timing middleware (scoped to API endpoints only)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.originalUrl.startsWith('/api') && !req.originalUrl.startsWith('/health') && !req.originalUrl.startsWith('/ready')) {
      return next();
    }
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  // 2. Security & CORS Configuration
  const allowedOrigins = (env.ALLOWED_ORIGINS || `${env.APP_URL},http://localhost:5173,http://localhost:3000`)
    .split(',')
    .map((o: string) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow non-browser clients (curl, mobile apps, server-to-server health checks)
        if (!origin) return callback(null, true);
        // In development or test, allow all origins
        if (env.NODE_ENV !== 'production') return callback(null, true);
        // In production, validate against configured allowed origins
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy violation: Origin '${origin}' is not authorized`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Root-level health & readiness probes for orchestrators (K8s / Cloud Run)
  app.use('/', healthRoutes);

  // 3. Top-Level Request Deserialization (ORDERING GUARANTEE)
  // Must be mounted before any routes
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. API Routes
  app.use('/api', routes);

  // 5. 404 handler for unmatched API routes
  app.use('/api/*', notFoundHandler);

  // 6. Centralized global error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
