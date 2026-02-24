import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { ClearDataDto, UpdateUserRoleDto, BackupDataDto } from './dto';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getSystemStats();
  }

  @Get('users')
  async listUsers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listUsers(search, page ? +page : 1, limit ? +limit : 50);
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() actor: JwtPayload,
    @Req() req: any,
  ) {
    return this.adminService.updateUserRole(id, dto, actor.sub, req.ip);
  }

  @Delete('users/:id')
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
    @Req() req: any,
  ) {
    return this.adminService.deleteUser(id, actor.sub, req.ip);
  }

  @Post('backup')
  async exportBackup(
    @CurrentUser() actor: JwtPayload,
    @Req() req: any,
  ): Promise<BackupDataDto> {
    return this.adminService.exportDatabase(actor.sub, req.ip);
  }

  @Post('clear-data')
  async clearData(
    @Body() dto: ClearDataDto,
    @CurrentUser() actor: JwtPayload,
    @Req() req: any,
  ) {
    console.log('[AdminController] clear-data called with:', {
      confirmText: dto.confirmText,
      hasPassword: !!dto.password,
      actorId: actor.sub,
      ip: req.ip,
    });
    return this.adminService.clearAllData(dto, actor.sub, req.ip);
  }

  @Get('audit-logs')
  async listAuditLogs(
    @Query('action') action?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listAuditLogs(action, page ? +page : 1, limit ? +limit : 50);
  }

  @Delete('audit-logs/cleanup')
  async cleanupAuditLogs() {
    return this.adminService.cleanupOldAuditLogs();
  }
}
