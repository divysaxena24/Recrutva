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

# ---------------------------------------------------------------------------
# Public build-time configuration.
#
# NEXT_PUBLIC_* values are inlined by Next.js during `next build` into the
# compiled bundles (client AND server). Values injected only at container
# runtime (e.g. compose `environment:`) never reach already-compiled code,
# which leaves the Clerk publishable key empty and breaks authentication.
# These ARGs are fed from docker-compose build.args (sourced from .env).
# Non-secret, browser-visible values only — secrets stay runtime-only.
# ---------------------------------------------------------------------------
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

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

# Health check — verify Next.js server is responding.
# Use 127.0.0.1 (not localhost) because the server binds IPv4 only and
# busybox wget may resolve localhost to ::1 first.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Start the application with dumb-init for proper signal handling
CMD ["dumb-init", "node", "server.js"]
