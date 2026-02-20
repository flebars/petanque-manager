import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import PDFDocument from 'pdfkit';

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
}
