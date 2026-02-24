import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  console.log('🌱 Seeding CHAMPIONNAT test data...\n');

  // Clean existing data
  console.log('🧹 Cleaning existing test data...');
  await prisma.partie.deleteMany({ where: { concours: { nom: { startsWith: 'TEST CHAMP' } } } });
  await prisma.classement.deleteMany({ where: { concours: { nom: { startsWith: 'TEST CHAMP' } } } });
  await prisma.classementJoueur.deleteMany({ where: { concours: { nom: { startsWith: 'TEST CHAMP' } } } });
  await prisma.pouleEquipe.deleteMany({ where: { poule: { concours: { nom: { startsWith: 'TEST CHAMP' } } } } });
  await prisma.poule.deleteMany({ where: { concours: { nom: { startsWith: 'TEST CHAMP' } } } });
  await prisma.equipeJoueur.deleteMany({ where: { equipe: { concours: { nom: { startsWith: 'TEST CHAMP' } } } } });
  await prisma.equipe.deleteMany({ where: { concours: { nom: { startsWith: 'TEST CHAMP' } } } });
  await prisma.terrain.deleteMany({ where: { concours: { nom: { startsWith: 'TEST CHAMP' } } } });
  await prisma.tirageLog.deleteMany({ where: { concours: { nom: { startsWith: 'TEST CHAMP' } } } });
  await prisma.concours.deleteMany({ where: { nom: { startsWith: 'TEST CHAMP' } } });

  // Create test organizer
  const hashedPassword = await bcrypt.hash('test123', 10);
  const organizer = await prisma.joueur.upsert({
    where: { email: 'organizer@test.com' },
    update: {},
    create: {
      email: 'organizer@test.com',
      nom: 'Dupont',
      prenom: 'Jean',
      passwordHash: hashedPassword,
      genre: 'H',
      role: 'ORGANISATEUR',
    },
  });

  console.log('✅ Created organizer:', organizer.email);

  // ====================
  // STAGE 1: Ready to Launch Pools
  // ====================
  console.log('\n📍 STAGE 1: Creating tournament ready to launch pools...');
  
  const stage1 = await prisma.concours.create({
    data: {
      nom: 'TEST CHAMP 1 - Ready for Pools',
      lieu: 'Stade Municipal',
      dateDebut: new Date(),
      dateFin: new Date(Date.now() + 86400000), // +1 day
      format: 'CHAMPIONNAT',
      typeEquipe: 'TRIPLETTE',
      modeConstitution: 'MONTEE',
      statut: 'EN_COURS',
      nbTerrains: 4,
      maxParticipants: 16,
      params: { taillePoule: 4 },
      organisateurId: organizer.id,
    },
  });

  // Create 12 teams (will create 3 pools of 4)
  const stage1Teams = [];
  for (let i = 1; i <= 12; i++) {
    const team = await prisma.equipe.create({
      data: {
        concoursId: stage1.id,
        nom: `Équipe ${i}`,
        statut: 'PRESENTE',
      },
    });
    stage1Teams.push(team);
  }

  // Create terrains
  for (let i = 1; i <= 4; i++) {
    await prisma.terrain.create({
      data: {
        concoursId: stage1.id,
        numero: i,
      },
    });
  }

  console.log(`✅ Stage 1: ${stage1Teams.length} teams ready | Use "Lancer les Poules" button`);

  // ====================
  // STAGE 2: Pools In Progress
  // ====================
  console.log('\n📍 STAGE 2: Creating tournament with pools in progress...');
  
  const stage2 = await prisma.concours.create({
    data: {
      nom: 'TEST CHAMP 2 - Pools In Progress',
      lieu: 'Complexe Sportif',
      dateDebut: new Date(),
      dateFin: new Date(Date.now() + 86400000),
      format: 'CHAMPIONNAT',
      typeEquipe: 'DOUBLETTE',
      modeConstitution: 'MONTEE',
      statut: 'EN_COURS',
      nbTerrains: 3,
      maxParticipants: 16,
      params: { taillePoule: 4 },
      organisateurId: organizer.id,
    },
  });

  // Create 8 teams (2 pools of 4)
  const stage2Teams = [];
  for (let i = 1; i <= 8; i++) {
    const team = await prisma.equipe.create({
      data: {
        concoursId: stage2.id,
        nom: `Équipe S2-${i}`,
        statut: 'PRESENTE',
      },
    });
    stage2Teams.push(team);
  }

  // Create terrains
  const stage2Terrains = [];
  for (let i = 1; i <= 3; i++) {
    const terrain = await prisma.terrain.create({
      data: {
        concoursId: stage2.id,
        numero: i,
      },
    });
    stage2Terrains.push(terrain);
  }

  // Create 2 pools
  const stage2Poules = [];
  for (let p = 0; p < 2; p++) {
    const poule = await prisma.poule.create({
      data: {
        concoursId: stage2.id,
        numero: p + 1,
        statut: 'EN_COURS',
      },
    });
    stage2Poules.push(poule);

    // Assign 4 teams to each pool
    for (let t = 0; t < 4; t++) {
      await prisma.pouleEquipe.create({
        data: {
          pouleId: poule.id,
          equipeId: stage2Teams[p * 4 + t].id,
        },
      });
    }

    // Create round-robin matches (6 matches per pool of 4)
    const poolTeams = stage2Teams.slice(p * 4, (p + 1) * 4);
    let matchIdx = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const isCompleted = matchIdx < 3; // First 3 matches completed, last 3 in progress
        await prisma.partie.create({
          data: {
            concoursId: stage2.id,
            pouleId: poule.id,
            tour: 1,
            equipeAId: poolTeams[i].id,
            equipeBId: poolTeams[j].id,
            terrainId: stage2Terrains[matchIdx % 3].id,
            type: 'CHAMPIONNAT_POULE',
            statut: isCompleted ? 'TERMINEE' : 'EN_COURS',
            scoreA: isCompleted ? 13 : null,
            scoreB: isCompleted ? Math.floor(Math.random() * 10) : null,
            heureDebut: isCompleted ? new Date(Date.now() - 3600000) : new Date(),
            heureFin: isCompleted ? new Date(Date.now() - 1800000) : null,
          },
        });
        matchIdx++;
      }
    }
  }

  console.log(`✅ Stage 2: 2 pools with some matches completed | Play remaining matches to finish pools`);

  // ====================
  // STAGE 3: Pools Complete, Ready for Bracket
  // ====================
  console.log('\n📍 STAGE 3: Creating tournament with completed pools...');
  
  const stage3 = await prisma.concours.create({
    data: {
      nom: 'TEST CHAMP 3 - Ready for Bracket',
      lieu: 'Centre Sportif',
      dateDebut: new Date(),
      dateFin: new Date(Date.now() + 86400000),
      format: 'CHAMPIONNAT',
      typeEquipe: 'TRIPLETTE',
      modeConstitution: 'MONTEE',
      statut: 'EN_COURS',
      nbTerrains: 3,
      maxParticipants: 16,
      params: { taillePoule: 4 },
      organisateurId: organizer.id,
    },
  });

  // Create 8 teams
  const stage3Teams = [];
  for (let i = 1; i <= 8; i++) {
    const team = await prisma.equipe.create({
      data: {
        concoursId: stage3.id,
        nom: `Équipe S3-${i}`,
        statut: 'PRESENTE',
      },
    });
    stage3Teams.push(team);
  }

  // Create terrains
  const stage3Terrains = [];
  for (let i = 1; i <= 3; i++) {
    const terrain = await prisma.terrain.create({
      data: {
        concoursId: stage3.id,
        numero: i,
      },
    });
    stage3Terrains.push(terrain);
  }

  // Create 2 pools with ALL matches completed
  for (let p = 0; p < 2; p++) {
    const poule = await prisma.poule.create({
      data: {
        concoursId: stage3.id,
        numero: p + 1,
        statut: 'EN_COURS',
      },
    });

    // Assign 4 teams
    for (let t = 0; t < 4; t++) {
      await prisma.pouleEquipe.create({
        data: {
          pouleId: poule.id,
          equipeId: stage3Teams[p * 4 + t].id,
        },
      });
    }

    // Create ALL round-robin matches (all completed)
    const poolTeams = stage3Teams.slice(p * 4, (p + 1) * 4);
    let matchIdx = 0;

    // Create matches with predetermined scores for realistic rankings
    const scores = [
      [13, 5],  // Team 0 wins
      [13, 7],  // Team 0 wins
      [8, 13],  // Team 1 wins
      [13, 9],  // Team 0 wins
      [6, 13],  // Team 1 wins
      [13, 11], // Team 2 wins
    ];

    let scoreIdx = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const [scoreA, scoreB] = scores[scoreIdx % scores.length];
        await prisma.partie.create({
          data: {
            concoursId: stage3.id,
            pouleId: poule.id,
            tour: 1,
            equipeAId: poolTeams[i].id,
            equipeBId: poolTeams[j].id,
            terrainId: stage3Terrains[matchIdx % 3].id,
            type: 'CHAMPIONNAT_POULE',
            statut: 'TERMINEE',
            scoreA,
            scoreB,
            heureDebut: new Date(Date.now() - 7200000 + matchIdx * 600000),
            heureFin: new Date(Date.now() - 3600000 + matchIdx * 600000),
          },
        });
        matchIdx++;
        scoreIdx++;
      }
    }
  }

  console.log(`✅ Stage 3: All pool matches completed | Use "Lancer la Phase Finale" button`);

  // ====================
  // STAGE 4: Bracket In Progress
  // ====================
  console.log('\n📍 STAGE 4: Creating tournament with bracket in progress...');
  
  const stage4 = await prisma.concours.create({
    data: {
      nom: 'TEST CHAMP 4 - Bracket In Progress',
      lieu: 'Arena Sportive',
      dateDebut: new Date(),
      dateFin: new Date(Date.now() + 86400000),
      format: 'CHAMPIONNAT',
      typeEquipe: 'TRIPLETTE',
      modeConstitution: 'MONTEE',
      statut: 'EN_COURS',
      nbTerrains: 2,
      maxParticipants: 16,
      params: { taillePoule: 4 },
      organisateurId: organizer.id,
    },
  });

  // Create 8 teams
  const stage4Teams = [];
  for (let i = 1; i <= 8; i++) {
    const team = await prisma.equipe.create({
      data: {
        concoursId: stage4.id,
        nom: `Équipe S4-${i}`,
        statut: 'PRESENTE',
      },
    });
    stage4Teams.push(team);
  }

  // Create terrains
  const stage4Terrains = [];
  for (let i = 1; i <= 2; i++) {
    const terrain = await prisma.terrain.create({
      data: {
        concoursId: stage4.id,
        numero: i,
      },
    });
    stage4Terrains.push(terrain);
  }

  // Create 2 pools with completed matches
  for (let p = 0; p < 2; p++) {
    const poule = await prisma.poule.create({
      data: {
        concoursId: stage4.id,
        numero: p + 1,
        statut: 'TERMINE',
      },
    });

    for (let t = 0; t < 4; t++) {
      await prisma.pouleEquipe.create({
        data: {
          pouleId: poule.id,
          equipeId: stage4Teams[p * 4 + t].id,
        },
      });
    }

    // Create completed pool matches
    const poolTeams = stage4Teams.slice(p * 4, (p + 1) * 4);
    let matchIdx = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        await prisma.partie.create({
          data: {
            concoursId: stage4.id,
            pouleId: poule.id,
            tour: 1,
            equipeAId: poolTeams[i].id,
            equipeBId: poolTeams[j].id,
            terrainId: stage4Terrains[matchIdx % 2].id,
            type: 'CHAMPIONNAT_POULE',
            statut: 'TERMINEE',
            scoreA: 13,
            scoreB: Math.floor(Math.random() * 10),
            heureDebut: new Date(Date.now() - 14400000),
            heureFin: new Date(Date.now() - 10800000),
          },
        });
        matchIdx++;
      }
    }
  }

  // Create bracket phase (4 qualified teams = 2 semi-finals)
  // Top 2 from each pool qualify
  const qualifiedTeams = [
    stage4Teams[0], stage4Teams[1], // Pool 1 top 2
    stage4Teams[4], stage4Teams[5], // Pool 2 top 2
  ];

  // Semi-final 1: Completed
  await prisma.partie.create({
    data: {
      concoursId: stage4.id,
      tour: 2,
      equipeAId: qualifiedTeams[0].id,
      equipeBId: qualifiedTeams[3].id,
      terrainId: stage4Terrains[0].id,
      type: 'CHAMPIONNAT_FINALE',
      bracketRonde: 5, // Semi-final
      bracketPos: 0,
      statut: 'TERMINEE',
      scoreA: 13,
      scoreB: 8,
      heureDebut: new Date(Date.now() - 3600000),
      heureFin: new Date(Date.now() - 1800000),
    },
  });

  // Semi-final 2: In progress
  await prisma.partie.create({
    data: {
      concoursId: stage4.id,
      tour: 2,
      equipeAId: qualifiedTeams[1].id,
      equipeBId: qualifiedTeams[2].id,
      terrainId: stage4Terrains[1].id,
      type: 'CHAMPIONNAT_FINALE',
      bracketRonde: 5, // Semi-final
      bracketPos: 1,
      statut: 'EN_COURS',
      scoreA: null,
      scoreB: null,
      heureDebut: new Date(),
    },
  });

  console.log(`✅ Stage 4: 1 semi-final completed, 1 in progress | Complete to unlock final`);

  // ====================
  // Summary
  // ====================
  console.log('\n' + '='.repeat(70));
  console.log('✨ Test Data Summary');
  console.log('='.repeat(70));
  console.log(`
🔐 Login Credentials:
   Email: organizer@test.com
   Password: test123

📋 Tournaments Created:

1️⃣  TEST CHAMP 1 - Ready for Pools
   └─ 12 teams registered (3 pools of 4)
   └─ Action: Click "Lancer les Poules" to start pool phase

2️⃣  TEST CHAMP 2 - Pools In Progress  
   └─ 2 pools, some matches completed
   └─ Action: Complete remaining pool matches

3️⃣  TEST CHAMP 3 - Ready for Bracket
   └─ All pool matches completed
   └─ Action: Click "Lancer la Phase Finale" to start bracket

4️⃣  TEST CHAMP 4 - Bracket In Progress
   └─ Bracket phase started, 1 semi-final done
   └─ Action: Complete remaining semi-final, then final

📍 Navigate to: http://localhost:5173/concours
  `);
  console.log('='.repeat(70));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\n✅ Seed completed successfully!');
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
