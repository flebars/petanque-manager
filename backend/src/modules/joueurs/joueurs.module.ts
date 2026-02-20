import { Module } from '@nestjs/common';
import { JoueursService } from './joueurs.service';
import { JoueursController } from './joueurs.controller';

@Module({
  controllers: [JoueursController],
  providers: [JoueursService],
  exports: [JoueursService],
})
export class JoueursModule {}
