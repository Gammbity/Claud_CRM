#!/bin/sh
set -e

echo "Pushing database schema..."
npx prisma db push --accept-data-loss

echo "Checking if seed is needed..."
USER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count()
  .then(n => { process.stdout.write(String(n)); return p.\$disconnect(); })
  .catch(() => { process.stdout.write('0'); return p.\$disconnect(); });
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ]; then
  echo "Database is empty — running seed..."
  node dist/seed/prisma/seed.js
  echo "Seed completed."
else
  echo "Database already has data (${USER_COUNT} users) — skipping seed."
fi

echo "Starting CRM server..."
exec node dist/index.js
