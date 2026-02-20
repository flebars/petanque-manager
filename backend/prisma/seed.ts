import 'dotenv/config';
import { PrismaClient, Role, Genre, Categorie, FormatConcours, TypeEquipe, ModeConstitution, StatutEquipe, StatutPartie, TypePartie } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main(): Promise<void> {
  console.log('Seeding database...');

  // ─── Super-admin ─────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin1234', 10);
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
  console.log(`  ✓ Super-admin: ${admin.email} / admin1234`);

  // ─── Organisateur ────────────────────────────────────────────────────────
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

  // ─── Arbitre ─────────────────────────────────────────────────────────────
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

  // ─── 16 joueurs pour les doublettes ──────────────────────────────────────
  const joueurData = [
    { prenom: 'Pierre', nom: 'Leblanc', genre: Genre.H, club: 'Marseille PC', categorie: Categorie.SENIOR },
    { prenom: 'Sophie', nom: 'Morel', genre: Genre.F, club: 'Marseille PC', categorie: Categorie.FEMININ },
    { prenom: 'Marc', nom: 'Garnier', genre: Genre.H, club: 'Toulon Boules', categorie: Categorie.SENIOR },
    { prenom: 'Isabelle', nom: 'Petit', genre: Genre.F, club: 'Toulon Boules', categorie: Categorie.FEMININ },
    { prenom: 'Thomas', nom: 'Roux', genre: Genre.H, club: 'Nice Pétanque', categorie: Categorie.SENIOR },
    { prenom: 'Nathalie', nom: 'Fournier', genre: Genre.F, club: 'Nice Pétanque', categorie: Categorie.SENIOR },
    { prenom: 'Antoine', nom: 'Girard', genre: Genre.H, club: 'Aix Boules', categorie: Categorie.VETERAN },
    { prenom: 'Marie', nom: 'Bonnet', genre: Genre.F, club: 'Aix Boules', categorie: Categorie.VETERAN },
    { prenom: 'Christophe', nom: 'Lemaire', genre: Genre.H, club: 'Lyon Pétanque', categorie: Categorie.SENIOR },
    { prenom: 'Véronique', nom: 'Simon', genre: Genre.F, club: 'Lyon Pétanque', categorie: Categorie.SENIOR },
    { prenom: 'David', nom: 'Laurent', genre: Genre.H, club: 'Bordeaux PC', categorie: Categorie.SENIOR },
    { prenom: 'Céline', nom: 'Michel', genre: Genre.F, club: 'Bordeaux PC', categorie: Categorie.FEMININ },
    { prenom: 'Franck', nom: 'Leroy', genre: Genre.H, club: 'Paris Pétanque', categorie: Categorie.SENIOR },
    { prenom: 'Sandrine', nom: 'Marchand', genre: Genre.F, club: 'Paris Pétanque', categorie: Categorie.SENIOR },
    { prenom: 'Nicolas', nom: 'Bertrand', genre: Genre.H, club: 'Montpellier BC', categorie: Categorie.JEUNE },
    { prenom: 'Émilie', nom: 'Gros', genre: Genre.F, club: 'Montpellier BC', categorie: Categorie.JEUNE },
  ];

  const joueurs = [];
  for (let i = 0; i < joueurData.length; i++) {
    const d = joueurData[i];
    const email = `${d.prenom.toLowerCase().replace(/[éè]/g, 'e')}.${d.nom.toLowerCase()}@petanque.fr`;
    const hash = await bcrypt.hash('joueur1234', 10);
    const j = await prisma.joueur.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: hash,
        nom: d.nom,
        prenom: d.prenom,
        genre: d.genre,
        categorie: d.categorie,
        club: d.club,
        role: Role.CAPITAINE,
        licenceFfpjp: `FFPJP-${String(100 + i).padStart(6, '0')}`,
      },
    });
    joueurs.push(j);
  }
  console.log(`  ✓ ${joueurs.length} joueurs créés (mot de passe: joueur1234)`);

  // ─── Concours 1 : EN COURS (Mêlée Doublette, tour 2 en cours) ────────────
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

  // Terrains
  const terrains1 = [];
  for (let i = 1; i <= 4; i++) {
    const t = await prisma.terrain.create({
      data: { concoursId: concours1.id, numero: i, emplacement: `Allée ${i}` },
    });
    terrains1.push(t);
  }

  // 8 équipes doublette
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

  // Tour 1 – 4 parties toutes TERMINEE
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

  // Tour 2 – 4 parties : 2 TERMINEE, 1 EN_COURS, 1 A_JOUER
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

  // Classements après tour 1
  const classmentsData = [
    // equipeIdx, victoires, defaites, pointsMarques, pointsEncaisses, quotient, rang
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

  // ─── Concours 2 : INSCRIPTION (Mêlée Triplette) ──────────────────────────
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

  // 3 équipes inscrites (pour démontrer la liste d'inscriptions)
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

  console.log(`  ✓ Concours 2 "${concours2.nom}": 3 équipes inscrites (en attente de démarrage)`);

  // ─── Concours 3 : TERMINE ────────────────────────────────────────────────
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

  console.log('\n✅ Seed terminé.\n');
  console.log('─────────────────────────────────────────────');
  console.log('  Comptes de test :');
  console.log('  Super-admin  : admin@petanque.fr   / admin1234');
  console.log('  Organisateur : orga@petanque.fr    / orga1234');
  console.log('  Arbitre      : arbitre@petanque.fr / arb1234');
  console.log('  Joueurs      : <prenom.nom>@petanque.fr / joueur1234');
  console.log('─────────────────────────────────────────────\n');
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
