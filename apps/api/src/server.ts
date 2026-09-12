// ==============================================================================
// KisanFlow — Backend API Server Entrypoint
// ==============================================================================

import { app } from './app.ts';
import { env } from './config/env.ts';
import { logger } from './utils/logger.ts';

const PORT = env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🌾 KisanFlow API server running on port ${PORT} [${env.NODE_ENV}]`);
  logger.info(`👉 Health check endpoint: http://localhost:${PORT}/api/health`);
});
