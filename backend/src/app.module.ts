import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { JoueursModule } from './modules/joueurs/joueurs.module';
import { ConcoursModule } from './modules/concours/concours.module';
import { EquipesModule } from './modules/equipes/equipes.module';
import { TirageModule } from './modules/tirage/tirage.module';
import { PartiesModule } from './modules/parties/parties.module';
import { ClassementModule } from './modules/classement/classement.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { GatewayModule } from './modules/gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    JoueursModule,
    ConcoursModule,
    EquipesModule,
    TirageModule,
    PartiesModule,
    ClassementModule,
    PdfModule,
    GatewayModule,
  ],
})
export class AppModule {}
