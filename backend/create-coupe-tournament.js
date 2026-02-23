const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createCoupeTournament() {
  try {
    console.log('🎯 Creating COUPE tournament with 23 teams...\n');

    // Get organisateur
    const orga = await prisma.joueur.findUnique({
      where: { email: 'orga@petanque.fr' }
    });

    if (!orga) {
      console.error('❌ Organisateur not found!');
      return;
    }

    // Create tournament
    const concours = await prisma.concours.create({
      data: {
        nom: 'Coupe Test A_MONTER - 23 équipes',
        lieu: 'Boulodrome Municipal',
        format: 'COUPE',
        typeEquipe: 'DOUBLETTE',
        modeConstitution: 'MONTEE',
        statut: 'INSCRIPTION',
        nbTerrains: 4,
        maxParticipants: 46,
        dateDebut: new Date('2026-03-01'),
        dateFin: new Date('2026-03-01'),
        params: {
          consolante: true
        },
        organisateurId: orga.id
      }
    });

    console.log(`✅ Tournament created: "${concours.nom}"`);
    console.log(`   ID: ${concours.id}`);

    // Create terrains
    for (let i = 1; i <= 4; i++) {
      await prisma.terrain.create({
        data: {
          concoursId: concours.id,
          numero: i,
          emplacement: `Terrain ${i}`
        }
      });
    }
    console.log(`✅ Created 4 terrains\n`);

    // Get existing players
    const players = await prisma.joueur.findMany({
      where: {
        email: { endsWith: '@petanque.fr' },
        role: { not: 'SUPER_ADMIN' }
      },
      take: 50
    });

    // Create 23 teams with 2 players each
    const teamNames = [
      'Les Champions', 'Les Invincibles', 'Les Boules d\'Or', 'Les Tireurs d\'Elite',
      'Les Marseillais', 'Les Niçois', 'Les Toulousains', 'Les Lyonnais',
      'Les Pointeurs', 'Les Tireurs', 'Les Stratèges', 'Les Vétérans',
      'Les Jeunes Loups', 'Les Amis du Cochonnet', 'Les Provençaux', 'Les Bretons',
      'Les Parisiens', 'Les Bordelais', 'Les Lillois', 'Les Nantais',
      'Les Rennais', 'Les Montpelliérains', 'Les Dijonnais'
    ];

    for (let i = 0; i < 23; i++) {
      const playerIndex1 = (i * 2) % players.length;
      const playerIndex2 = (i * 2 + 1) % players.length;

      const equipe = await prisma.equipe.create({
        data: {
          concoursId: concours.id,
          nom: teamNames[i],
          statut: 'INSCRITE',
          joueurs: {
            create: [
              { joueurId: players[playerIndex1].id },
              { joueurId: players[playerIndex2].id }
            ]
          }
        },
        include: {
          joueurs: {
            include: { joueur: true }
          }
        }
      });

      console.log(`✅ Team ${i + 1}/23: ${equipe.nom}`);
      console.log(`   Players: ${equipe.joueurs[0].joueur.prenom} ${equipe.joueurs[0].joueur.nom} & ${equipe.joueurs[1].joueur.prenom} ${equipe.joueurs[1].joueur.nom}`);
    }

    console.log('\n✅ Tournament setup complete!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  TOURNAMENT DETAILS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Name: ${concours.nom}`);
    console.log(`  ID: ${concours.id}`);
    console.log(`  Format: COUPE with Consolante`);
    console.log(`  Teams: 23 (will create 32-slot bracket with 9 byes)`);
    console.log(`  Terrains: 4`);
    console.log(`  Status: INSCRIPTION (ready to start)`);
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('🎯 Next steps:');
    console.log('  1. Log in as: orga@petanque.fr / orga1234');
    console.log('  2. Navigate to this tournament');
    console.log('  3. Click "Démarrer le concours"');
    console.log('  4. Launch the bracket with "Lancer le bracket COUPE"');
    console.log('  5. Check the Consolante tab to see A_MONTER matches!');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

createCoupeTournament();
