import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('pdf')
@UseGuards(AuthGuard('jwt'))
export class PdfController {
  constructor(private pdfService: PdfService) {}

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
}
