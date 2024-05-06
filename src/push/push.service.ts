import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreatePushDto } from './dto/create-push.dto';
import { UpdatePushDto } from './dto/update-push.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Push } from './entities/push.entity';
import { User } from '../user/entities/user.entity';
import { Model, isValidObjectId } from 'mongoose';
import { ValidRoles } from '../user/enums/valid-roles.enum';
import { PaginationDto } from '../common/dto/pagination.dto';
import { isAdminOrSameUser } from '../common/utils/utils';

@Injectable()
export class PushService {
  constructor(
    @InjectModel(Push.name)
    private readonly pushModel: Model<Push>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  /*
  CRUD - Push
  */
  
  async create(createPushDto: CreatePushDto, userToken: User) {
    if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
      createPushDto.user = userToken.id;
    } else {
      const user = await this.userModel.findById(createPushDto.user).exec();
      if (!user) {
        throw new NotFoundException(`User not found: ${createPushDto.user}`);
      }
    }
    
    try {
      const push = await this.pushModel.create(createPushDto);
      return push;
    } catch (error) {
      this.handleException(error);
    }
  }

  async findAll(paginationDto: PaginationDto, userToken: User) {
    const { limit = 10, offset = 0} = paginationDto;

    let queryFilters = {};
    // User only get own pushes
    if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
      queryFilters = { user: userToken.id };
    }
    // Admin get all pushes
    const data = await this.pushModel.find(queryFilters)
      .skip(offset)
      .limit(limit)
      .exec();
    return data;
  }

  async findOne(id: string) {
    let pushData: Push;

    try {
      // Mongo Id
      if (isValidObjectId(id)) {
        pushData = await this.pushModel.findOne({ _id: id }).exec();
      } else {
        pushData = await this.pushModel.findOne({ token: id }).exec();
      }
    } catch (error) {
      this.handleException(error);
    }

    if (!pushData) {
      throw new NotFoundException(`Push not found: ${id}`);
    }

    return pushData;
  }

  async update(id: string, updatePushDto: UpdatePushDto, userToken: User) {
    const push = await this.findOne(id);

    if (!isAdminOrSameUser(push.user, userToken)) {
      throw new UnauthorizedException(`You can't update this push`);
    } else if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
      // User can't change the id or the user
      if (updatePushDto.user) {
        updatePushDto.user = userToken.id;
      }
    }

    try {
      await push.updateOne(updatePushDto, {new: true});
      return { ...push.toJSON(), ...updatePushDto };
    } catch (error) {
      this.handleException(error);
    }
  }

  async remove(id: string, userToken: User) {
    let push = await this.findOne(id);

    if (!isAdminOrSameUser(push.user, userToken)) {
      throw new UnauthorizedException(`You can't update this push`);
    }

    if (!isValidObjectId(id)) {
      throw new BadRequestException(`Invalid mongo id: ${id}`);
    }

    try {
      // User only delete own pushes
      if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
        push = await this.pushModel.findOneAndDelete({ _id: id, user: userToken.id }).exec();
      } else {
        // Admin delete all pushes
        push = await this.pushModel.findByIdAndDelete(id).exec();
      }
    } catch (error) {
      this.handleException(error);
    }

    if (push) {
      return { message: `Push deleted: ${id}` };
    } else {
      throw new NotFoundException(`Push not found: ${id}`);
    }
  }

  async removeByToken(token: string, userToken: User) {
    let push = await this.findOne(token);

    try {
      // Everyone can delete all pushes by token
      push = await this.pushModel.findOneAndDelete({ token: token }).exec();
    } catch (error) {
      this.handleException(error);
    }

    if (push) {
      return { message: `Push deleted: ${token}` };
    } else {
      throw new NotFoundException(`Push not found: ${token}`);
    }
  }

  /*
  General logic
  */

  private handleException(error: any) {
    if (error.code === 11000) {
      throw new BadRequestException(`Push already exists: ${JSON.stringify(error.keyValue)}`);
    }
    console.log(error);
    throw new InternalServerErrorException(`Error, check server logs.`);
  }
}
