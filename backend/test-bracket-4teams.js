/**
 * Test Script: 4-Team COUPE Tournament (with Consolante)
 * 
 * Tournament Structure:
 * - 4 teams → 2 semi-finals (bracketRonde=5) → 2 finals (bracketRonde=6)
 * - Grande Finale: winners of semi-finals
 * - Petite Finale: losers of semi-finals
 * - Consolante: Round 1 losers compete for their own bracket
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Creating 4-Team COUPE Tournament with Consolante ===\n');

  // 1. Create organizer user
  const hashedPassword = await bcrypt.hash('orga1234', 10);
  const organizer = await prisma.utilisateur.upsert({
    where: { email: 'orga-4teams@petanque.fr' },
    update: {},
    create: {
      email: 'orga-4teams@petanque.fr',
      nom: 'Test',
      prenom: 'Organizer 4',
      motDePasse: hashedPassword,
      role: 'ORGANISATEUR',
    },
  });
  console.log('✅ Organizer created:', organizer.email);

  // 2. Create tournament
  const concours = await prisma.concours.create({
    data: {
      nom: 'Test COUPE 4 Teams - Semi-finals Test',
      format: 'COUPE',
      typeEquipe: 'DOUBLETTE',
      modeConstitution: 'MONTEE',
      statut: 'INSCRIPTION',
      dateDebut: new Date('2026-03-01'),
      dateFin: new Date('2026-03-01'),
      lieu: 'Test Arena 4T',
      maxParticipants: 8,
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
  ]);
  console.log('✅ Terrains created: 2');

  // 4. Create 8 players (for 4 teams of 2)
  const players = [];
  for (let i = 1; i <= 8; i++) {
    const player = await prisma.joueur.create({
      data: {
        nom: `Player${i}`,
        prenom: `Test`,
        email: `player${i}-4t@test.fr`,
        genre: i % 2 === 0 ? 'HOMME' : 'FEMME',
        dateNaissance: new Date('1990-01-01'),
        licence: `LIC4T${String(i).padStart(3, '0')}`,
      },
    });
    players.push(player);
  }
  console.log('✅ Players created: 8');

  // 5. Create 4 teams (2 players each)
  const teams = [];
  for (let i = 0; i < 4; i++) {
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
  console.log('✅ Teams created: 4 (Team A, B, C, D)');

  // 6. Start tournament
  await prisma.concours.update({
    where: { id: concours.id },
    data: { statut: 'EN_COURS' },
  });
  console.log('✅ Tournament started');

  console.log('\n=== Tournament Setup Complete ===');
  console.log(`Tournament ID: ${concours.id}`);
  console.log(`Access via: http://localhost:5173/concours/${concours.id}`);
  console.log(`Login: orga-4teams@petanque.fr / orga1234`);
  console.log('\n✨ Ready to launch bracket! Go to "Parties" tab and click "Lancer le Tour 1"');
  console.log('\n📋 Expected Structure:');
  console.log('   Round 5 (Semi-finals): 2 matches');
  console.log('   Round 6 (Finals): Grande Finale + Petite Finale');
  console.log('   Consolante: Separate bracket for Round 1 losers\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
