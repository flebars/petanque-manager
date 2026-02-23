/**
 * Reset tournament matches - Delete all matches and reset status
 * Run with: npx ts-node -r tsconfig-paths/register reset-tournament-matches.ts <tournament-id>
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const tournamentId = process.argv[2];
  
  if (!tournamentId) {
    console.error('❌ Usage: npx ts-node -r tsconfig-paths/register reset-tournament-matches.ts <tournament-id>');
    process.exit(1);
  }

  console.log(`\n🔄 Resetting tournament ${tournamentId}...\n`);

  // 1. Find tournament
  const concours = await prisma.concours.findUnique({
    where: { id: tournamentId },
  });

  if (!concours) {
    console.error(`❌ Tournament ${tournamentId} not found`);
    process.exit(1);
  }

  console.log(`✅ Found tournament: ${concours.nom}`);

  // 2. Delete all matches
  const matches = await prisma.partie.findMany({
    where: { concoursId: tournamentId },
  });

  if (matches.length > 0) {
    console.log(`⚠️  Deleting ${matches.length} existing matches...`);
    await prisma.partie.deleteMany({
      where: { concoursId: tournamentId },
    });
    console.log(`✅ Deleted ${matches.length} matches`);
  } else {
    console.log('ℹ️  No matches to delete');
  }

  // 3. Delete TBD team if exists
  const tbdTeam = await prisma.equipe.findFirst({
    where: { concoursId: tournamentId, nom: '__TBD__' },
  });

  if (tbdTeam) {
    console.log(`⚠️  Deleting TBD placeholder team...`);
    await prisma.equipe.delete({
      where: { id: tbdTeam.id },
    });
    console.log(`✅ Deleted TBD team`);
  }

  // 4. Delete tirage logs
  const tirageLogs = await prisma.tirageLog.findMany({
    where: { concoursId: tournamentId },
  });

  if (tirageLogs.length > 0) {
    console.log(`⚠️  Deleting ${tirageLogs.length} tirage logs...`);
    await prisma.tirageLog.deleteMany({
      where: { concoursId: tournamentId },
    });
    console.log(`✅ Deleted tirage logs`);
  }

  // 5. Delete classements
  const classements = await prisma.classement.findMany({
    where: { concoursId: tournamentId },
  });

  if (classements.length > 0) {
    console.log(`⚠️  Deleting ${classements.length} classement entries...`);
    await prisma.classement.deleteMany({
      where: { concoursId: tournamentId },
    });
    console.log(`✅ Deleted classements`);
  }

  // 6. Delete player classements
  const playerClassements = await prisma.classementJoueur.findMany({
    where: { concoursId: tournamentId },
  });

  if (playerClassements.length > 0) {
    console.log(`⚠️  Deleting ${playerClassements.length} player classement entries...`);
    await prisma.classementJoueur.deleteMany({
      where: { concoursId: tournamentId },
    });
    console.log(`✅ Deleted player classements`);
  }

  // 7. Reset tournament status to EN_COURS (ready to launch)
  await prisma.concours.update({
    where: { id: tournamentId },
    data: { statut: 'EN_COURS' },
  });
  console.log(`✅ Tournament status reset to EN_COURS`);

  console.log('\n✨ Tournament reset complete!');
  console.log(`\n🌐 Access: http://localhost:5174/concours/${tournamentId}`);
  console.log(`📋 Next step: Go to "Parties" tab and click "Lancer le Tour 1"\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
