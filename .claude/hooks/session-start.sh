#!/bin/bash
set -euo pipefail

# Only run in remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo '{"async": true, "asyncTimeout": 300000}'

cd "$CLAUDE_PROJECT_DIR"

# Install npm dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start PostgreSQL if not running
if ! pg_isready -q 2>/dev/null; then
  service postgresql start || true
  sleep 2
fi

# Create database and user if not present
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='pipepay'" 2>/dev/null | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER pipepay WITH PASSWORD 'pipepay123' CREATEDB;" 2>/dev/null || true

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='pipepay'" 2>/dev/null | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE pipepay OWNER pipepay;" 2>/dev/null || true

sudo -u postgres psql -d pipepay -c "GRANT ALL ON SCHEMA public TO pipepay;" 2>/dev/null || true

# Run migrations
npx prisma migrate deploy 2>/dev/null || npx prisma db push --skip-generate 2>/dev/null || true

# Seed if no users exist yet
USER_COUNT=$(sudo -u postgres psql -d pipepay -tAc "SELECT COUNT(*) FROM \"User\";" 2>/dev/null || echo "0")
if [ "$USER_COUNT" = "0" ]; then
  npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts || true
fi
