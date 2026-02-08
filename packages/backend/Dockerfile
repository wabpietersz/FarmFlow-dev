# === Stage 1: Build ===
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

# Install all dependencies (including dev deps for building)
RUN npm ci --workspace=packages/shared --workspace=packages/backend

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/

# Build shared first, then backend
RUN npm run build -w packages/shared
RUN npm run build -w packages/backend

# === Stage 2: Production ===
FROM node:20-alpine AS production

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

# Install production dependencies only
RUN npm ci --workspace=packages/shared --workspace=packages/backend --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/backend/dist packages/backend/dist

# Copy drizzle migrations if they exist
COPY packages/backend/drizzle* packages/backend/

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the server
CMD ["node", "packages/backend/dist/server.js"]
