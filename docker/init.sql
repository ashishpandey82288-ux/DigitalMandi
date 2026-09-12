-- KisanFlow PostgreSQL Initialization Script (Phase 1)
-- Prepares database extensions if needed for future spatial & crypto indexing

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant schema permissions
GRANT ALL PRIVILEGES ON DATABASE kisanflow_db TO kisanflow_user;
