import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConcoursService } from './concours.service';
import { CreateConcoursDto } from './dto/create-concours.dto';
import { UpdateConcoursDto } from './dto/update-concours.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtPayload } from '@/modules/auth/strategies/jwt.strategy';
import { Concours } from '@prisma/client';

@Controller('concours')
@UseGuards(AuthGuard('jwt'))
export class ConcoursController {
  constructor(private concoursService: ConcoursService) {}

  @Get()
  findAll(): Promise<Concours[]> {
    return this.concoursService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Concours> {
    return this.concoursService.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateConcoursDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<Concours> {
    return this.concoursService.create(dto, user.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateConcoursDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<Concours> {
    return this.concoursService.update(id, dto, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    return this.concoursService.remove(id, user.sub);
  }

  @Post(':id/demarrer')
  demarrer(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<Concours> {
    return this.concoursService.demarrer(id, user.sub);
  }

  @Post(':id/terminer')
  terminer(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<Concours> {
    return this.concoursService.terminer(id, user.sub);
  }
}
