import { Module } from '@nestjs/common';
import { ClassementService } from './classement.service';
import { ClassementController } from './classement.controller';

@Module({
  controllers: [ClassementController],
  providers: [ClassementService],
  exports: [ClassementService],
})
export class ClassementModule {}
