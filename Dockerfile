# Stage 1: Build frontend + server bundle
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

RUN apk add --no-cache python3 make g++ cairo pango jpeg giflib librsvg tini wget curl

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

COPY package*.json ./
COPY entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

# Use prebuilt binaries (Alpine glibc/musl matches host); rebuild from source if needed
RUN npm ci --only=production && npm rebuild && npm cache clean --force

# Copy pre-built dist (built locally or mounted)
COPY dist ./dist
COPY server ./server
RUN mkdir -p ./data && chown -R nodejs:nodejs ./data

USER nodejs

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/server.mjs"]
