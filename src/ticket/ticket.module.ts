import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { Ticket, TicketSchema } from './entities/ticket.entity';
import { User, UserSchema } from '../user/entities/user.entity';
import { Game, GameSchema } from '../game/entities/game.entity';

@Module({
  controllers: [TicketController],
  providers: [TicketService],
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: Ticket.name,
        schema: TicketSchema,
      },
      {
        name: Game.name,
        schema: GameSchema,
      }
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
})
export class TicketModule {}
