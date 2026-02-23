/**
 * Test Script: Add 13 Teams to "Manual test" COUPE Tournament
 * 
 * Purpose: Test bye handling with odd number of teams
 * - 13 teams → fills to 16 slots (3 byes needed)
 * - Tests automatic bye progression in upper rounds
 * 
 * Structure:
 * - Round 2 (1/16): 8 matches (some with byes) → Round 3 (1/8): 4 matches
 * - Round 4 (1/4): 2 matches → Round 5 (1/2): 1 match → Round 6: Finals
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Setting up 13-Team COUPE Tournament for Manual Testing ===\n');

  // 1. Find or create organizer
  const hashedPassword = await bcrypt.hash('orga1234', 10);
  const organizer = await prisma.utilisateur.upsert({
    where: { email: 'orga@petanque.fr' },
    update: {},
    create: {
      email: 'orga@petanque.fr',
      nom: 'Test',
      prenom: 'Organizer',
      motDePasse: hashedPassword,
      role: 'ORGANISATEUR',
    },
  });
  console.log('✅ Organizer ready:', organizer.email);

  // 2. Find existing "Manual test" tournament or create new one
  let concours = await prisma.concours.findFirst({
    where: { nom: { contains: 'Manual test' } },
  });

  if (concours) {
    console.log('✅ Found existing tournament:', concours.nom, `(ID: ${concours.id})`);
    
    // Delete existing teams if any
    const existingTeams = await prisma.equipe.findMany({
      where: { concoursId: concours.id },
    });
    
    if (existingTeams.length > 0) {
      console.log(`⚠️  Deleting ${existingTeams.length} existing teams...`);
      
      // Delete equipe_joueurs first (foreign key constraint)
      await prisma.equipeJoueur.deleteMany({
        where: { equipeId: { in: existingTeams.map(t => t.id) } },
      });
      
      // Delete teams
      await prisma.equipe.deleteMany({
        where: { concoursId: concours.id },
      });
      
      console.log('✅ Existing teams deleted');
    }
    
    // Reset tournament status if needed
    if (concours.statut !== 'INSCRIPTION') {
      await prisma.concours.update({
        where: { id: concours.id },
        data: { statut: 'INSCRIPTION' },
      });
      console.log('✅ Tournament status reset to INSCRIPTION');
    }
  } else {
    // Create new tournament
    concours = await prisma.concours.create({
      data: {
        nom: 'Manual test - 13 Teams (Byes)',
        format: 'COUPE',
        typeEquipe: 'DOUBLETTE',
        modeConstitution: 'MONTEE',
        statut: 'INSCRIPTION',
        dateDebut: new Date('2026-03-15'),
        dateFin: new Date('2026-03-15'),
        lieu: 'Manual Test Arena',
        maxParticipants: 26,
        organisateurId: organizer.id,
        params: { consolante: true },
      },
    });
    console.log('✅ New tournament created:', concours.nom, `(ID: ${concours.id})`);

    // Create terrains
    await Promise.all([
      prisma.terrain.create({
        data: { concoursId: concours.id, numero: 1, nom: 'Terrain 1' },
      }),
      prisma.terrain.create({
        data: { concoursId: concours.id, numero: 2, nom: 'Terrain 2' },
      }),
      prisma.terrain.create({
        data: { concoursId: concours.id, numero: 3, nom: 'Terrain 3' },
      }),
      prisma.terrain.create({
        data: { concoursId: concours.id, numero: 4, nom: 'Terrain 4' },
      }),
    ]);
    console.log('✅ Terrains created: 4');
  }

  // 3. Create 26 players (for 13 teams of 2)
  console.log('\n⏳ Creating 26 players...');
  const players = [];
  for (let i = 1; i <= 26; i++) {
    const player = await prisma.joueur.upsert({
      where: { email: `player${i}-13t@test.fr` },
      update: {},
      create: {
        nom: `Player${i}`,
        prenom: `Test`,
        email: `player${i}-13t@test.fr`,
        genre: i % 2 === 0 ? 'HOMME' : 'FEMME',
        dateNaissance: new Date('1990-01-01'),
        licence: `LIC13T${String(i).padStart(3, '0')}`,
      },
    });
    players.push(player);
  }
  console.log('✅ Players ready: 26');

  // 4. Create 13 teams (2 players each)
  console.log('\n⏳ Creating 13 teams...');
  const teams = [];
  for (let i = 0; i < 13; i++) {
    const teamName = `Team ${String.fromCharCode(65 + i)}`; // A through M
    
    const team = await prisma.equipe.create({
      data: {
        nom: teamName,
        concoursId: concours.id,
        statut: 'INSCRITE',
        joueurs: {
          create: [
            { joueurId: players[i * 2].id },
            { joueurId: players[i * 2 + 1].id },
          ],
        },
      },
    });
    teams.push(team);
  }
  console.log('✅ Teams created: 13 (Team A through M)');

  // 5. Start tournament
  await prisma.concours.update({
    where: { id: concours.id },
    data: { statut: 'EN_COURS' },
  });
  console.log('✅ Tournament started (status: EN_COURS)');

  console.log('\n=== Setup Complete ===');
  console.log(`\n📋 Tournament Details:`);
  console.log(`   Name: ${concours.nom}`);
  console.log(`   ID: ${concours.id}`);
  console.log(`   Teams: 13`);
  console.log(`   Format: COUPE with Consolante enabled`);
  console.log(`\n🌐 Access:`);
  console.log(`   URL: http://localhost:5174/concours/${concours.id}`);
  console.log(`   Login: orga@petanque.fr / orga1234`);
  console.log(`\n✨ Next Steps:`);
  console.log(`   1. Go to "Parties" tab`);
  console.log(`   2. Click "Lancer le Tour 1"`);
  console.log(`   3. Observe bracket creation with byes`);
  console.log(`\n📊 Expected Bracket Structure (13 teams → 16 slots):`);
  console.log(`   - 3 byes will be created automatically`);
  console.log(`   - Bracket fills to next power of 2 (16)`);
  console.log(`   - Round 2: 8 matches (some complete immediately as byes)`);
  console.log(`   - Byes auto-progress winners to next round`);
  console.log(`   - Test completing matches in any order`);
  console.log(`\n🧪 Test Scenarios:`);
  console.log(`   1. Verify byes are created and marked TERMINEE (13-0)`);
  console.log(`   2. Verify bye winners auto-progress to Round 3`);
  console.log(`   3. Complete some regular matches, verify progression`);
  console.log(`   4. Check Consolante receives Round 1 losers only`);
  console.log(`   5. Progress to finals and verify Grande + Petite Finale\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
