import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Game, GameSchema } from '../game/entities/game.entity';
import { Ticket, TicketSchema } from '../ticket/entities/ticket.entity';
import { Push, PushSchema } from '../push/entities/push.entity';
import { LnTaskService } from './ln-task.service';
import { PrTaskService } from './pr-task.service';

@Module({
    imports: [
        HttpModule,
        MongooseModule.forFeature([
            {
              name: Game.name,
              schema: GameSchema,
            },
            {
              name: Ticket.name,
              schema: TicketSchema,
            },
            {
              name: Push.name,
              schema: PushSchema,
            }
        ])
    ],
    providers: [
      LnTaskService,
      PrTaskService
    ],
})
export class TaskModule {}
