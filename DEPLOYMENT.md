# KisanFlow — Production Deployment & Operations Manual

## 1. System Architecture Overview

KisanFlow is an enterprise-grade agricultural procurement and Direct Benefit Transfer (DBT) platform built for high resilience, multi-tier compliance, and extreme scalability.

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 Internet / Users                       │
                  │   (Farmers, Mandi Operators, Quality Graders, Admins)  │
                  └───────────────────────────┬────────────────────────────┘
                                              │ HTTPS (443)
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │         Reverse Proxy / Edge Gateway / CDN             │
                  │       (Nginx / Cloudflare / AWS CloudFront)            │
                  └─────────────┬───────────────────────────┬──────────────┘
                                │                           │
                 /api /health   │                           │ /* (Static SPA)
                                ▼                           ▼
            ┌───────────────────────────────┐   ┌───────────────────────────┐
            │   KisanFlow API Service       │   │  KisanFlow Web Frontend   │
            │   (Node.js 20 / Express)      │   │  (React 19 / Vite / Nginx)│
            │   Port: 3000                  │   │  Port: 80 / Static Host   │
            └───────┬──────────────┬────────┘   └───────────────────────────┘
                    │              │
      ┌─────────────┼──────────────┼────────────────┐
      │             │              │                │
      ▼             ▼              ▼                ▼
┌───────────┐ ┌───────────┐ ┌───────────────┐ ┌──────────────────────────┐
│PostgreSQL │ │  Redis 7  │ │ML Vision Svcs │ │ External Providers       │
│  (DB)     │ │  (Cache)  │ │ (FastAPI:8000)│ │ - DILRMP Land Registry   │
│ Port 5432 │ │ Port 6379 │ │ Self-Hosted   │ │ - Open-Meteo Weather     │
└───────────┘ └───────────┘ └───────────────┘ │ - Data.gov.in Mandi API  │
                                              │ - Gemini AI / Translations│
                                              │ - Razorpay / PFMS DBT    │
                                              └──────────────────────────┘
```

---

## 2. Infrastructure & Hosting Recommendations

KisanFlow can be deployed across multiple topologies depending on budget, regulatory requirements, and scale.

### Option A: Free-Tier / Low-Cost Staging & Pilot Launch
| Component | Recommended Provider | Tier / Configuration | Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | Vercel / Cloudflare Pages / Netlify | Static SPA hosting with global Edge CDN | $0 (Free) |
| **Backend API** | Render / Railway / Fly.io | Standard Node Web Service (512MB–1GB RAM) | $0 - $7 |
| **PostgreSQL** | Supabase / Neon / Aiven | Managed PostgreSQL 16 (Free tier / 0.5 GB) | $0 (Free) |
| **Redis** | Upstash / Redis Cloud | Serverless Redis (10k requests/day free) | $0 (Free) |
| **ML Service** | Hugging Face Spaces / Railway / Render | Python 3.11 Docker / Micro instance | $0 - $5 |

### Option B: Enterprise Government / Production Cloud (GovCloud / AWS / GCP)
| Component | AWS Architecture | GCP Architecture | Azure Architecture |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | CloudFront + S3 Bucket | Cloud Storage + Cloud CDN | Azure Front Door + Blob Storage |
| **Backend API** | ECS Fargate (Auto-scaling 2–10 tasks) | Cloud Run (2–10 instances, 1 vCPU, 1GB) | Azure Container Apps |
| **PostgreSQL** | AWS RDS PostgreSQL 16 (Multi-AZ) | Cloud SQL for PostgreSQL 16 (HA) | Azure Database for PostgreSQL (Flexible) |
| **Redis** | AWS ElastiCache for Redis (Cluster mode) | Memorystore for Redis | Azure Cache for Redis |
| **ML Service** | ECS Fargate / SageMaker Serverless | Cloud Run (Dedicated CPU / GPU optional) | Azure Container Apps |

---

## 3. Environment Separation Matrix

KisanFlow cleanly distinguishes between execution environments:

| Feature / Setting | Development | Demo / Staging | Production |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `development` | `production` | `production` |
| `DEMO_MODE` | `true` | `true` | `false` |
| `DBT_MODE` | `simulation` | `simulation` | `live` (with PFMS credentials) |
| `JWT_SECRET` | Auto-default / Local | Secure staging key | 64-char cryptographically random secret |
| `ALLOWED_ORIGINS` | `*` (Permissive) | Staging domain + localhost | Exact production domains only |
| `DATABASE_URL` | Local / In-memory fallback | Managed PostgreSQL | Hardened PostgreSQL HA cluster with SSL |
| `REDIS_URL` | Optional (soft-fail) | Managed Redis | Clustered Redis with TLS |
| `DILRMP API` | Official Cadastral API | Official Cadastral API | Official Cadastral API |

---

## 4. Docker Container Deployment Guide

### 4.1 Prerequisites
- Docker Engine 24.0+ and Docker Compose v2+
- Valid `.env` configuration file created from `.env.example`

### 4.2 Single-Command Full-Stack Deployment
```bash
# 1. Clone repository and navigate to root
git clone https://github.com/organization/kisanflow.git
cd kisanflow

# 2. Configure production environment
cp .env.example .env
# Edit .env and supply your DATABASE_URL, JWT_SECRET, and allowed origins

# 3. Build and launch all 5 microservices
docker compose up -d --build

# 4. Check cluster status
docker compose ps
```

### 4.3 Service Port Mapping in Docker Compose
- **Web Frontend (Nginx)**: `http://localhost:80`
- **Backend API (Express)**: `http://localhost:3000`
- **ML Quality Service (FastAPI)**: `http://localhost:8000`
- **PostgreSQL Database**: `localhost:5432`
- **Redis Cache**: `localhost:6379`

---

## 5. Database Setup, Migrations & Seeding

KisanFlow uses Prisma ORM for relational persistence with a resilient dual-mode: if PostgreSQL is momentarily offline, an in-memory synchronized store prevents application crashes.

### 5.1 Running Migrations
**DATABASE**: Supabase PostgreSQL  
**STATUS**: CONNECTED / MIGRATED / VERIFIED  

```bash
# Apply pending database schema migrations
npx prisma migrate deploy

# (Optional) Verify migration status
npx prisma migrate status
```

### 5.2 Seeding Mandi & Administrative Master Data
```bash
# Populate MSP tables, Mandi hubs, quality grade thresholds, and sample accounts
npm run db:seed
```

---

## 6. Machine Learning Service (Self-Hosted Vision & Grading)

The ML service (`apps/ml-service`) provides optical defect inspection, foreign matter grading, and Agmarknet FAQ classification without requiring third-party vision API keys.

### 6.1 Native Execution
```bash
cd apps/ml-service
pip install -r requirements.txt || pip install fastapi uvicorn pydantic
python app/main.py
```
*Health Check*: `curl http://localhost:8000/health`  
*Response*: `{"success": true, "service": "KisanFlow ML Service", "status": "running"}`

---

## 7. Frontend Deployment (Vite SPA)

### 7.1 Production Static Build
```bash
# Generates optimized HTML, JS, CSS in dist/
npm run build
```

### 7.2 Nginx Production Server Configuration
When deploying the frontend to Nginx, ensure SPA route fallback is enabled:
```nginx
location / {
    root /usr/share/nginx/html;
    index index.html;
    try_files $uri $uri/ /index.html;
}
```
All assets in `/assets/` should be cached with `Cache-Control: public, max-age=31536000, immutable`.

---

## 8. Security Hardening & Zero-Trust Checklist

1. **No Backend Secrets in Frontend**: `VITE_` variables are strictly limited to `VITE_API_URL`. Never expose `DATABASE_URL`, `JWT_SECRET`, or payment private keys to React.
2. **CORS Restrictions**: In production, `ALLOWED_ORIGINS` must be explicitly configured to the verified domain (e.g. `https://kisanflow.gov.in`).
3. **Structured Log Sanitization**: Sensitive keys (`password`, `token`, `secret`, `jwt`, `apiKey`, `razorpay_key_secret`) are automatically redacted with `[REDACTED]`.
4. **SSL / TLS Termination**: Terminate TLS at the load balancer or Nginx edge with TLS 1.3 preferred and HTTP Strict Transport Security (HSTS) enabled:
   ```nginx
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
   ```

---

## 9. Backup, Disaster Recovery & Rollback

### 9.1 Database Backup
```bash
# Automated nightly logical dump
pg_dump -U kisanflow_user -d kisanflow_db -F c -b -v -f "/backups/kisanflow_$(date +%Y%m%d_%H%M%S).dump"
```

### 9.2 Zero-Downtime Rollback Procedure
If a regression or critical failure occurs post-deployment:
1. Re-tag previous stable container image: `docker compose pull api:stable`
2. Restart backend service gracefully: `docker compose up -d --no-deps api`
3. Reverse schema migration if necessary: `npx prisma migrate resolve --rolled-back <MIGRATION_NAME>`
4. Verify `/health` and `/ready` endpoints return HTTP 200.

---

## 10. Healthchecks & Diagnostic Probes

- **Liveness Probe**: `GET http://<host>:3000/health` (HTTP 200 if server process is running)
- **Readiness Probe**: `GET http://<host>:3000/ready` (Verifies DB, Redis, and ML readiness)
- **ML Probe**: `GET http://<host>:8000/health` (Verifies FastAPI vision inference engine)
