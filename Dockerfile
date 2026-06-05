# ─── Build stage ───────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# Install dependencies first (layer caching).
# The postinstall script (scripts/ensure-platform-binaries.mjs) runs during
# `npm ci`, so we must copy it BEFORE installing — otherwise the postinstall
# fails on a fresh build with "Cannot find module scripts/ensure-platform-binaries.mjs".
COPY package.json package-lock.json ./
COPY scripts/ ./scripts/
RUN npm ci --include=dev

# Copy source and build
COPY . .
RUN node node_modules/next/dist/bin/next build

# ─── Runtime stage ─────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

# ca-certificates needed for TLS (npm registry, any HTTPS calls at runtime)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# Optionally override via env var at runtime
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Pre-create the data dir and chown to appuser while we're still root.
# (Cannot be done after USER appuser because /app itself is owned by root.)
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

# Copy standalone server + static assets from build
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static
COPY --from=builder --chown=appuser:appgroup /app/public ./public

USER appuser

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
