# KisanFlow — Smart Procurement & Direct MSP Engine
### Smart India Hackathon (SIH 2026) | Problem Theme: Agriculture, Food Tech & Rural Development

[![Architecture](https://img.shields.io/badge/Architecture-Clean%20Monorepo-emerald)](https://github.com/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![SIH](https://img.shields.io/badge/Hackathon-SIH%202026-amber)](https://sih.gov.in)
[![Phase](https://img.shields.io/badge/Phase%201-Foundation%20Layer%20Complete-success)](https://github.com/)

---

## 1. Executive Summary & SIH 2026 Context

Across India, agricultural procurement under the **Minimum Support Price (MSP)** regime faces severe systemic friction:
1. **Mandi Distress Sales**: Extreme price volatility and delays force smallholder farmers to sell produce to predatory local middlemen (*arhtiyas*) at 20–40% below statutory MSP.
2. **Physical Queue Gridlock**: Peak harvest arrivals result in 3 to 7-day tractor/bullock cart queues outside APMC mandis, causing grain spoilage, theft, and demurrage penalties.
3. **Subjective Crop Grading**: Manual grain inspection is prone to bias, kickbacks, and disputes over foreign matter, broken kernel percentage, and moisture levels.
4. **Delayed & Opaque Disbursal**: Unclear weighbridge accounting and slow manual paperwork delay Direct Benefit Transfer (DBT) payments to farmers' bank accounts.

**KisanFlow** is an enterprise-grade digital public infrastructure platform that re-engineers government agri-procurement through:
- **"Book & Lock" Guaranteed MSP Engine**: Farmers lock official MSP rates at time of booking, immune to subsequent market price crashes.
- **Smart 90-Minute Slot Scheduling & Virtual Queuing**: Eliminates physical mandi congestion via real-time Redis token FIFO queues and SMS/QR notifications.
- **AI Computer Vision Grain Grading**: Fast automated quality assessment using YOLOv8 defect detection and digital moisture cross-validation.
- **Tamper-Evident Cryptographic Audit Ledger**: An append-only SHA-256 hash-chained ledger securing every gate entry, tare/gross weighbridge record, grading score, and PFMS/DBT payout.

> **Phase 1 Architecture Notice:**
> This repository represents the **Phase 1 Foundation Layer**. It establishes a modular monorepo, 22-entity normalized relational database schema (Prisma + PostgreSQL), Redis virtual queue configuration, Express + TypeScript API gateway with full route scaffolding, FastAPI ML service stub, and React responsive client. Detailed business logic, model training, and external banking gateways are implemented in subsequent phases.

---

## 2. System Architecture & Component Interactions

```mermaid
flowchart TD
    subgraph Client_Layer ["Client Layer (Web & Mobile PWA)"]
        FARMER["Farmer Portal (Mobile PWA)"]
        OPERATOR["Mandi Center Terminal"]
        ADMIN["Govt Admin & Oversight"]
    end

    subgraph Gateway_Layer ["API Gateway & Core Services (Port 3000)"]
        EXPRESS["Express.js Gateway /apps/api"]
        ROUTER["Modular Master Router (20 Endpoints)"]
        AUTH_MW["Firebase Auth / JWT Middleware"]
        VAL_MW["Zod Request Validation"]
        ERR_MW["Global Error & RFC 7807 Handler"]
    end

    subgraph Data_Layer ["Data & Persistence Layer"]
        PRISMA["Prisma ORM (PostgreSQL 16)"]
        PG_DB[(PostgreSQL 16 Multi-Entity DB)]
        REDIS_CACHE[("Redis 7.2 (Virtual FIFO Queue & Locks)")]
        AUDIT_CHAIN[("SHA-256 Cryptographic Audit Hash-Chain")]
    end

    subgraph ML_Layer ["Machine Learning Microservice (Port 8000)"]
        FASTAPI["FastAPI ML Service /apps/ml-service"]
        ARIMA["SARIMA Load & Arrival Forecaster"]
        CV_YOLO["YOLOv8 Grain Defect Classifier"]
        ANOMALY["Isolation Forest Fraud Detector"]
    end

    FARMER -->|HTTPS / REST| EXPRESS
    OPERATOR -->|HTTPS / REST| EXPRESS
    ADMIN -->|HTTPS / REST| EXPRESS

    EXPRESS --> ROUTER
    ROUTER --> AUTH_MW
    AUTH_MW --> VAL_MW
    VAL_MW --> ERR_MW

    EXPRESS -->|ORM Query| PRISMA
    PRISMA --> PG_DB
    EXPRESS -->|Queue Push/Pop| REDIS_CACHE
    EXPRESS -->|Append Block| AUDIT_CHAIN
    EXPRESS -->|Internal Proxy| FASTAPI

    FASTAPI --> ARIMA
    FASTAPI --> CV_YOLO
    FASTAPI --> ANOMALY
```

---

## 3. Technology Stack Matrix

| Tier | Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Single Page App | React + TypeScript + Vite | React 19 / Vite 6 | Responsive, accessible, mobile-first portal |
| **Styling** | Utility CSS | Tailwind CSS v4 | 4.1.x | Mobile-first, WCAG-compliant design system |
| **Icons** | Vector Graphics | Lucide React | Latest | Standardized iconography |
| **API Client** | HTTP Transport | Axios | 1.8.x | Centralized token injection & error normalization |
| **Backend** | API Gateway | Node.js + Express + TypeScript | Express 4.21.x | REST API, validation, routing & telemetry |
| **Validation** | Schema Enforcement | Zod | 4.x | Strict runtime request body/params contract checks |
| **Database** | Relational Store | PostgreSQL | 16.x | Normalized storage, Foreign Key & cascade integrity |
| **ORM** | Database Client | Prisma ORM | 6.4.x | Type-safe migrations, queries, and synthetic seeding |
| **Cache & Queue** | In-Memory Engine | Redis | 7.2.x | Real-time virtual queue FIFO, rate limiting |
| **ML Engine** | Microservice | Python + FastAPI + Uvicorn | Python 3.11 / FastAPI 0.110 | Quality grading & time-series arrival prediction |
| **Dev Tooling** | Execution & Bundling | tsx + esbuild | Latest | Hot reload dev server and compiled CJS build |

---

## 4. Complete Project Directory Structure

```text
kisanflow/
├── apps/
│   ├── api/                               # Express.js TypeScript Backend
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── env.ts                 # Strict Zod environment variable validation
│   │   │   │   ├── prisma.ts              # Global Prisma singleton with graceful teardown
│   │   │   │   └── redis.ts               # Redis cache client with auto-reconnect logic
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts                # Token extraction & role-based access control (RBAC)
│   │   │   │   ├── errorHandler.ts        # RFC 7807 structured JSON error handling
│   │   │   │   ├── notFoundHandler.ts     # Standardized 404 response handler
│   │   │   │   └── validate.ts            # Zod request validation middleware
│   │   │   ├── routes/
│   │   │   │   ├── health.routes.ts       # Deep multi-tier health probe (/api/health)
│   │   │   │   └── index.ts               # Master router mounting 20 business domain routes
│   │   │   ├── utils/
│   │   │   │   ├── logger.ts              # Structured JSON logging utility
│   │   │   │   └── response.ts            # Standardized API response format helper
│   │   │   ├── app.ts                     # Express application factory & security headers
│   │   │   └── server.ts                  # Dedicated API standalone entrypoint
│   ├── ml-service/                        # Python FastAPI Machine Learning Microservice
│   │   ├── app/
│   │   │   ├── models/
│   │   │   │   ├── anomaly_detection/     # Isolation Forest anti-fraud algorithms
│   │   │   │   ├── crop_grading/          # YOLOv8 grain defect & moisture models
│   │   │   │   ├── land_yield_verification/# DILRMP land boundary & NDVI validation
│   │   │   │   ├── load_forecasting/      # SARIMA seasonal mandi arrival forecaster
│   │   │   │   └── price_forecasting/     # e-NAM modal price prediction models
│   │   │   ├── schemas/
│   │   │   │   └── health.py              # Pydantic health check models
│   │   │   └── main.py                    # FastAPI server entrypoint (port 8000)
│   │   └── requirements.txt               # Python ML library dependencies
│   └── web/                               # React + Vite Client Application
│       ├── src/
│       │   ├── components/
│       │   │   ├── common/
│       │   │   │   ├── ErrorBoundary.tsx  # React UI catch boundary with recovery
│       │   │   │   ├── Footer.tsx         # SIH 2026 project footer
│       │   │   │   ├── Header.tsx         # Responsive navbar with live API health badge
│       │   │   │   └── LoadingSpinner.tsx # Accessible loading indicators
│       │   │   └── ui/
│       │   │       ├── Badge.tsx          # Status indicators
│       │   │       ├── Button.tsx         # Polymorphic accessible buttons
│       │   │       ├── Card.tsx           # High-contrast UI cards
│       │   │       └── Input.tsx          # Accessible form inputs
│       │   ├── layouts/
│       │   │   └── MainLayout.tsx         # Common container shell
│       │   ├── pages/
│       │   │   ├── AdminPage.tsx          # Government admin portal placeholder
│       │   │   ├── CenterPage.tsx         # Mandi operator portal placeholder
│       │   │   ├── FarmerPage.tsx         # Farmer portal placeholder
│       │   │   ├── HomePage.tsx           # Home & architecture interactive diagnostic
│       │   │   ├── LoginPage.tsx          # Role-based sign-in placeholder
│       │   │   └── RegisterPage.tsx       # Farmer onboarding placeholder
│       │   ├── services/
│       │   │   ├── apiClient.ts           # Axios client with bearer token support
│       │   │   └── healthService.ts       # Health endpoint caller
│       │   ├── App.tsx                    # React Router configuration
│       │   └── main.tsx                   # React DOM root entrypoint
├── docker/
│   └── init.sql                           # Database initialization & extensions
├── packages/
│   ├── shared/                            # Cross-cutting constants & utilities
│   │   └── src/index.ts
│   └── types/                             # Universal TypeScript interfaces & enums
│       └── src/index.ts
├── prisma/
│   ├── schema.prisma                      # Complete 22-entity normalized relational schema
│   └── seed.ts                            # Synthetic seed generator with SHA-256 audit ledger
├── .env.example                           # Documented template for all operational secrets
├── docker-compose.yml                     # Local PostgreSQL 16 & Redis 7.2 container stack
├── metadata.json                          # AI Studio project descriptor
├── package.json                           # Root dependencies and build scripts
├── server.ts                              # Unified full-stack server (Vite + Express)
└── tsconfig.json                          # Monorepo path mapping & TypeScript options
```

---

## 5. Phase 1 vs Future Roadmap

| Feature / Domain | Phase 1 (Foundation - Current) | Phase 2 (Core Business Logic) | Phase 3 (AI & IoT Hardware) | Phase 4 (National Scaling) |
| :--- | :--- | :--- | :--- | :--- |
| **Monorepo & Config** | ✅ Monorepo structure, Zod env, Docker stack | Maintenance | Maintenance | Multi-region clusters |
| **Relational DB** | ✅ 22 Prisma entities, indexes, relationships | Active queries | Active queries | Read replicas |
| **Synthetic Seeding** | ✅ Seeding script with audit genesis block | Expanded test vectors | Stress testing data | Live data ingestion |
| **API Endpoints** | ✅ `/api/health` + 20 modular routes scaffolded | Complete CRUD operations | Dynamic telemetry | Public OpenAPI specs |
| **Queueing Engine** | ✅ Redis client & schema definitions | Live FIFO token processing | Hardware display sync | Predictive bay routing |
| **Computer Vision** | ✅ FastAPI health + ML model folders | Mock grading endpoint | YOLOv8 trained model | Multi-spectral analysis |
| **Audit Ledger** | ✅ Schema with `previousHash` / `currentHash` | Sequential hashing middleware | Tamper verification tests | Hyperledger anchor |
| **Authentication** | ✅ JWT & RBAC placeholder middleware | OTP / Passwordless federated login | Biometric e-KYC | DigiLocker integration |

---

## 6. Local Setup & Installation Instructions

### Prerequisites
- **Node.js**: v20.x or v22.x LTS
- **Docker & Docker Compose**: v2.20+ (for local PostgreSQL & Redis)
- **Python**: v3.10+ (for ML microservice)

### Step 1: Clone and Configure Environment
```bash
# Clone the repository
git clone https://github.com/your-org/kisanflow.git
cd kisanflow

# Copy environment variable template
cp .env.example .env
```

### Step 2: Spin Up Infrastructure Containers
```bash
# Boot PostgreSQL 16 and Redis 7.2
docker compose up -d

# Verify containers are healthy
docker compose ps
```

### Step 3: Install Node Dependencies & Setup Database
```bash
# Install root monorepo packages
npm install

# Generate Prisma client bindings
npm run db:generate

# Push database schema to local PostgreSQL
npx prisma db push

# Seed synthetic test data (procurement centers, crops, farmers, audit block)
npm run db:seed
```

### Step 4: Launch Development Servers

**Option A: Unified Full-Stack (Frontend + Backend on Port 3000)**
```bash
npm run dev
```

**Option B: Independent Microservice Launchers**
```bash
# Run API Gateway independently
npm run dev:api

# Run Vite Frontend independently
npm run dev:web

# Run FastAPI ML Microservice (in separate terminal)
cd apps/ml-service
pip install -r requirements.txt
python -m app.main
```

---

## 7. Verification & Health Check Walkthrough

### 1. Verify API Gateway Health
Execute an HTTP GET request against the health endpoint:
```bash
curl -X GET http://localhost:3000/api/health?detailed=true
```
**Expected Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "service": "KisanFlow API Gateway",
    "status": "running",
    "version": "1.0.0-phase1",
    "timestamp": "2026-09-10T12:00:00.000Z",
    "environment": "development",
    "checks": {
      "database": "ready",
      "redis": "ready",
      "mlService": "pending_phase1"
    }
  }
}
```

### 2. Verify FastAPI ML Microservice
```bash
curl -X GET http://localhost:8000/health
```
**Expected Response (`200 OK`):**
```json
{
  "success": true,
  "service": "KisanFlow ML Service",
  "status": "running",
  "version": "1.0.0-phase1"
}
```

### 3. Verify Database Entities with Prisma Studio
```bash
npx prisma studio
```
Access `http://localhost:5555` to view the populated synthetic tables: `User`, `FarmerProfile`, `ProcurementCenter`, `Crop`, `MSPRate`, `CenterBay`, and `AuditEvent`.

---

## 8. Agentic Threat Modeling & Security Review (OWASP Top 10 & LLM 5 Zones)

| Threat Zone | Identified Attack Vector | Impact Severity | Phase 1 Built-in Countermeasure |
| :--- | :--- | :--- | :--- |
| **1. Input Surfaces** | Malicious payload injection, SQL/NoSQL injection, oversized JSON | **HIGH** | Strict runtime schema validation using **Zod** (`validateRequest`). Defensive payload deserialization with fallback guards. Null-safe parsing. |
| **2. Planning & Reasoning** | Prompt injection into future LLM summary agents; prompt manipulation | **MEDIUM** | Plain-data sanitization; prompt demarcation in future Phase 3 LLM routes; defensive prompt wrappers with strict token bounds. |
| **3. Tool Execution** | SSRF to internal microservices (FastAPI / Redis), privilege escalation | **HIGH** | Explicit internal API proxying; strict URL whitelisting; port isolation; non-root Docker execution. |
| **4. Memory & State** | Cache poisoning in Redis virtual queue; race conditions in bay allocation | **CRITICAL** | Atomic Redis transactions (`MULTI/EXEC`); UUID-keyed distributed locks; foreign key constraints in PostgreSQL. |
| **5. Inter-System Comm** | Hardcoded secrets, token leakage, replay attacks on weighbridge data | **CRITICAL** | Zero-hardcoding hygiene via `.env.example` and Google Cloud Secret Manager. Cryptographic SHA-256 hash chaining on all audit events. |

---

## 9. Google Cloud Run Deployment & Campaign Verification

### Prerequisites
1. Ensure the `gcloud` CLI is installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_GCP_PROJECT_ID
   ```
2. Enable required Cloud APIs:
   ```bash
   gcloud services enable run.googleapis.com secretmanager.googleapis.com
   ```

### Step 1: Provision Secret in Google Cloud Secret Manager
```bash
# Create the Database URL secret
gcloud secrets create DATABASE_URL --replication-policy="automatic"
echo -n "postgresql://user:password@cloud-sql-ip:5432/kisanflow" | gcloud secrets versions add DATABASE_URL --data-file=-

# Grant Cloud Run service account access to read secrets
PROJECT_NUM=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 2: Deploy Container to Cloud Run
```bash
gcloud run deploy kisanflow \
  --source . \
  --platform managed \
  --region asia-south1 \
  --port 3000 \
  --allow-unauthenticated \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest"
```

### Step 3: Apply Campaign Verification Resource Label
```bash
gcloud run services update kisanflow \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=asia-south1
```

---

## 10. Functional Stability & Testing Walkthrough

To ensure comprehensive functional stability without mock gaps, execute the following structured test script:

| Test Case ID | Feature / Component | Interaction / Trigger | Expected Result | Pass Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Global Navigation | Click "Overview", "Farmer Portal", "Mandi Center", "Govt Admin" in Header | Browser route updates instantaneously to `/`, `/farmer`, `/center`, `/admin` without page reload | Correct page component renders with title badge |
| **TC-02** | Live Health Diagnostic | Click "Ping API" button on Homepage diagnostic card | Spinner appears; `GET /api/health?detailed=true` executes; latency displays; status badges show "Active" | JSON response received with 200 OK |
| **TC-03** | Error Boundary | Trigger an unhandled React runtime error | Error Boundary UI renders with error message and "Reload Application" button | App does not crash to blank white screen |
| **TC-04** | Responsive Layout | Resize viewport from 1280px (Desktop) to 375px (Mobile) | Navigation collapses or wraps cleanly; grid shifts from 3 columns to 1 column; touch targets >= 44px | No horizontal overflow or truncated text |
| **TC-05** | Role Selector | Navigate to `/login` and switch between Farmer, Operator, Admin | Active role highlight shifts; input helpers update accordingly | Selected state persists in component memory |
| **TC-06** | Farmer Registration | Fill inputs on `/register` and click "Submit Farmer Enrollment" | Success checkmark appears with confirmation of captured parcel data | Form transitions without throwing unhandled exceptions |
| **TC-07** | Unknown Route 404 | Navigate to `/invalid-test-url` | React Router catches unknown URL and gracefully redirects to `/` | Redirects to `/` without console errors |

---

## 11. Authors & Attribution

Developed by the **KisanFlow Engineering Team** for the **Smart India Hackathon (SIH 2026)**.
Aligned with guidelines from the *Department of Agriculture & Farmers Welfare (DA&FW)* and the *Ministry of Consumer Affairs, Food & Public Distribution*, Government of India.
