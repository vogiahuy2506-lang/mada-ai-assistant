# MADA AI Assistant - Production Dockerfile
# Multi-stage build với Esbuild cho server bundle

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (bao gồm dev để chạy vite/esbuild)
RUN npm ci

# Copy source code
COPY . .

# Build frontend + server (esbuild → dist/server.cjs + vite → dist/assets)
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies cho native modules (better-sqlite3, sharp)
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only (skip dev)
RUN npm ci --only=production && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/server ./server

# Create data directory for ingestion logs
RUN mkdir -p ./data/chroma ./data/ingestion_log.json && \
    chown -R nodejs:nodejs ./data

# Set ownership
USER nodejs

# Expose port 3000 (theo WBS Task 11)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start command - chạy bundled server.mjs (ESM)
CMD ["node", "dist/server.mjs"]