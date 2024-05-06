import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskService } from './task.service';
import { Game, GameSchema } from '../game/entities/game.entity';
import { Ticket, TicketSchema } from '../ticket/entities/ticket.entity';
import { Push, PushSchema } from '../push/entities/push.entity';

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
    providers: [TaskService],
})
export class TaskModule {}
