# ---- Stage 1: Install all dependencies ----
FROM node:20-slim AS deps

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install

# ---- Stage 2: Build TypeScript ----
FROM deps AS builder

COPY tsconfig.json tsconfig.seed.json ./
COPY prisma ./prisma/
COPY src ./src

RUN npm run prisma:generate
RUN npm run build
RUN npx tsc --project tsconfig.seed.json

# ---- Stage 3: Production-only node_modules ----
FROM deps AS prod-deps
RUN npm prune --omit=dev

# ---- Production stage ----
FROM node:20-slim AS production

RUN apt-get update -y && apt-get install -y openssl wget && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nodeuser

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./
COPY entrypoint.sh ./
COPY --from=builder /app/dist/seed ./dist/seed

RUN chmod +x entrypoint.sh && chown -R nodeuser:nodejs /app

USER nodeuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["./entrypoint.sh"]
