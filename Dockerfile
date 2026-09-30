# RAMSport — single-server Next.js (frontend + API in one process)
# Release: RAMSport_R01
# Build:  docker build -t ramsport .
# Run:    docker run --name ramsport -p 3000:3000 ramsport

# ── Stage 1: install dependencies ──
FROM node:20-slim AS deps
WORKDIR /app/RAMspace_Base_UI
COPY RAMspace_Base_UI/package.json RAMspace_Base_UI/package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: build ──
FROM node:20-slim AS builder
WORKDIR /app/RAMspace_Base_UI
COPY --from=deps /app/RAMspace_Base_UI/node_modules ./node_modules
COPY RAMspace_Base_UI/ ./
RUN npm run build

# ── Stage 3: minimal runtime ──
FROM node:20-slim AS runner
LABEL project="RAMSport"
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone bundle + static assets + public
COPY --from=builder /app/RAMspace_Base_UI/.next/standalone ./
COPY --from=builder /app/RAMspace_Base_UI/.next/static ./.next/static
COPY --from=builder /app/RAMspace_Base_UI/public ./public

RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000').then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
