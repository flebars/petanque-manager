import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Partie } from '@prisma/client';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('joinConcours')
  handleJoinConcours(
    @MessageBody() concoursId: string,
    @ConnectedSocket() client: Socket,
  ): void {
    client.join(`concours:${concoursId}`);
  }

  @SubscribeMessage('leaveConcours')
  handleLeaveConcours(
    @MessageBody() concoursId: string,
    @ConnectedSocket() client: Socket,
  ): void {
    client.leave(`concours:${concoursId}`);
  }

  emitScoreValide(concoursId: string, partie: Partie): void {
    this.server.to(`concours:${concoursId}`).emit('score_valide', partie);
  }

  emitTourDemarre(concoursId: string, tour: number): void {
    this.server.to(`concours:${concoursId}`).emit('tour_demarre', { concoursId, tour });
  }

  emitClassementMisAJour(concoursId: string): void {
    this.server.to(`concours:${concoursId}`).emit('classement_mis_a_jour', { concoursId });
  }
}
