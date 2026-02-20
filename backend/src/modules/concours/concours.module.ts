import { Module } from '@nestjs/common';
import { ConcoursService } from './concours.service';
import { ConcoursController } from './concours.controller';

@Module({
  controllers: [ConcoursController],
  providers: [ConcoursService],
  exports: [ConcoursService],
})
export class ConcoursModule {}
