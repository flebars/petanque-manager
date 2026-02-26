import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class PdfService {
  constructor(private prisma: PrismaService) {}

  async genererFeuilleMatch(partieId: string): Promise<Buffer> {
    const partie = await this.prisma.partie.findUnique({
      where: { id: partieId },
      include: {
        equipeA: { include: { joueurs: { include: { joueur: true } } } },
        equipeB: { include: { joueurs: { include: { joueur: true } } } },
        terrain: true,
        concours: true,
      },
    });

    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text(`Feuille de Match`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(partie?.concours.nom ?? '', { align: 'center' });
      doc.moveDown();

      if (partie?.terrain) {
        doc.fontSize(12).text(`Terrain n°${partie.terrain.numero}`, { align: 'center' });
      }
      doc.moveDown(2);

      const nomEquipe = (joueurs: Array<{ joueur: { nom: string; prenom: string } }>): string =>
        joueurs.map((j) => `${j.joueur.prenom} ${j.joueur.nom}`).join(', ');

      doc.fontSize(14).text('Équipe A', { continued: false });
      doc.fontSize(12).text(nomEquipe(partie?.equipeA.joueurs ?? []));
      doc.moveDown();

      doc.fontSize(14).text('Équipe B', { continued: false });
      doc.fontSize(12).text(nomEquipe(partie?.equipeB.joueurs ?? []));
      doc.moveDown(2);

      doc.fontSize(16).text('Score:', { continued: true });
      doc.text('  ______  —  ______');
      doc.moveDown(3);

      doc.fontSize(11).text('Signature Équipe A: _______________________');
      doc.moveDown();
      doc.fontSize(11).text('Signature Équipe B: _______________________');

      doc.end();
    });
  }

  async genererClassement(concoursId: string): Promise<Buffer> {
    const concours = await this.prisma.concours.findUnique({ where: { id: concoursId } });
    const classements = await this.prisma.classement.findMany({
      where: { concoursId },
      include: { equipe: { include: { joueurs: { include: { joueur: true } } } } },
      orderBy: [{ rang: 'asc' }],
    });

    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text(`Classement Final`, { align: 'center' });
      doc.fontSize(14).text(concours?.nom ?? '', { align: 'center' });
      doc.moveDown(2);

      const colX = [50, 90, 300, 380, 460];
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Rang', colX[0], doc.y, { continued: false, width: 40 });
      doc.text('Équipe', colX[1], doc.y - doc.currentLineHeight(), { width: 200 });
      doc.text('V', colX[2], doc.y - doc.currentLineHeight(), { width: 50 });
      doc.text('Pts+', colX[3], doc.y - doc.currentLineHeight(), { width: 50 });
      doc.text('Quotient', colX[4], doc.y - doc.currentLineHeight(), { width: 80 });
      doc.moveDown();
      doc.font('Helvetica');

      for (const cl of classements) {
        const nom = cl.equipe.joueurs
          .map((j) => `${j.joueur.nom}`)
          .join('/');
        const y = doc.y;
        doc.text(`${cl.rang}`, colX[0], y, { width: 40 });
        doc.text(nom, colX[1], y, { width: 200 });
        doc.text(`${cl.victoires}`, colX[2], y, { width: 50 });
        doc.text(`${cl.pointsMarques}`, colX[3], y, { width: 50 });
        doc.text(`${cl.quotient.toFixed(2)}`, colX[4], y, { width: 80 });
        doc.moveDown(0.5);
      }

      doc.end();
    });
  }

  async genererFichesPartie(
    concoursId: string,
    options: { tour?: number; pouleId?: string; bracketRonde?: number; type?: string },
  ): Promise<Buffer> {
    const whereClause: any = { concoursId };

    if (options.tour !== undefined) {
      whereClause.tour = options.tour;
      whereClause.type = 'MELEE';
    } else if (options.pouleId) {
      whereClause.pouleId = options.pouleId;
      whereClause.type = 'CHAMPIONNAT_POULE';
    } else if (options.bracketRonde !== undefined) {
      whereClause.bracketRonde = options.bracketRonde;
      if (options.type === 'consolante') {
        whereClause.type = 'COUPE_CONSOLANTE';
      } else {
        whereClause.type = { in: ['COUPE_PRINCIPALE', 'CHAMPIONNAT_FINALE'] };
      }
    }

    const parties = await this.prisma.partie.findMany({
      where: whereClause,
      include: {
        equipeA: { include: { joueurs: { include: { joueur: true } } } },
        equipeB: { include: { joueurs: { include: { joueur: true } } } },
        terrain: true,
        poule: true,
      },
      orderBy: [{ terrainId: 'asc' }, { tour: 'asc' }, { bracketRonde: 'asc' }],
    });

    const nomEquipe = (joueurs: Array<{ joueur: { nom: string; prenom: string } }>): string =>
      joueurs.map((j) => `${j.joueur.prenom} ${j.joueur.nom}`).join(' / ');

    const getContextLabel = (partie: any): string => {
      if (partie.tour !== null && partie.tour !== undefined) {
        return `Tour ${partie.tour}`;
      }
      if (partie.poule) {
        return `Poule ${partie.poule.nom}`;
      }
      if (partie.bracketRonde !== null && partie.bracketRonde !== undefined) {
        const rondeLabels: Record<number, string> = {
          1: 'Finale',
          2: 'Demi-finale',
          4: 'Quart de finale',
          8: 'Huitième de finale',
          16: 'Seizième de finale',
          32: '1/32e de finale',
        };
        const label = rondeLabels[partie.bracketRonde] || `Ronde ${partie.bracketRonde}`;
        return partie.type === 'COUPE_CONSOLANTE' ? `${label} (Consolante)` : label;
      }
      return 'Partie';
    };

    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 30 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 30;
      const usableWidth = pageWidth - 2 * margin;
      const usableHeight = pageHeight - 2 * margin;

      const sheetsPerRow = 2;
      const rowsPerPage = 5;
      const sheetsPerPage = sheetsPerRow * rowsPerPage;

      const sheetWidth = usableWidth / sheetsPerRow;
      const sheetHeight = usableHeight / rowsPerPage;

      let sheetCount = 0;

      for (const partie of parties) {
        if (partie.equipeAId === partie.equipeBId) {
          continue;
        }

        if (sheetCount > 0 && sheetCount % sheetsPerPage === 0) {
          doc.addPage();
        }

        const posInPage = sheetCount % sheetsPerPage;
        const col = posInPage % sheetsPerRow;
        const row = Math.floor(posInPage / sheetsPerRow);

        const x = margin + col * sheetWidth;
        const y = margin + row * sheetHeight;

        const padding = 8;
        const innerX = x + padding;
        const innerY = y + padding;
        const innerWidth = sheetWidth - 2 * padding;

        doc.rect(x, y, sheetWidth, sheetHeight).stroke();

        doc.font('Helvetica-Bold').fontSize(11);
        const contextLabel = getContextLabel(partie);
        const terrainLabel = partie.terrain ? `Terrain ${partie.terrain.numero}` : 'Terrain à définir';
        doc.text(`${contextLabel} - ${terrainLabel}`, innerX, innerY, {
          width: innerWidth,
          align: 'center',
        });

        doc.moveDown(0.8);
        let currentY = doc.y;

        const scoreBoxWidth = 40;
        const scoreBoxHeight = 24;
        const teamLabelWidth = innerWidth - scoreBoxWidth - 8;
        const lineHeight = 28;

        doc.font('Helvetica').fontSize(9);
        doc.text('Équipe A:', innerX, currentY, { continued: false, width: teamLabelWidth });
        
        doc.font('Helvetica-Bold').fontSize(10);
        const nomA = nomEquipe(partie.equipeA.joueurs);
        doc.text(nomA, innerX + 50, currentY, { width: teamLabelWidth - 50, lineBreak: false });
        
        doc.rect(innerX + innerWidth - scoreBoxWidth, currentY - 2, scoreBoxWidth, scoreBoxHeight).stroke();

        currentY += lineHeight;

        doc.font('Helvetica').fontSize(9);
        doc.text('Équipe B:', innerX, currentY, { continued: false, width: teamLabelWidth });
        
        doc.font('Helvetica-Bold').fontSize(10);
        const nomB = nomEquipe(partie.equipeB.joueurs);
        doc.text(nomB, innerX + 50, currentY, { width: teamLabelWidth - 50, lineBreak: false });
        
        doc.rect(innerX + innerWidth - scoreBoxWidth, currentY - 2, scoreBoxWidth, scoreBoxHeight).stroke();

        sheetCount++;
      }

      if (sheetCount === 0) {
        doc.fontSize(14).text('Aucune partie à afficher', { align: 'center' });
      }

      doc.end();
    });
  }
}
