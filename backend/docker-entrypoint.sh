#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Running database seed..."
NODE_ENV=${NODE_ENV:-production} node -e "
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const role = { SUPER_ADMIN: 'SUPER_ADMIN' };
const genre = { H: 'H' };
const categorie = { SENIOR: 'SENIOR' };

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
      genre: genre.H,
      role: role.SUPER_ADMIN,
      categorie: categorie.SENIOR,
      club: 'FFPJP',
    },
  });
  console.log('  ✓ Super-admin: ' + admin.email);
}

seed()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.\$disconnect(); await pool.end(); });
"

echo "Starting application..."
exec node dist/main
