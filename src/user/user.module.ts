import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User, UserSchema } from './entities/user.entity';
import { TicketService } from '../ticket/ticket.service';
import { Ticket, TicketSchema } from '../ticket/entities/ticket.entity';
import { Game, GameSchema } from '../game/entities/game.entity';
import { Push, PushSchema } from '../push/entities/push.entity';

@Module({
  controllers: [UserController],
  providers: [UserService, JwtStrategy, TicketService],
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
        name: Push.name,
        schema: PushSchema,
      },
      {
        name: Game.name,
        schema: GameSchema,
      }
    ]),
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
export class UserModule {}
