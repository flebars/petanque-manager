/**
 * Test Script: 8-Team COUPE Tournament (with Consolante)
 * 
 * Tournament Structure:
 * - 8 teams → 4 quarters (bracketRonde=4) → 2 semis (bracketRonde=5) → 2 finals (bracketRonde=6)
 * - Tests the main refactoring: completing 2 of 4 quarters should NOT create finals
 * - Grande Finale: winners of semi-finals
 * - Petite Finale: losers of semi-finals
 * - Consolante: Round 1 losers (4 teams) compete in their own bracket
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Creating 8-Team COUPE Tournament with Consolante ===\n');

  // 1. Create organizer user
  const hashedPassword = await bcrypt.hash('orga1234', 10);
  const organizer = await prisma.utilisateur.upsert({
    where: { email: 'orga-8teams@petanque.fr' },
    update: {},
    create: {
      email: 'orga-8teams@petanque.fr',
      nom: 'Test',
      prenom: 'Organizer 8',
      motDePasse: hashedPassword,
      role: 'ORGANISATEUR',
    },
  });
  console.log('✅ Organizer created:', organizer.email);

  // 2. Create tournament
  const concours = await prisma.concours.create({
    data: {
      nom: 'Test COUPE 8 Teams - Quarter-finals Test',
      format: 'COUPE',
      typeEquipe: 'DOUBLETTE',
      modeConstitution: 'MONTEE',
      statut: 'INSCRIPTION',
      dateDebut: new Date('2026-03-02'),
      dateFin: new Date('2026-03-02'),
      lieu: 'Test Arena 8T',
      maxParticipants: 16,
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
  ]);
  console.log('✅ Terrains created: 4');

  // 4. Create 16 players (for 8 teams of 2)
  const players = [];
  for (let i = 1; i <= 16; i++) {
    const player = await prisma.joueur.create({
      data: {
        nom: `Player${i}`,
        prenom: `Test`,
        email: `player${i}-8t@test.fr`,
        genre: i % 2 === 0 ? 'HOMME' : 'FEMME',
        dateNaissance: new Date('1990-01-01'),
        licence: `LIC8T${String(i).padStart(3, '0')}`,
      },
    });
    players.push(player);
  }
  console.log('✅ Players created: 16');

  // 5. Create 8 teams (2 players each)
  const teams = [];
  for (let i = 0; i < 8; i++) {
    const team = await prisma.equipe.create({
      data: {
        nom: `Team ${String.fromCharCode(65 + i)}`,
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
  console.log('✅ Teams created: 8 (Team A through H)');

  // 6. Start tournament
  await prisma.concours.update({
    where: { id: concours.id },
    data: { statut: 'EN_COURS' },
  });
  console.log('✅ Tournament started');

  console.log('\n=== Tournament Setup Complete ===');
  console.log(`Tournament ID: ${concours.id}`);
  console.log(`Access via: http://localhost:5173/concours/${concours.id}`);
  console.log(`Login: orga-8teams@petanque.fr / orga1234`);
  console.log('\n✨ Ready to launch bracket! Go to "Parties" tab and click "Lancer le Tour 1"');
  console.log('\n📋 Expected Structure:');
  console.log('   Round 4 (Quarter-finals): 4 matches');
  console.log('   Round 5 (Semi-finals): 2 matches (created after quarters complete)');
  console.log('   Round 6 (Finals): Grande Finale + Petite Finale');
  console.log('   Consolante: Separate bracket for Round 1 losers (4 teams)\n');
  console.log('\n⚠️  Test Scenario: Complete only 2 of 4 quarter-finals');
  console.log('   Expected: Only those 2 winners advance to semis');
  console.log('   Expected: NO finals created yet (old bug would create them)');
  console.log('   Expected: When all 4 quarters done, both semi-finals ready\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
