import { Module, forwardRef } from '@nestjs/common';
import { ConcoursService } from './concours.service';
import { ConcoursController } from './concours.controller';
import { PartiesModule } from '../parties/parties.module';

@Module({
  imports: [forwardRef(() => PartiesModule)],
  controllers: [ConcoursController],
  providers: [ConcoursService],
  exports: [ConcoursService],
})
export class ConcoursModule {}
