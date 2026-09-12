// ==============================================================================
// KisanFlow — Unified Full-Stack Application Server (Vite + Express)
// ==============================================================================

import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './apps/api/src/app.ts';
import { logger } from './apps/api/src/utils/logger.ts';

async function startServer() {
  const app = createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Vite middleware for frontend in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🌾 KisanFlow Unified Full-Stack Server listening on http://0.0.0.0:${PORT}`);
    logger.info(`🔗 API Health: http://localhost:${PORT}/api/health`);
    logger.info(`🖥️  Frontend: http://localhost:${PORT}/`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error in KisanFlow server:', err);
  process.exit(1);
});
