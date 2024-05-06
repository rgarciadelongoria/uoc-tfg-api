import { Module } from '@nestjs/common';
import { UuidService } from './uuid.service';
import { UuidController } from './uuid.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Uuid, UuidSchema } from './entities/uuid.entity';
import { PassportModule } from '@nestjs/passport';
import { User, UserSchema } from '../user/entities/user.entity';

@Module({
  controllers: [UuidController],
  providers: [UuidService],
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: Uuid.name,
        schema: UuidSchema,
      }
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' })
  ]
})
export class UuidModule {}
