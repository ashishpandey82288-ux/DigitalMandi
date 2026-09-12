# ==============================================================================
# KisanFlow — Production Backend & Fullstack Container
# Multi-Stage Node.js 20 Alpine Build
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build configs
COPY tsconfig.json vite.config.ts index.html metadata.json ./
COPY src ./src
COPY apps ./apps
COPY packages ./packages
COPY server.ts ./

# Build production assets (Vite SPA frontend + esbuild CommonJS backend bundle)
ENV NODE_ENV=production
RUN npm run build

# ------------------------------------------------------------------------------
# Production Runtime Stage
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-privileged service user
RUN addgroup -g 1001 -S kisanflow && \
    adduser -S kisanflow -u 1001

# Copy built distribution artifacts & production node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# Create upload cache directory with proper permissions
RUN mkdir -p /app/uploads && chown -R kisanflow:kisanflow /app

USER kisanflow

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server.cjs"]
