import { Module } from '@nestjs/common';
import { TirageService } from './tirage.module.service';

@Module({
  providers: [TirageService],
  exports: [TirageService],
})
export class TirageModule {}
