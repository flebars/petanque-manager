import { Module, forwardRef } from '@nestjs/common';
import { ConcoursService } from './concours.service';
import { ConcoursController } from './concours.controller';
import { PartiesModule } from '../parties/parties.module';
import { JoueursModule } from '../joueurs/joueurs.module';

@Module({
  imports: [forwardRef(() => PartiesModule), JoueursModule],
  controllers: [ConcoursController],
  providers: [ConcoursService],
  exports: [ConcoursService],
})
export class ConcoursModule {}
