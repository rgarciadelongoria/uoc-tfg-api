import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Game, GameSchema } from './entities/game.entity';
import { PassportModule } from '@nestjs/passport';
import { User, UserSchema } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { Ticket, TicketSchema } from '../ticket/entities/ticket.entity';
import { TicketService } from '../ticket/ticket.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '../user/strategies/jwt.strategy';
import { TaskService } from '../task/task.service';
import { HttpModule } from '@nestjs/axios';
import { Push, PushSchema } from '../push/entities/push.entity';

@Module({
  controllers: [GameController],
  providers: [GameService, UserService, TicketService, JwtStrategy, TaskService],
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
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
    ]),
    HttpModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [],
      inject: [],
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '2h' },
      }),
    }),
  ],
  exports: [JwtStrategy, PassportModule, JwtModule],
})
export class GameModule {}
