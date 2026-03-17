import 'dotenv/config';
import { PrismaClient, Role, Genre, Categorie, FormatConcours, TypeEquipe, ModeConstitution, StatutEquipe, StatutPartie, TypePartie } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  console.log(`Seeding database (${isProduction ? 'production' : 'development'})...`);

  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin1234';
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.joueur.upsert({
    where: { email: 'admin@petanque.fr' },
    update: {},
    create: {
      email: 'admin@petanque.fr',
      passwordHash: adminHash,
      nom: 'Martin',
      prenom: 'Julien',
      genre: Genre.H,
      role: Role.SUPER_ADMIN,
      categorie: Categorie.SENIOR,
      club: 'FFPJP',
    },
  });
  console.log(`  ✓ Super-admin: ${admin.email} / ${isProduction ? '***' : adminPassword}`);

  if (isProduction) {
    console.log('\n✅ Seed production terminé.\n');
    return;
  }

  const orgHash = await bcrypt.hash('orga1234', 10);
  const organisateur = await prisma.joueur.upsert({
    where: { email: 'orga@petanque.fr' },
    update: {},
    create: {
      email: 'orga@petanque.fr',
      passwordHash: orgHash,
      nom: 'Dupont',
      prenom: 'Claire',
      genre: Genre.F,
      role: Role.ORGANISATEUR,
      categorie: Categorie.SENIOR,
      club: 'Marseille Pétanque Club',
    },
  });
  console.log(`  ✓ Organisateur: ${organisateur.email} / orga1234`);

  const arbHash = await bcrypt.hash('arb1234', 10);
  const arbitre = await prisma.joueur.upsert({
    where: { email: 'arbitre@petanque.fr' },
    update: {},
    create: {
      email: 'arbitre@petanque.fr',
      passwordHash: arbHash,
      nom: 'Bernard',
      prenom: 'Luc',
      genre: Genre.H,
      role: Role.ARBITRE,
      categorie: Categorie.VETERAN,
      club: 'Marseille Pétanque Club',
    },
  });
  console.log(`  ✓ Arbitre: ${arbitre.email} / arb1234`);

  const clubs = [
    'Marseille PC', 'Toulon Boules', 'Nice Pétanque', 'Aix Boules',
    'Lyon Pétanque', 'Bordeaux PC', 'Paris Pétanque', 'Montpellier BC',
    'Toulouse BC', 'Nantes Pétanque', 'Strasbourg Boules', 'Lille PC',
  ];

  const prenoms = [
    'Pierre', 'Sophie', 'Marc', 'Isabelle', 'Thomas', 'Nathalie', 'Antoine', 'Marie',
    'Christophe', 'Véronique', 'David', 'Céline', 'Franck', 'Sandrine', 'Nicolas', 'Émilie',
    'Laurent', 'Martine', 'Julien', 'Caroline', 'Sébastien', 'Patricia', 'Olivier', 'Sylvie',
    'Philippe', 'Catherine', 'Michel', 'Brigitte', 'Alain', 'Monique', 'Jean', 'Christine',
    'Daniel', 'Françoise', 'Pascal', 'Dominique', 'Jacques', 'Jacqueline', 'Bernard', 'Annie',
    'Robert', 'Claudine', 'André', 'Michèle', 'Georges', 'Denise', 'Henri', 'Colette',
    'René', 'Simone', 'Louis', 'Yvette', 'Claude', 'Paulette', 'Gérard', 'Madeleine',
  ];

  const noms = [
    'Leblanc', 'Morel', 'Garnier', 'Petit', 'Roux', 'Fournier', 'Girard', 'Bonnet',
    'Lemaire', 'Simon', 'Laurent', 'Michel', 'Leroy', 'Marchand', 'Bertrand', 'Gros',
    'Faure', 'Fontaine', 'Rousseau', 'Vincent', 'Muller', 'Lefebvre', 'Chevalier', 'Blanc',
    'Garcia', 'Fernandez', 'Lopez', 'Martinez', 'Sanchez', 'Perez', 'Gonzalez', 'Rodriguez',
    'Dupuis', 'Clement', 'Gauthier', 'Boyer', 'Perrin', 'Arnaud', 'Guillot', 'Renard',
    'Picard', 'Meunier', 'Brun', 'Robin', 'Rey', 'Barbier', 'Colin', 'Fabre',
    'Mercier', 'Aubert', 'Rolland', 'Caron', 'Lacroix', 'Besson', 'Masson', 'Philippe',
  ];

  const joueurs = [];
  for (let i = 0; i < 56; i++) {
    const prenom = prenoms[i];
    const nom = noms[i];
    const email = `${prenom.toLowerCase().replace(/[éèê]/g, 'e')}.${nom.toLowerCase()}@petanque.fr`;
    const hash = await bcrypt.hash('joueur1234', 10);
    const categorie = i < 10 ? Categorie.JEUNE : i < 40 ? Categorie.SENIOR : i < 50 ? Categorie.VETERAN : Categorie.FEMININ;
    const j = await prisma.joueur.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: hash,
        nom,
        prenom,
        genre: i % 2 === 0 ? Genre.H : Genre.F,
        categorie,
        club: clubs[i % clubs.length],
        role: Role.CAPITAINE,
        licenceFfpjp: `FFPJP-${String(100 + i).padStart(6, '0')}`,
      },
    });
    joueurs.push(j);
  }
  console.log(`  ✓ ${joueurs.length} joueurs créés (mot de passe: joueur1234)`);

  const dateDebut1 = new Date('2026-02-20T09:00:00');
  const dateFin1 = new Date('2026-02-20T18:00:00');

  const concours1 = await prisma.concours.create({
    data: {
      nom: 'Grand Prix de Marseille 2026',
      lieu: 'Terrain du Parc Borély, Marseille',
      format: FormatConcours.MELEE,
      typeEquipe: TypeEquipe.DOUBLETTE,
      modeConstitution: ModeConstitution.MONTEE,
      statut: 'EN_COURS',
      nbTerrains: 4,
      maxParticipants: 16,
      dateDebut: dateDebut1,
      dateFin: dateFin1,
      params: { nbTours: 5 },
      organisateurId: organisateur.id,
    },
  });

  const terrains1 = [];
  for (let i = 1; i <= 4; i++) {
    const t = await prisma.terrain.create({
      data: { concoursId: concours1.id, numero: i, emplacement: `Allée ${i}` },
    });
    terrains1.push(t);
  }

  const equipes1 = [];
  for (let i = 0; i < 8; i++) {
    const j1 = joueurs[i * 2];
    const j2 = joueurs[i * 2 + 1];
    const equipe = await prisma.equipe.create({
      data: {
        concoursId: concours1.id,
        statut: StatutEquipe.PRESENTE,
        numeroTirage: i + 1,
        joueurs: {
          create: [{ joueurId: j1.id }, { joueurId: j2.id }],
        },
      },
    });
    equipes1.push(equipe);
  }
  console.log(`  ✓ Concours 1 "${concours1.nom}": 8 équipes créées`);

  const tour1Pairs = [
    [0, 1, 13, 7],
    [2, 3, 8, 13],
    [4, 5, 13, 11],
    [6, 7, 6, 13],
  ] as const;

  for (const [ai, bi, sA, sB] of tour1Pairs) {
    const terrainIdx = tour1Pairs.findIndex(p => p[0] === ai);
    await prisma.partie.create({
      data: {
        concoursId: concours1.id,
        tour: 1,
        equipeAId: equipes1[ai].id,
        equipeBId: equipes1[bi].id,
        terrainId: terrains1[terrainIdx % 4].id,
        scoreA: sA,
        scoreB: sB,
        statut: StatutPartie.TERMINEE,
        type: TypePartie.MELEE,
      },
    });
  }

  const tour2Parties = [
    { ai: 0, bi: 4, sA: 13, sB: 5, statut: StatutPartie.TERMINEE, terrain: 0 },
    { ai: 7, bi: 3, sA: 9, sB: 13, statut: StatutPartie.TERMINEE, terrain: 1 },
    { ai: 2, bi: 6, sA: null, sB: null, statut: StatutPartie.EN_COURS, terrain: 2 },
    { ai: 1, bi: 5, sA: null, sB: null, statut: StatutPartie.A_JOUER, terrain: 3 },
  ];

  for (const p of tour2Parties) {
    await prisma.partie.create({
      data: {
        concoursId: concours1.id,
        tour: 2,
        equipeAId: equipes1[p.ai].id,
        equipeBId: equipes1[p.bi].id,
        terrainId: terrains1[p.terrain].id,
        scoreA: p.sA,
        scoreB: p.sB,
        statut: p.statut,
        type: TypePartie.MELEE,
      },
    });
  }

  const classmentsData = [
    [0, 1, 0, 13, 7, 13 / 7, 1],
    [5, 1, 0, 13, 11, 13 / 11, 2],
    [3, 1, 0, 13, 8, 13 / 8, 3],
    [7, 1, 0, 13, 6, 13 / 6, 4],
    [1, 0, 1, 7, 13, 7 / 13, 5],
    [4, 0, 1, 11, 13, 11 / 13, 6],
    [2, 0, 1, 8, 13, 8 / 13, 7],
    [6, 0, 1, 6, 13, 6 / 13, 8],
  ] as const;

  for (const [idx, v, d, pm, pe, q, rang] of classmentsData) {
    await prisma.classement.create({
      data: {
        concoursId: concours1.id,
        equipeId: equipes1[idx].id,
        victoires: v,
        defaites: d,
        pointsMarques: pm,
        pointsEncaisses: pe,
        quotient: q,
        rang,
      },
    });
  }
  console.log(`  ✓ Tours 1 & 2 créés, classement initialisé`);

  const dateDebut2 = new Date('2026-03-15T09:00:00');
  const dateFin2 = new Date('2026-03-15T18:00:00');

  const concours2 = await prisma.concours.create({
    data: {
      nom: 'Tournoi du Printemps - Triplette',
      lieu: 'Boulodrome de la Plage, Nice',
      format: FormatConcours.MELEE,
      typeEquipe: TypeEquipe.TRIPLETTE,
      modeConstitution: ModeConstitution.MONTEE,
      statut: 'INSCRIPTION',
      nbTerrains: 6,
      maxParticipants: 24,
      dateDebut: dateDebut2,
      dateFin: dateFin2,
      params: { nbTours: 6 },
      organisateurId: admin.id,
    },
  });

  const triplettePlayers = [
    [joueurs[0], joueurs[2], joueurs[4]],
    [joueurs[1], joueurs[3], joueurs[5]],
    [joueurs[6], joueurs[8], joueurs[10]],
  ];

  for (let i = 0; i < triplettePlayers.length; i++) {
    const group = triplettePlayers[i];
    await prisma.equipe.create({
      data: {
        concoursId: concours2.id,
        statut: i === 0 ? StatutEquipe.PRESENTE : StatutEquipe.INSCRITE,
        joueurs: {
          create: group.map((j) => ({ joueurId: j.id })),
        },
      },
    });
  }

  console.log(`  ✓ Concours 2 "${concours2.nom}": 3 équipes inscrites`);

  const concours3 = await prisma.concours.create({
    data: {
      nom: 'Coupe de la Saint-Valentin 2026',
      lieu: 'Terrain Central, Toulon',
      format: FormatConcours.MELEE,
      typeEquipe: TypeEquipe.DOUBLETTE,
      modeConstitution: ModeConstitution.MONTEE,
      statut: 'TERMINE',
      nbTerrains: 3,
      maxParticipants: 12,
      dateDebut: new Date('2026-02-14T09:00:00'),
      dateFin: new Date('2026-02-14T18:00:00'),
      params: { nbTours: 4 },
      organisateurId: organisateur.id,
    },
  });

  const equipes3: { id: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const j1 = joueurs[i % joueurs.length];
    const j2 = joueurs[(i + 6) % joueurs.length];
    const e = await prisma.equipe.create({
      data: {
        concoursId: concours3.id,
        statut: StatutEquipe.PRESENTE,
        joueurs: {
          create: [{ joueurId: j1.id }, { joueurId: j2.id }],
        },
      },
    });
    equipes3.push(e);
  }

  const classement3 = [
    [0, 4, 0, 52, 18, 52 / 18, 1],
    [3, 3, 1, 46, 31, 46 / 31, 2],
    [1, 3, 1, 44, 33, 44 / 33, 3],
    [5, 2, 2, 38, 38, 1.0, 4],
    [2, 1, 3, 22, 49, 22 / 49, 5],
    [4, 0, 4, 11, 52, 11 / 52, 6],
  ] as const;

  for (const [idx, v, d, pm, pe, q, rang] of classement3) {
    await prisma.classement.create({
      data: {
        concoursId: concours3.id,
        equipeId: equipes3[idx].id,
        victoires: v,
        defaites: d,
        pointsMarques: pm,
        pointsEncaisses: pe,
        quotient: q,
        rang,
      },
    });
  }

  console.log(`  ✓ Concours 3 "${concours3.nom}": terminé avec classement final`);

  const concours4 = await prisma.concours.create({
    data: {
      nom: 'Tournoi Mêlée-Démêlée Test - 34 joueurs',
      lieu: 'Test Arena',
      format: FormatConcours.MELEE,
      typeEquipe: TypeEquipe.TRIPLETTE,
      modeConstitution: ModeConstitution.MELEE_DEMELEE,
      statut: 'INSCRIPTION',
      nbTerrains: 6,
      dateDebut: new Date('2026-03-01T09:00:00'),
      dateFin: new Date('2026-03-01T18:00:00'),
      params: { nbTours: 7 },
      organisateurId: organisateur.id,
    },
  });

  for (let i = 1; i <= 6; i++) {
    await prisma.terrain.create({
      data: { concoursId: concours4.id, numero: i },
    });
  }

  for (let i = 0; i < 34; i++) {
    const j = joueurs[i % joueurs.length];
    await prisma.equipe.create({
      data: {
        concoursId: concours4.id,
        numeroTirage: i + 1,
        statut: StatutEquipe.INSCRITE,
        joueurs: {
          create: [{ joueurId: j.id }],
        },
      },
    });
  }

  console.log(`  ✓ Concours 4 "${concours4.nom}": 34 joueurs inscrits (MELEE_DEMELEE)`);

  const concours5 = await prisma.concours.create({
    data: {
      nom: 'Championnat Tête-à-Tête Nice',
      lieu: 'Boulodrome Municipal Nice',
      format: FormatConcours.MELEE,
      typeEquipe: TypeEquipe.TETE_A_TETE,
      modeConstitution: ModeConstitution.MELEE,
      statut: 'EN_COURS',
      nbTerrains: 4,
      maxParticipants: 12,
      dateDebut: new Date('2026-02-22T09:00:00'),
      dateFin: new Date('2026-02-22T18:00:00'),
      params: { nbTours: 5 },
      organisateurId: organisateur.id,
    },
  });

  const terrains5 = [];
  for (let i = 1; i <= 4; i++) {
    terrains5.push(await prisma.terrain.create({
      data: { concoursId: concours5.id, numero: i },
    }));
  }

  const equipes5 = [];
  for (let i = 0; i < 12; i++) {
    const j = joueurs[16 + i];
    equipes5.push(await prisma.equipe.create({
      data: {
        concoursId: concours5.id,
        statut: StatutEquipe.PRESENTE,
        tour: 1,
        joueurs: { create: [{ joueurId: j.id }] },
      },
    }));
  }

  const tour5_1 = [[0,1,13,8],[2,3,13,6],[4,5,10,13],[6,7,13,9],[8,9,13,7],[10,11,5,13]];
  for (let idx = 0; idx < tour5_1.length; idx++) {
    const [ai,bi,sA,sB] = tour5_1[idx];
    await prisma.partie.create({
      data: {
        concoursId: concours5.id, tour: 1,
        equipeAId: equipes5[ai].id, equipeBId: equipes5[bi].id,
        terrainId: terrains5[idx % 4].id,
        scoreA: sA, scoreB: sB, statut: StatutPartie.TERMINEE, type: TypePartie.MELEE,
      },
    });
  }

  const tour5_2 = [[0,2,13,11],[4,7,6,13],[1,6,13,10],[5,11,13,8],[3,9,13,5],[8,10,9,13]];
  for (let idx = 0; idx < tour5_2.length; idx++) {
    const [ai,bi,sA,sB] = tour5_2[idx];
    await prisma.partie.create({
      data: {
        concoursId: concours5.id, tour: 2,
        equipeAId: equipes5[ai].id, equipeBId: equipes5[bi].id,
        terrainId: terrains5[idx % 4].id,
        scoreA: sA, scoreB: sB, statut: StatutPartie.TERMINEE, type: TypePartie.MELEE,
      },
    });
  }

  const tour5_3 = [[0,5,13,9],[2,1,8,13],[7,10,13,6],[11,4,11,13],[3,6,10,13],[9,8,7,13]];
  for (let idx = 0; idx < tour5_3.length; idx++) {
    const [ai,bi,sA,sB] = tour5_3[idx];
    await prisma.partie.create({
      data: {
        concoursId: concours5.id, tour: 3,
        equipeAId: equipes5[ai].id, equipeBId: equipes5[bi].id,
        terrainId: terrains5[idx % 4].id,
        scoreA: sA, scoreB: sB, statut: StatutPartie.TERMINEE, type: TypePartie.MELEE,
      },
    });
  }

  console.log(`  ✓ Concours 5 "${concours5.nom}": 12 équipes, 3 tours terminés`);

  const concours6 = await prisma.concours.create({
    data: {
      nom: 'Grand Tournoi Doublette Lyon - TERMINE',
      lieu: 'Parc de la Tête d\'Or, Lyon',
      format: FormatConcours.MELEE,
      typeEquipe: TypeEquipe.DOUBLETTE,
      modeConstitution: ModeConstitution.MELEE_DEMELEE,
      statut: 'TERMINE',
      nbTerrains: 6,
      maxParticipants: 32,
      dateDebut: new Date('2026-02-10T09:00:00'),
      dateFin: new Date('2026-02-10T18:00:00'),
      params: { nbTours: 6 },
      organisateurId: admin.id,
    },
  });

  const equipes6 = [];
  for (let i = 0; i < 16; i++) {
    equipes6.push(await prisma.equipe.create({
      data: {
        concoursId: concours6.id,
        statut: StatutEquipe.PRESENTE,
        tour: 1,
      },
    }));
  }

  const classement6Data = [
    [0,5,1,68,42], [1,5,1,66,45], [2,4,2,61,48], [3,4,2,59,50],
    [4,4,2,58,51], [5,3,3,55,53], [6,3,3,52,55], [7,3,3,50,57],
    [8,3,3,48,59], [9,2,4,45,61], [10,2,4,43,63], [11,2,4,40,65],
    [12,1,5,38,67], [13,1,5,35,69], [14,1,5,32,70], [15,0,6,28,72],
  ];

  for (let i = 0; i < equipes6.length; i++) {
    const [idx,v,d,pm,pe] = classement6Data[i];
    await prisma.classement.create({
      data: {
        concoursId: concours6.id,
        equipeId: equipes6[idx].id,
        victoires: v, defaites: d,
        pointsMarques: pm, pointsEncaisses: pe,
        quotient: pe === 0 ? pm : pm / pe,
        rang: i + 1,
      },
    });
  }

  console.log(`  ✓ Concours 6 "${concours6.nom}": 16 équipes, tournoi terminé`);

  const concours7 = await prisma.concours.create({
    data: {
      nom: 'Coupe Tête-à-Tête Marseille',
      lieu: 'Stade Vélodrome, Marseille',
      format: FormatConcours.COUPE,
      typeEquipe: TypeEquipe.TETE_A_TETE,
      modeConstitution: ModeConstitution.MONTEE,
      statut: 'INSCRIPTION',
      nbTerrains: 3,
      maxParticipants: 8,
      dateDebut: new Date('2026-03-05T09:00:00'),
      dateFin: new Date('2026-03-05T18:00:00'),
      params: { consolante: false },
      organisateurId: organisateur.id,
    },
  });

  for (let i = 1; i <= 3; i++) {
    await prisma.terrain.create({ data: { concoursId: concours7.id, numero: i } });
  }

  for (let i = 0; i < 8; i++) {
    await prisma.equipe.create({
      data: {
        concoursId: concours7.id,
        statut: StatutEquipe.INSCRITE,
        joueurs: { create: [{ joueurId: joueurs[28 + i].id }] },
      },
    });
  }

  console.log(`  ✓ Concours 7 "${concours7.nom}": 8 équipes inscrites (COUPE)`);

  const concours8 = await prisma.concours.create({
    data: {
      nom: 'Coupe Doublette Bordeaux avec Consolante',
      lieu: 'Place des Quinconces, Bordeaux',
      format: FormatConcours.COUPE,
      typeEquipe: TypeEquipe.DOUBLETTE,
      modeConstitution: ModeConstitution.MONTEE,
      statut: 'INSCRIPTION',
      nbTerrains: 4,
      maxParticipants: 16,
      dateDebut: new Date('2026-03-10T09:00:00'),
      dateFin: new Date('2026-03-10T18:00:00'),
      params: { consolante: true },
      organisateurId: organisateur.id,
    },
  });

  for (let i = 1; i <= 4; i++) {
    await prisma.terrain.create({ data: { concoursId: concours8.id, numero: i } });
  }

  for (let i = 0; i < 16; i++) {
    await prisma.equipe.create({
      data: {
        concoursId: concours8.id,
        statut: StatutEquipe.INSCRITE,
        joueurs: {
          create: [
            { joueurId: joueurs[(36 + i * 2) % joueurs.length].id },
            { joueurId: joueurs[(37 + i * 2) % joueurs.length].id },
          ],
        },
      },
    });
  }

  console.log(`  ✓ Concours 8 "${concours8.nom}": 16 équipes inscrites (COUPE avec consolante)`);

  const concours9 = await prisma.concours.create({
    data: {
      nom: 'Coupe Tête-à-Tête Paris - Quarts en Cours',
      lieu: 'Bois de Boulogne, Paris',
      format: FormatConcours.COUPE,
      typeEquipe: TypeEquipe.TETE_A_TETE,
      modeConstitution: ModeConstitution.MONTEE,
      statut: 'EN_COURS',
      nbTerrains: 3,
      maxParticipants: 8,
      dateDebut: new Date('2026-02-25T09:00:00'),
      dateFin: new Date('2026-02-25T18:00:00'),
      params: { consolante: false },
      organisateurId: admin.id,
    },
  });

  const terrains9 = [];
  for (let i = 1; i <= 3; i++) {
    terrains9.push(await prisma.terrain.create({ data: { concoursId: concours9.id, numero: i } }));
  }

  const equipes9 = [];
  for (let i = 0; i < 8; i++) {
    equipes9.push(await prisma.equipe.create({
      data: {
        concoursId: concours9.id,
        statut: StatutEquipe.PRESENTE,
        joueurs: { create: [{ joueurId: joueurs[20 + i].id }] },
      },
    }));
  }

  await prisma.partie.create({
    data: {
      concoursId: concours9.id, tour: 1, type: TypePartie.COUPE_PRINCIPALE,
      equipeAId: equipes9[0].id, equipeBId: equipes9[1].id,
      terrainId: terrains9[0].id, bracketRonde: 3, bracketPos: 0,
      scoreA: 13, scoreB: 8, statut: StatutPartie.TERMINEE,
    },
  });

  await prisma.partie.create({
    data: {
      concoursId: concours9.id, tour: 1, type: TypePartie.COUPE_PRINCIPALE,
      equipeAId: equipes9[2].id, equipeBId: equipes9[3].id,
      terrainId: terrains9[1].id, bracketRonde: 3, bracketPos: 1,
      scoreA: 11, scoreB: 13, statut: StatutPartie.TERMINEE,
    },
  });

  await prisma.partie.create({
    data: {
      concoursId: concours9.id, tour: 1, type: TypePartie.COUPE_PRINCIPALE,
      equipeAId: equipes9[4].id, equipeBId: equipes9[5].id,
      terrainId: terrains9[2].id, bracketRonde: 3, bracketPos: 2,
      scoreA: 13, scoreB: 10, statut: StatutPartie.EN_COURS,
    },
  });

  await prisma.partie.create({
    data: {
      concoursId: concours9.id, tour: 1, type: TypePartie.COUPE_PRINCIPALE,
      equipeAId: equipes9[6].id, equipeBId: equipes9[7].id,
      terrainId: terrains9[0].id, bracketRonde: 3, bracketPos: 3,
      scoreA: null, scoreB: null, statut: StatutPartie.A_JOUER,
    },
  });

  console.log(`  ✓ Concours 9 "${concours9.nom}": Quarts de finale en cours`);

  const concours10 = await prisma.concours.create({
    data: {
      nom: 'Coupe Doublette Toulouse - Demi-Finales',
      lieu: 'Complexe Sportif Toulouse',
      format: FormatConcours.COUPE,
      typeEquipe: TypeEquipe.DOUBLETTE,
      modeConstitution: ModeConstitution.MONTEE,
      statut: 'EN_COURS',
      nbTerrains: 4,
      maxParticipants: 16,
      dateDebut: new Date('2026-02-18T09:00:00'),
      dateFin: new Date('2026-02-18T18:00:00'),
      params: { consolante: true },
      organisateurId: organisateur.id,
    },
  });

  const terrains10 = [];
  for (let i = 1; i <= 4; i++) {
    terrains10.push(await prisma.terrain.create({ data: { concoursId: concours10.id, numero: i } }));
  }

  const equipes10 = [];
  for (let i = 0; i < 16; i++) {
    equipes10.push(await prisma.equipe.create({
      data: {
        concoursId: concours10.id,
        statut: StatutEquipe.PRESENTE,
        joueurs: {
          create: [
            { joueurId: joueurs[(i * 3) % joueurs.length].id },
            { joueurId: joueurs[(i * 3 + 1) % joueurs.length].id },
          ],
        },
      },
    }));
  }

  for (let i = 0; i < 8; i++) {
    await prisma.partie.create({
      data: {
        concoursId: concours10.id, tour: 1, type: TypePartie.COUPE_PRINCIPALE,
        equipeAId: equipes10[i * 2].id, equipeBId: equipes10[i * 2 + 1].id,
        terrainId: terrains10[i % 4].id, bracketRonde: 4, bracketPos: i,
        scoreA: 13, scoreB: Math.floor(Math.random() * 10) + 2,
        statut: StatutPartie.TERMINEE,
      },
    });
  }

  for (let i = 0; i < 4; i++) {
    const winner1 = equipes10[i * 4];
    const winner2 = equipes10[i * 4 + 2];
    await prisma.partie.create({
      data: {
        concoursId: concours10.id, tour: 2, type: TypePartie.COUPE_PRINCIPALE,
        equipeAId: winner1.id, equipeBId: winner2.id,
        terrainId: terrains10[i % 4].id, bracketRonde: 5, bracketPos: i,
        scoreA: i < 2 ? 13 : null, scoreB: i < 2 ? Math.floor(Math.random() * 10) + 2 : null,
        statut: i < 2 ? StatutPartie.TERMINEE : StatutPartie.A_JOUER,
      },
    });
  }

  for (let i = 0; i < 4; i++) {
    const loser1 = equipes10[i * 4 + 1];
    const loser2 = equipes10[i * 4 + 3];
    await prisma.partie.create({
      data: {
        concoursId: concours10.id, tour: 2, type: TypePartie.COUPE_CONSOLANTE,
        equipeAId: loser1.id, equipeBId: loser2.id,
        terrainId: terrains10[i % 4].id, bracketRonde: 5, bracketPos: i,
        scoreA: i < 2 ? 13 : null, scoreB: i < 2 ? Math.floor(Math.random() * 10) + 2 : null,
        statut: i < 2 ? StatutPartie.TERMINEE : StatutPartie.EN_COURS,
      },
    });
  }

  console.log(`  ✓ Concours 10 "${concours10.nom}": Demi-finales en cours (principale + consolante)`);

  const concours11 = await prisma.concours.create({
    data: {
      nom: 'Grande Coupe Triplette Montpellier',
      lieu: 'Esplanade Charles de Gaulle, Montpellier',
      format: FormatConcours.COUPE,
      typeEquipe: TypeEquipe.TRIPLETTE,
      modeConstitution: ModeConstitution.MONTEE,
      statut: 'EN_COURS',
      nbTerrains: 6,
      maxParticipants: 32,
      dateDebut: new Date('2026-03-20T09:00:00'),
      dateFin: new Date('2026-03-20T18:00:00'),
      params: { consolante: false },
      organisateurId: admin.id,
    },
  });

  const terrains11 = [];
  for (let i = 1; i <= 6; i++) {
    terrains11.push(await prisma.terrain.create({ data: { concoursId: concours11.id, numero: i } }));
  }

  const equipes11 = [];
  for (let i = 0; i < 32; i++) {
    equipes11.push(await prisma.equipe.create({
      data: {
        concoursId: concours11.id,
        statut: StatutEquipe.PRESENTE,
        joueurs: {
          create: [
            { joueurId: joueurs[(i * 2) % joueurs.length].id },
            { joueurId: joueurs[(i * 2 + 1) % joueurs.length].id },
            { joueurId: joueurs[(i * 2 + 20) % joueurs.length].id },
          ],
        },
      },
    }));
  }

  for (let i = 0; i < 16; i++) {
    await prisma.partie.create({
      data: {
        concoursId: concours11.id, tour: 1, type: TypePartie.COUPE_PRINCIPALE,
        equipeAId: equipes11[i * 2].id, equipeBId: equipes11[i * 2 + 1].id,
        terrainId: terrains11[i % 6].id, bracketRonde: 2, bracketPos: i,
        scoreA: 13, scoreB: Math.floor(Math.random() * 10) + 1,
        statut: StatutPartie.TERMINEE,
      },
    });
  }

  console.log(`  ✓ Concours 11 "${concours11.nom}": 32 équipes, 16èmes terminés`);

  const concours12 = await prisma.concours.create({
    data: {
      nom: 'Coupe d\'Hiver Doublette Nice - TERMINE',
      lieu: 'Promenade des Anglais, Nice',
      format: FormatConcours.COUPE,
      typeEquipe: TypeEquipe.DOUBLETTE,
      modeConstitution: ModeConstitution.MONTEE,
      statut: 'TERMINE',
      nbTerrains: 3,
      maxParticipants: 8,
      dateDebut: new Date('2026-02-05T09:00:00'),
      dateFin: new Date('2026-02-05T18:00:00'),
      params: { consolante: true },
      organisateurId: organisateur.id,
    },
  });

  const terrains12 = [];
  for (let i = 1; i <= 3; i++) {
    terrains12.push(await prisma.terrain.create({ data: { concoursId: concours12.id, numero: i } }));
  }

  const equipes12 = [];
  for (let i = 0; i < 8; i++) {
    equipes12.push(await prisma.equipe.create({
      data: {
        concoursId: concours12.id,
        statut: StatutEquipe.PRESENTE,
        joueurs: {
          create: [
            { joueurId: joueurs[(40 + i * 2) % joueurs.length].id },
            { joueurId: joueurs[(41 + i * 2) % joueurs.length].id },
          ],
        },
      },
    }));
  }

  for (let i = 0; i < 4; i++) {
    await prisma.partie.create({
      data: {
        concoursId: concours12.id, tour: 1, type: TypePartie.COUPE_PRINCIPALE,
        equipeAId: equipes12[i * 2].id, equipeBId: equipes12[i * 2 + 1].id,
        terrainId: terrains12[i % 3].id, bracketRonde: 3, bracketPos: i,
        scoreA: 13, scoreB: Math.floor(Math.random() * 10) + 3,
        statut: StatutPartie.TERMINEE,
      },
    });
  }

  for (let i = 0; i < 2; i++) {
    await prisma.partie.create({
      data: {
        concoursId: concours12.id, tour: 2, type: TypePartie.COUPE_PRINCIPALE,
        equipeAId: equipes12[i * 4].id, equipeBId: equipes12[i * 4 + 2].id,
        terrainId: terrains12[i].id, bracketRonde: 4, bracketPos: i,
        scoreA: 13, scoreB: Math.floor(Math.random() * 10) + 4,
        statut: StatutPartie.TERMINEE,
      },
    });
  }

  await prisma.partie.create({
    data: {
      concoursId: concours12.id, tour: 3, type: TypePartie.COUPE_PRINCIPALE,
      equipeAId: equipes12[0].id, equipeBId: equipes12[4].id,
      terrainId: terrains12[0].id, bracketRonde: 5, bracketPos: 0,
      scoreA: 13, scoreB: 11, statut: StatutPartie.TERMINEE,
    },
  });

  for (let i = 0; i < 2; i++) {
    await prisma.partie.create({
      data: {
        concoursId: concours12.id, tour: 2, type: TypePartie.COUPE_CONSOLANTE,
        equipeAId: equipes12[i * 4 + 1].id, equipeBId: equipes12[i * 4 + 3].id,
        terrainId: terrains12[i].id, bracketRonde: 4, bracketPos: i,
        scoreA: 13, scoreB: Math.floor(Math.random() * 10) + 2,
        statut: StatutPartie.TERMINEE,
      },
    });
  }

  await prisma.partie.create({
    data: {
      concoursId: concours12.id, tour: 3, type: TypePartie.COUPE_CONSOLANTE,
      equipeAId: equipes12[1].id, equipeBId: equipes12[5].id,
      terrainId: terrains12[1].id, bracketRonde: 5, bracketPos: 0,
      scoreA: 13, scoreB: 9, statut: StatutPartie.TERMINEE,
    },
  });

  console.log(`  ✓ Concours 12 "${concours12.nom}": Coupe terminée (principale + consolante)`);

  const concours13 = await prisma.concours.create({
    data: {
      nom: 'Championnat Triplette Strasbourg',
      lieu: 'Parc de l\'Orangerie, Strasbourg',
      format: FormatConcours.CHAMPIONNAT,
      typeEquipe: TypeEquipe.TRIPLETTE,
      modeConstitution: ModeConstitution.MONTEE,
      statut: 'INSCRIPTION',
      nbTerrains: 4,
      maxParticipants: 12,
      dateDebut: new Date('2026-04-01T09:00:00'),
      dateFin: new Date('2026-04-01T18:00:00'),
      params: { taillePoule: 4 },
      organisateurId: organisateur.id,
    },
  });

  for (let i = 1; i <= 4; i++) {
    await prisma.terrain.create({ data: { concoursId: concours13.id, numero: i } });
  }

  for (let i = 0; i < 12; i++) {
    await prisma.equipe.create({
      data: {
        concoursId: concours13.id,
        statut: StatutEquipe.INSCRITE,
        joueurs: {
          create: [
            { joueurId: joueurs[(10 + i * 3) % joueurs.length].id },
            { joueurId: joueurs[(11 + i * 3) % joueurs.length].id },
            { joueurId: joueurs[(12 + i * 3) % joueurs.length].id },
          ],
        },
      },
    });
  }

  console.log(`  ✓ Concours 13 "${concours13.nom}": 12 équipes inscrites (CHAMPIONNAT)`);

  const concours14 = await prisma.concours.create({
    data: {
      nom: 'Championnat Doublette Lille - Poules en Cours',
      lieu: 'Citadelle de Lille',
      format: FormatConcours.CHAMPIONNAT,
      typeEquipe: TypeEquipe.DOUBLETTE,
      modeConstitution: ModeConstitution.MONTEE,
      statut: 'EN_COURS',
      nbTerrains: 3,
      maxParticipants: 8,
      dateDebut: new Date('2026-03-12T09:00:00'),
      dateFin: new Date('2026-03-12T18:00:00'),
      params: { taillePoule: 4 },
      organisateurId: admin.id,
    },
  });

  const terrains14 = [];
  for (let i = 1; i <= 3; i++) {
    terrains14.push(await prisma.terrain.create({ data: { concoursId: concours14.id, numero: i } }));
  }

  const equipes14 = [];
  for (let i = 0; i < 8; i++) {
    equipes14.push(await prisma.equipe.create({
      data: {
        concoursId: concours14.id,
        statut: StatutEquipe.PRESENTE,
        joueurs: {
          create: [
            { joueurId: joueurs[(30 + i * 2) % joueurs.length].id },
            { joueurId: joueurs[(31 + i * 2) % joueurs.length].id },
          ],
        },
      },
    }));
  }

  for (let p = 0; p < 2; p++) {
    const poule = await prisma.poule.create({
      data: { concoursId: concours14.id, numero: p + 1, statut: 'EN_COURS' },
    });

    for (let t = 0; t < 4; t++) {
      await prisma.pouleEquipe.create({
        data: { pouleId: poule.id, equipeId: equipes14[p * 4 + t].id },
      });
    }

    const poolTeams = equipes14.slice(p * 4, (p + 1) * 4);
    let matchIdx = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        await prisma.partie.create({
          data: {
            concoursId: concours14.id, pouleId: poule.id, tour: 1,
            equipeAId: poolTeams[i].id, equipeBId: poolTeams[j].id,
            terrainId: terrains14[matchIdx % 3].id,
            type: TypePartie.CHAMPIONNAT_POULE,
            statut: matchIdx < 3 ? StatutPartie.TERMINEE : StatutPartie.EN_COURS,
            scoreA: matchIdx < 3 ? 13 : null,
            scoreB: matchIdx < 3 ? Math.floor(Math.random() * 10) + 2 : null,
          },
        });
        matchIdx++;
      }
    }
  }

  console.log(`  ✓ Concours 14 "${concours14.nom}": Poules en cours (50% terminé)`);

  const concours15 = await prisma.concours.create({
    data: {
      nom: 'Championnat Triplette Nantes - Poules Terminées',
      lieu: 'Parc du Grand Blottereau, Nantes',
      format: FormatConcours.CHAMPIONNAT,
      typeEquipe: TypeEquipe.TRIPLETTE,
      modeConstitution: ModeConstitution.MONTEE,
      statut: 'EN_COURS',
      nbTerrains: 3,
      maxParticipants: 12,
      dateDebut: new Date('2026-03-18T09:00:00'),
      dateFin: new Date('2026-03-18T18:00:00'),
      params: { taillePoule: 4 },
      organisateurId: organisateur.id,
    },
  });

  const terrains15 = [];
  for (let i = 1; i <= 3; i++) {
    terrains15.push(await prisma.terrain.create({ data: { concoursId: concours15.id, numero: i } }));
  }

  const equipes15 = [];
  for (let i = 0; i < 12; i++) {
    equipes15.push(await prisma.equipe.create({
      data: {
        concoursId: concours15.id,
        statut: StatutEquipe.PRESENTE,
        joueurs: {
          create: [
            { joueurId: joueurs[(15 + i * 3) % joueurs.length].id },
            { joueurId: joueurs[(16 + i * 3) % joueurs.length].id },
            { joueurId: joueurs[(17 + i * 3) % joueurs.length].id },
          ],
        },
      },
    }));
  }

  for (let p = 0; p < 3; p++) {
    const poule = await prisma.poule.create({
      data: { concoursId: concours15.id, numero: p + 1, statut: 'TERMINE' },
    });

    for (let t = 0; t < 4; t++) {
      await prisma.pouleEquipe.create({
        data: { pouleId: poule.id, equipeId: equipes15[p * 4 + t].id },
      });
    }

    const poolTeams = equipes15.slice(p * 4, (p + 1) * 4);
    let matchIdx = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        await prisma.partie.create({
          data: {
            concoursId: concours15.id, pouleId: poule.id, tour: 1,
            equipeAId: poolTeams[i].id, equipeBId: poolTeams[j].id,
            terrainId: terrains15[matchIdx % 3].id,
            type: TypePartie.CHAMPIONNAT_POULE,
            statut: StatutPartie.TERMINEE,
            scoreA: 13, scoreB: Math.floor(Math.random() * 10) + 1,
          },
        });
        matchIdx++;
      }
    }
  }

  console.log(`  ✓ Concours 15 "${concours15.nom}": Toutes les poules terminées (prêt pour phase finale)`);

  const concours16 = await prisma.concours.create({
    data: {
      nom: 'Championnat Triplette Aix - Phase Finale',
      lieu: 'Cours Mirabeau, Aix-en-Provence',
      format: FormatConcours.CHAMPIONNAT,
      typeEquipe: TypeEquipe.TRIPLETTE,
      modeConstitution: ModeConstitution.MONTEE,
      statut: 'EN_COURS',
      nbTerrains: 2,
      maxParticipants: 8,
      dateDebut: new Date('2026-02-28T09:00:00'),
      dateFin: new Date('2026-02-28T18:00:00'),
      params: { taillePoule: 4 },
      organisateurId: admin.id,
    },
  });

  const terrains16 = [];
  for (let i = 1; i <= 2; i++) {
    terrains16.push(await prisma.terrain.create({ data: { concoursId: concours16.id, numero: i } }));
  }

  const equipes16 = [];
  for (let i = 0; i < 8; i++) {
    equipes16.push(await prisma.equipe.create({
      data: {
        concoursId: concours16.id,
        statut: StatutEquipe.PRESENTE,
        joueurs: {
          create: [
            { joueurId: joueurs[(25 + i * 3) % joueurs.length].id },
            { joueurId: joueurs[(26 + i * 3) % joueurs.length].id },
            { joueurId: joueurs[(27 + i * 3) % joueurs.length].id },
          ],
        },
      },
    }));
  }

  for (let p = 0; p < 2; p++) {
    const poule = await prisma.poule.create({
      data: { concoursId: concours16.id, numero: p + 1, statut: 'TERMINE' },
    });

    for (let t = 0; t < 4; t++) {
      await prisma.pouleEquipe.create({
        data: { pouleId: poule.id, equipeId: equipes16[p * 4 + t].id },
      });
    }

    const poolTeams = equipes16.slice(p * 4, (p + 1) * 4);
    let matchIdx = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        await prisma.partie.create({
          data: {
            concoursId: concours16.id, pouleId: poule.id, tour: 1,
            equipeAId: poolTeams[i].id, equipeBId: poolTeams[j].id,
            terrainId: terrains16[matchIdx % 2].id,
            type: TypePartie.CHAMPIONNAT_POULE,
            statut: StatutPartie.TERMINEE,
            scoreA: 13, scoreB: Math.floor(Math.random() * 10) + 2,
          },
        });
        matchIdx++;
      }
    }
  }

  const qualifiedTeams = [equipes16[0], equipes16[1], equipes16[4], equipes16[5]];

  await prisma.partie.create({
    data: {
      concoursId: concours16.id, tour: 2, type: TypePartie.CHAMPIONNAT_FINALE,
      equipeAId: qualifiedTeams[0].id, equipeBId: qualifiedTeams[3].id,
      terrainId: terrains16[0].id, bracketRonde: 5, bracketPos: 0,
      scoreA: 13, scoreB: 9, statut: StatutPartie.TERMINEE,
    },
  });

  await prisma.partie.create({
    data: {
      concoursId: concours16.id, tour: 2, type: TypePartie.CHAMPIONNAT_FINALE,
      equipeAId: qualifiedTeams[1].id, equipeBId: qualifiedTeams[2].id,
      terrainId: terrains16[1].id, bracketRonde: 5, bracketPos: 1,
      scoreA: null, scoreB: null, statut: StatutPartie.EN_COURS,
    },
  });

  console.log(`  ✓ Concours 16 "${concours16.nom}": Phase finale en cours (demi-finales)`);

  console.log('\n✅ Seed terminé avec 16 tournois de test\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  📊 RÉSUMÉ DES TOURNOIS CRÉÉS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('  🎯 MELEE (6 tournois):');
  console.log('     1. Grand Prix Marseille - EN_COURS (Doublette, tour 2/5)');
  console.log('     2. Tournoi Printemps - INSCRIPTION (Triplette, 3 équipes)');
  console.log('     3. Coupe Saint-Valentin - TERMINE (Doublette, classement final)');
  console.log('     4. Mêlée-Démêlée Test - INSCRIPTION (Triplette, 34 joueurs)');
  console.log('     5. Championnat Nice - EN_COURS (Tête-à-tête, tour 3/5)');
  console.log('     6. Grand Tournoi Lyon - TERMINE (Doublette, 16 équipes)\n');
  console.log('  🏆 COUPE (6 tournois):');
  console.log('     7. Coupe Marseille - INSCRIPTION (Tête-à-tête, 8 équipes)');
  console.log('     8. Coupe Bordeaux - INSCRIPTION (Doublette, 16 équipes + consolante)');
  console.log('     9. Coupe Paris - EN_COURS (Tête-à-tête, quarts de finale)');
  console.log('    10. Coupe Toulouse - EN_COURS (Doublette, demi-finales + consolante)');
  console.log('    11. Grande Coupe Montpellier - EN_COURS (Triplette, 32 équipes, 16èmes)');
  console.log('    12. Coupe d\'Hiver Nice - TERMINE (Doublette + consolante)\n');
  console.log('  🥇 CHAMPIONNAT (4 tournois):');
  console.log('    13. Championnat Strasbourg - INSCRIPTION (Triplette, 12 équipes)');
  console.log('    14. Championnat Lille - EN_COURS (Doublette, poules 50%)');
  console.log('    15. Championnat Nantes - EN_COURS (Triplette, poules terminées)');
  console.log('    16. Championnat Aix - EN_COURS (Triplette, phase finale)\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🔑 COMPTES DE TEST');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Super-admin  : admin@petanque.fr   / admin1234');
  console.log('  Organisateur : orga@petanque.fr    / orga1234');
  console.log('  Arbitre      : arbitre@petanque.fr / arb1234');
  console.log('  Joueurs (56) : <prenom.nom>@petanque.fr / joueur1234');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
