-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ORGANISATEUR', 'ARBITRE', 'CAPITAINE', 'SPECTATEUR');

-- CreateEnum
CREATE TYPE "Genre" AS ENUM ('H', 'F');

-- CreateEnum
CREATE TYPE "Categorie" AS ENUM ('SENIOR', 'VETERAN', 'FEMININ', 'JEUNE');

-- CreateEnum
CREATE TYPE "FormatConcours" AS ENUM ('MELEE', 'COUPE', 'CHAMPIONNAT');

-- CreateEnum
CREATE TYPE "TypeEquipe" AS ENUM ('TETE_A_TETE', 'DOUBLETTE', 'TRIPLETTE');

-- CreateEnum
CREATE TYPE "ModeConstitution" AS ENUM ('MELEE_DEMELEE', 'MELEE', 'MONTEE');

-- CreateEnum
CREATE TYPE "StatutConcours" AS ENUM ('INSCRIPTION', 'EN_COURS', 'TERMINE');

-- CreateEnum
CREATE TYPE "StatutEquipe" AS ENUM ('INSCRITE', 'PRESENTE', 'FORFAIT', 'DISQUALIFIEE');

-- CreateEnum
CREATE TYPE "StatutPartie" AS ENUM ('A_JOUER', 'EN_COURS', 'TERMINEE', 'LITIGE', 'FORFAIT');

-- CreateEnum
CREATE TYPE "TypePartie" AS ENUM ('MELEE', 'COUPE_PRINCIPALE', 'COUPE_CONSOLANTE', 'CHAMPIONNAT_POULE', 'CHAMPIONNAT_FINALE');

