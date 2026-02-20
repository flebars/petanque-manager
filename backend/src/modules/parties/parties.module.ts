import { Module } from '@nestjs/common';
import { PartiesService } from './parties.service';
import { PartiesController } from './parties.controller';
import { ClassementModule } from '@/modules/classement/classement.module';
import { GatewayModule } from '@/modules/gateway/gateway.module';
import { AuthModule } from '@/modules/auth/auth.module';

@Module({
  imports: [ClassementModule, GatewayModule, AuthModule],
  controllers: [PartiesController],
  providers: [PartiesService],
  exports: [PartiesService],
})
export class PartiesModule {}
