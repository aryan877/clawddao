FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies (tsx needed for worker, typescript for next.config.ts)
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps && npm install typescript --legacy-peer-deps

# Copy built Next.js app
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/next.config.ts ./apps/web/next.config.ts
COPY --from=builder /app/apps/web/tsconfig.json ./apps/web/tsconfig.json
COPY --from=builder /app/apps/web/postcss.config.mjs ./apps/web/postcss.config.mjs

# Copy worker source (runs via tsx, no build step)
COPY --from=builder /app/apps/worker ./apps/worker

# Copy shared packages
COPY --from=builder /app/packages ./packages

# Copy root configs
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

# Expose ports (3000 = Next.js app, 4000 = worker HTTP)
EXPOSE 3000
EXPOSE 4000

# Health check (for app service — worker overrides in docker-compose)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Default: start Next.js app
CMD ["npm", "start"]
