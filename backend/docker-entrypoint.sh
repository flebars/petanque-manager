#!/bin/sh
set -e

echo "=== DEBUG ==="
echo "Working directory: $(pwd)"
echo "--- prisma.config.js ---"
cat /app/prisma.config.js
echo "--- prisma/schema.prisma (first 10 lines) ---"
head -10 /app/prisma/schema.prisma
echo "--- prisma/migrations ---"
ls /app/prisma/migrations/
echo "=== END DEBUG ==="

echo "Running database migrations..."
npx prisma migrate deploy --schema /app/prisma/schema.prisma

echo "Running database seed..."
node -e "
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.joueur.upsert({
    where: { email: 'admin@petanque.fr' },
    update: {},
    create: {
      email: 'admin@petanque.fr',
      passwordHash: adminHash,
      nom: 'Martin',
      prenom: 'Julien',
      genre: 'H',
      role: 'SUPER_ADMIN',
      categorie: 'SENIOR',
      club: 'FFPJP',
    },
  });
  console.log('  + Super-admin: ' + admin.email);
}

seed()
  .catch(e => { console.error('Seed warning:', e.message); })
  .finally(async () => { await prisma.\$disconnect(); await pool.end(); });
" || true

echo "Starting application..."
exec node dist/main