-- CreateTable
CREATE TABLE "joueurs" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "genre" "Genre" NOT NULL,
    "dateNaissance" TIMESTAMP(3),
    "licenceFfpjp" TEXT,
    "club" TEXT,
    "categorie" "Categorie" NOT NULL DEFAULT 'SENIOR',
    "role" "Role" NOT NULL DEFAULT 'SPECTATEUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joueurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concours" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "lieu" TEXT,
    "format" "FormatConcours" NOT NULL,
    "typeEquipe" "TypeEquipe" NOT NULL,
    "modeConstitution" "ModeConstitution" NOT NULL,
    "statut" "StatutConcours" NOT NULL DEFAULT 'INSCRIPTION',
    "nbTerrains" INTEGER NOT NULL,
    "maxParticipants" INTEGER,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "organisateurId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terrains" (
    "id" TEXT NOT NULL,
    "concoursId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "emplacement" TEXT,

    CONSTRAINT "terrains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipes" (
    "id" TEXT NOT NULL,
    "concoursId" TEXT NOT NULL,
    "nom" TEXT,
    "numeroTirage" INTEGER,
    "tour" INTEGER,
    "statut" "StatutEquipe" NOT NULL DEFAULT 'INSCRITE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipe_joueurs" (
    "equipeId" TEXT NOT NULL,
    "joueurId" TEXT NOT NULL,

    CONSTRAINT "equipe_joueurs_pkey" PRIMARY KEY ("equipeId","joueurId")
);

-- CreateTable
CREATE TABLE "poules" (
    "id" TEXT NOT NULL,
    "concoursId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',

    CONSTRAINT "poules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poule_equipes" (
    "pouleId" TEXT NOT NULL,
    "equipeId" TEXT NOT NULL,

    CONSTRAINT "poule_equipes_pkey" PRIMARY KEY ("pouleId","equipeId")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL,
    "concoursId" TEXT NOT NULL,
    "tour" INTEGER,
    "pouleId" TEXT,
    "equipeAId" TEXT NOT NULL,
    "equipeBId" TEXT NOT NULL,
    "terrainId" TEXT,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "statut" "StatutPartie" NOT NULL DEFAULT 'A_JOUER',
    "type" "TypePartie" NOT NULL,
    "bracketRonde" INTEGER,
    "bracketPos" INTEGER,
    "heureDebut" TIMESTAMP(3),
    "heureFinEst" TIMESTAMP(3),
    "heureFin" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classements" (
    "id" TEXT NOT NULL,
    "concoursId" TEXT NOT NULL,
    "equipeId" TEXT NOT NULL,
    "victoires" INTEGER NOT NULL DEFAULT 0,
    "defaites" INTEGER NOT NULL DEFAULT 0,
    "pointsMarques" INTEGER NOT NULL DEFAULT 0,
    "pointsEncaisses" INTEGER NOT NULL DEFAULT 0,
    "quotient" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rang" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classements_joueurs" (
    "id" TEXT NOT NULL,
    "concoursId" TEXT NOT NULL,
    "joueurId" TEXT NOT NULL,
    "victoires" INTEGER NOT NULL DEFAULT 0,
    "defaites" INTEGER NOT NULL DEFAULT 0,
    "pointsMarques" INTEGER NOT NULL DEFAULT 0,
    "pointsEncaisses" INTEGER NOT NULL DEFAULT 0,
    "quotient" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rang" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classements_joueurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tirages_log" (
    "id" TEXT NOT NULL,
    "concoursId" TEXT NOT NULL,
    "tour" INTEGER,
    "seed" TEXT NOT NULL,
    "contraintes" JSONB NOT NULL,
    "appariements" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tirages_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "joueurs_email_key" ON "joueurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "terrains_concoursId_numero_key" ON "terrains"("concoursId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "poules_concoursId_numero_key" ON "poules"("concoursId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "parties_concoursId_tour_equipeAId_equipeBId_key" ON "parties"("concoursId", "tour", "equipeAId", "equipeBId");

-- CreateIndex
CREATE UNIQUE INDEX "classements_concoursId_equipeId_key" ON "classements"("concoursId", "equipeId");

-- CreateIndex
CREATE UNIQUE INDEX "classements_joueurs_concoursId_joueurId_key" ON "classements_joueurs"("concoursId", "joueurId");

-- AddForeignKey
ALTER TABLE "concours" ADD CONSTRAINT "concours_organisateurId_fkey" FOREIGN KEY ("organisateurId") REFERENCES "joueurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terrains" ADD CONSTRAINT "terrains_concoursId_fkey" FOREIGN KEY ("concoursId") REFERENCES "concours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_concoursId_fkey" FOREIGN KEY ("concoursId") REFERENCES "concours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipe_joueurs" ADD CONSTRAINT "equipe_joueurs_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "equipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipe_joueurs" ADD CONSTRAINT "equipe_joueurs_joueurId_fkey" FOREIGN KEY ("joueurId") REFERENCES "joueurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poules" ADD CONSTRAINT "poules_concoursId_fkey" FOREIGN KEY ("concoursId") REFERENCES "concours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poule_equipes" ADD CONSTRAINT "poule_equipes_pouleId_fkey" FOREIGN KEY ("pouleId") REFERENCES "poules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poule_equipes" ADD CONSTRAINT "poule_equipes_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_concoursId_fkey" FOREIGN KEY ("concoursId") REFERENCES "concours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_pouleId_fkey" FOREIGN KEY ("pouleId") REFERENCES "poules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_equipeAId_fkey" FOREIGN KEY ("equipeAId") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_equipeBId_fkey" FOREIGN KEY ("equipeBId") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_terrainId_fkey" FOREIGN KEY ("terrainId") REFERENCES "terrains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classements" ADD CONSTRAINT "classements_concoursId_fkey" FOREIGN KEY ("concoursId") REFERENCES "concours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classements" ADD CONSTRAINT "classements_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classements_joueurs" ADD CONSTRAINT "classements_joueurs_concoursId_fkey" FOREIGN KEY ("concoursId") REFERENCES "concours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classements_joueurs" ADD CONSTRAINT "classements_joueurs_joueurId_fkey" FOREIGN KEY ("joueurId") REFERENCES "joueurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tirages_log" ADD CONSTRAINT "tirages_log_concoursId_fkey" FOREIGN KEY ("concoursId") REFERENCES "concours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
