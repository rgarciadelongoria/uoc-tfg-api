import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './user/user.module';
import { GameModule } from './game/game.module';
import { TicketModule } from './ticket/ticket.module';
import { TaskModule } from './task/task.module';
import { UuidModule } from './uuid/uuid.module';
import { PushModule } from './push/push.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(
      process.env.MONGO_DB,
    ),
    ScheduleModule.forRoot(),
    UserModule,
    GameModule,
    TicketModule,
    TaskModule,
    UuidModule,
    PushModule,
  ],
  providers: [],
})
export class AppModule {}
