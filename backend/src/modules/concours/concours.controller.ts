import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConcoursService } from './concours.service';
import { CreateConcoursDto } from './dto/create-concours.dto';
import { UpdateConcoursDto } from './dto/update-concours.dto';
import { ExportConcoursDto } from './dto/export-concours.dto';
import { ImportConcoursDto } from './dto/import-concours.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { JwtPayload } from '@/modules/auth/strategies/jwt.strategy';
import { Concours, Role } from '@prisma/client';

@Controller('concours')
@UseGuards(AuthGuard('jwt'), RolesGuard)
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
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR)
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
    return this.concoursService.update(id, dto, user.sub, user.role);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    return this.concoursService.remove(id, user.sub, user.role);
  }

  @Post(':id/demarrer')
  demarrer(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<Concours> {
    return this.concoursService.demarrer(id, user.sub, user.role);
  }

  @Post(':id/terminer')
  terminer(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<Concours> {
    return this.concoursService.terminer(id, user.sub, user.role);
  }

  @Get(':id/export')
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR, Role.ARBITRE)
  exportConcours(@Param('id') id: string): Promise<ExportConcoursDto> {
    return this.concoursService.exportConcours(id);
  }

  @Post('import')
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR)
  importConcours(
    @Body() dto: ImportConcoursDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<Concours> {
    return this.concoursService.importConcours(dto, user.sub);
  }
}
