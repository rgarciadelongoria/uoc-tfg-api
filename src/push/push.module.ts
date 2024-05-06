import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/entities/user.entity';
import { Push, PushSchema } from './entities/push.entity';
import { PassportModule } from '@nestjs/passport';

@Module({
  controllers: [PushController],
  providers: [PushService],
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: Push.name,
        schema: PushSchema,
      }
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' })
  ]
})
export class PushModule {}
