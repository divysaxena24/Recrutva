# =============================================================================
# Recrutva — Production Dockerfile (multi-stage)
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: deps — install production dependencies
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only package files first (maximizes layer caching)
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Stage 2: builder — build the Next.js application
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install ALL dependencies (including dev for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and configuration
COPY next.config.ts tsconfig.json postcss.config.mjs components.json ./
COPY app/ ./app/
COPY components/ ./components/
COPY db/ ./db/
COPY lib/ ./lib/
COPY types/ ./types/
COPY public/ ./public/
COPY drizzle/ ./drizzle/
COPY middleware.ts ./

# Copy env example for type hints (not secrets)
COPY .env.example .env.example 2>/dev/null || true

# Build the Next.js application
# Turbopack is default in Next.js 15+, use --turbopack for faster builds
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: runner — production runtime
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Set ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Set the host to allow binding to all interfaces
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Health check — verify Next.js server is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the application with dumb-init for proper signal handling
CMD ["dumb-init", "node", "server.js"]
