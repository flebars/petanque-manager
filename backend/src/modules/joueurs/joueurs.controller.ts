import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JoueursService } from './joueurs.service';
import { CreateJoueurDto } from './dto/create-joueur.dto';
import { UpdateJoueurDto } from './dto/update-joueur.dto';
import { Joueur } from '@prisma/client';

@Controller('joueurs')
@UseGuards(AuthGuard('jwt'))
export class JoueursController {
  constructor(private joueursService: JoueursService) {}

  @Get()
  findAll(@Query('email') email?: string): Promise<Joueur[]> {
    return this.joueursService.findAll(email);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Joueur> {
    return this.joueursService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateJoueurDto): Promise<Joueur> {
    return this.joueursService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateJoueurDto): Promise<Joueur> {
    return this.joueursService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.joueursService.remove(id);
  }
}
