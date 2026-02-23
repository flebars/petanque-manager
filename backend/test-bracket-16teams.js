/**
 * Test Script: 16-Team COUPE Tournament (with Byes and Consolante)
 * 
 * Tournament Structure:
 * - 16 teams → fills to 16 slots (no byes needed if exactly 16)
 * - Round 3 (1/8): 8 matches → Round 4 (1/4): 4 matches → Round 5 (1/2): 2 matches → Round 6: Finals
 * - Tests bye handling in upper rounds (if we use 15 or 13 teams)
 * - Grande Finale: winners of semi-finals
 * - Petite Finale: losers of semi-finals
 * - Consolante: Round 1 losers (8 teams) compete in their own bracket
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Creating 16-Team COUPE Tournament with Consolante ===\n');

  // 1. Create organizer user
  const hashedPassword = await bcrypt.hash('orga1234', 10);
  const organizer = await prisma.utilisateur.upsert({
    where: { email: 'orga-16teams@petanque.fr' },
    update: {},
    create: {
      email: 'orga-16teams@petanque.fr',
      nom: 'Test',
      prenom: 'Organizer 16',
      motDePasse: hashedPassword,
      role: 'ORGANISATEUR',
    },
  });
  console.log('✅ Organizer created:', organizer.email);

  // 2. Create tournament
  const concours = await prisma.concours.create({
    data: {
      nom: 'Test COUPE 16 Teams - Full Bracket Test',
      format: 'COUPE',
      typeEquipe: 'DOUBLETTE',
      modeConstitution: 'MONTEE',
      statut: 'INSCRIPTION',
      dateDebut: new Date('2026-03-03'),
      dateFin: new Date('2026-03-03'),
      lieu: 'Test Arena 16T',
      maxParticipants: 32,
      organisateurId: organizer.id,
      params: { consolante: true },
    },
  });
  console.log('✅ Tournament created:', concours.nom, `(ID: ${concours.id})`);

  // 3. Create terrains
  const terrains = await Promise.all([
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
    prisma.terrain.create({
      data: { concoursId: concours.id, numero: 5, nom: 'Terrain 5' },
    }),
    prisma.terrain.create({
      data: { concoursId: concours.id, numero: 6, nom: 'Terrain 6' },
    }),
  ]);
  console.log('✅ Terrains created: 6');

  // 4. Create 32 players (for 16 teams of 2)
  const players = [];
  for (let i = 1; i <= 32; i++) {
    const player = await prisma.joueur.create({
      data: {
        nom: `Player${i}`,
        prenom: `Test`,
        email: `player${i}-16t@test.fr`,
        genre: i % 2 === 0 ? 'HOMME' : 'FEMME',
        dateNaissance: new Date('1990-01-01'),
        licence: `LIC16T${String(i).padStart(3, '0')}`,
      },
    });
    players.push(player);
  }
  console.log('✅ Players created: 32');

  // 5. Create 16 teams (2 players each)
  const teams = [];
  for (let i = 0; i < 16; i++) {
    const teamLetter = i < 26 ? String.fromCharCode(65 + i) : `Team${i + 1}`;
    const team = await prisma.equipe.create({
      data: {
        nom: `Team ${teamLetter}`,
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
  console.log('✅ Teams created: 16 (Team A through P)');

  // 6. Start tournament
  await prisma.concours.update({
    where: { id: concours.id },
    data: { statut: 'EN_COURS' },
  });
  console.log('✅ Tournament started');

  console.log('\n=== Tournament Setup Complete ===');
  console.log(`Tournament ID: ${concours.id}`);
  console.log(`Access via: http://localhost:5173/concours/${concours.id}`);
  console.log(`Login: orga-16teams@petanque.fr / orga1234`);
  console.log('\n✨ Ready to launch bracket! Go to "Parties" tab and click "Lancer le Tour 1"');
  console.log('\n📋 Expected Structure:');
  console.log('   Round 2 (1/16): 8 matches (if 16 teams, else with byes)');
  console.log('   Round 3 (1/8): 4 matches');
  console.log('   Round 4 (1/4): 2 matches');
  console.log('   Round 5 (1/2): 1 match (semi-final)');
  console.log('   Round 6 (Finals): Grande Finale + Petite Finale');
  console.log('   Consolante: Separate bracket for Round 1 losers (8 teams)\n');
  console.log('\n📝 Note: With exactly 16 teams, bracket fills perfectly (no byes needed)');
  console.log('   To test byes: Delete some teams before launching bracket\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
