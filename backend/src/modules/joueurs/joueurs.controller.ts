import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JoueursService } from './joueurs.service';
import { CreateJoueurDto } from './dto/create-joueur.dto';
import { UpdateJoueurDto } from './dto/update-joueur.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { JwtPayload } from '@/modules/auth/strategies/jwt.strategy';
import { Joueur, Role } from '@prisma/client';

@Controller('joueurs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
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
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR)
  create(@Body() dto: CreateJoueurDto): Promise<Joueur> {
    return this.joueursService.create(dto);
  }

  @Patch('me/password')
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.joueursService.changePassword(user.sub, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateJoueurDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<Joueur> {
    return this.joueursService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ORGANISATEUR)
  remove(@Param('id') id: string): Promise<void> {
    return this.joueursService.remove(id);
  }
}
