import { Controller, Get, Param, Res, UseGuards, Query, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '@/prisma/prisma.service';

@Controller('pdf')
@UseGuards(AuthGuard('jwt'))
export class PdfController {
  constructor(
    private pdfService: PdfService,
    private prisma: PrismaService,
  ) {}

  @Get('feuille-match/:id')
  async feuilleMatch(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const buffer = await this.pdfService.genererFeuilleMatch(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="feuille-match-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('classement/:concoursId')
  async classement(@Param('concoursId') concoursId: string, @Res() res: Response): Promise<void> {
    const buffer = await this.pdfService.genererClassement(concoursId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="classement-${concoursId}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('fiches-partie/concours/:concoursId/tour/:tour')
  async fichesPartieTour(
    @Param('concoursId') concoursId: string,
    @Param('tour') tour: string,
    @Res() res: Response,
  ): Promise<void> {
    const tourNum = parseInt(tour, 10);
    const parties = await this.prisma.partie.findMany({
      where: { concoursId, tour: tourNum, type: 'MELEE' },
    });

    if (parties.length === 0) {
      throw new NotFoundException(`Aucune partie trouvée pour le tour ${tourNum}`);
    }

    const buffer = await this.pdfService.genererFichesPartie(concoursId, { tour: tourNum });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="fiches-tour-${tour}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('fiches-partie/poule/:pouleId')
  async fichesPartiePoule(
    @Param('pouleId') pouleId: string,
    @Res() res: Response,
  ): Promise<void> {
    const poule = await this.prisma.poule.findUnique({
      where: { id: pouleId },
      include: { concours: true },
    });

    if (!poule) {
      throw new NotFoundException(`Poule ${pouleId} introuvable`);
    }

    const parties = await this.prisma.partie.findMany({
      where: { pouleId, type: 'CHAMPIONNAT_POULE' },
    });

    if (parties.length === 0) {
      throw new NotFoundException(`Aucune partie trouvée pour la poule ${poule.numero}`);
    }

    const buffer = await this.pdfService.genererFichesPartie(poule.concoursId, { pouleId });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="fiches-poule-${poule.numero}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('fiches-partie/concours/:concoursId/bracket/:ronde')
  async fichesPartieBracket(
    @Param('concoursId') concoursId: string,
    @Param('ronde') ronde: string,
    @Query('type') type: string,
    @Res() res: Response,
  ): Promise<void> {
    const rondeNum = parseInt(ronde, 10);
    const typePartie = type === 'consolante' ? 'COUPE_CONSOLANTE' : 'COUPE_PRINCIPALE';

    const parties = await this.prisma.partie.findMany({
      where: {
        concoursId,
        bracketRonde: rondeNum,
        type: type === 'consolante' ? 'COUPE_CONSOLANTE' : { in: ['COUPE_PRINCIPALE', 'CHAMPIONNAT_FINALE'] },
      },
    });

    if (parties.length === 0) {
      throw new NotFoundException(
        `Aucune partie trouvée pour la ronde ${rondeNum} (${type || 'principale'})`,
      );
    }

    const buffer = await this.pdfService.genererFichesPartie(concoursId, {
      bracketRonde: rondeNum,
      type,
    });

    const filename = type === 'consolante'
      ? `fiches-bracket-ronde-${ronde}-consolante.pdf`
      : `fiches-bracket-ronde-${ronde}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
