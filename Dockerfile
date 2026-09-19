# Stage 1: Build frontend + server bundle
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev git

WORKDIR /app

COPY package*.json ./

# Skip native module compilation (better-sqlite3) - will be copied from builder
RUN npm ci --ignore-scripts

COPY . .

RUN npm run build

# Copy node_modules with pre-built binaries to a separate stage
FROM node:22-alpine AS modules
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules

# Stage 2: Production
FROM node:22-alpine AS production

RUN apk add --no-cache python3 make g++ cairo pango jpeg giflib librsvg tini wget curl sqlite3 && \
    apk add --no-cache poppler-utils  # PDF to image conversion for OCR fallback

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

COPY package*.json ./
COPY entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

# Install production deps WITHOUT scripts, then copy pre-built native modules from builder
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy pre-built dist from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
RUN mkdir -p ./data && chown -R nodejs:nodejs ./data

USER nodejs

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/server.mjs"]
