import { BadRequestException, Body, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateUuidDto } from './dto/create-uuid.dto';
import { UpdateUuidDto } from './dto/update-uuid.dto';
import { GetUser } from '../user/decorators';
import { User } from '../user/entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Uuid } from './entities/uuid.entity';
import { Model, isValidObjectId } from 'mongoose';
import { ValidRoles } from '../user/enums/valid-roles.enum';
import { PaginationDto } from '../common/dto/pagination.dto';
import { isAdminOrSameUser } from '../common/utils/utils';

@Injectable()
export class UuidService {
  constructor(
    @InjectModel(Uuid.name)
    private readonly uuidModel: Model<Uuid>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  /*
  CRUD - Ticket
  */

  async create(createUuidDto: CreateUuidDto, userToken: User) {
    if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
      createUuidDto.user = userToken.id;
    } else {
      const user = await this.userModel.findById(createUuidDto.user).exec();
      if (!user) {
        throw new NotFoundException(`User not found: ${createUuidDto.user}`);
      }
    }
    
    try {
      const uuid = await this.uuidModel.create(createUuidDto);
      return uuid;
    } catch (error) {
      this.handleException(error);
    }
  }

  async findAll(paginationDto: PaginationDto, userToken: User) {
    const { limit = 10, offset = 0} = paginationDto;

    let queryFilters = {};
    // User only get own tickets
    if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
      queryFilters = { user: userToken.id };
    }
    // Admin get all tickets
    const data = await this.uuidModel.find(queryFilters)
      .skip(offset)
      .limit(limit)
      .exec();
    return data;
  }

  async findOne(id: string) {
    let uuidData: Uuid;

    try {
      // Mongo Id
      if (isValidObjectId(id)) {
        uuidData = await this.uuidModel.findOne({ _id: id }).exec();
      } else {
        uuidData = await this.uuidModel.findOne({ uuid: id }).exec();
      }
    } catch (error) {
      this.handleException(error);
    }

    if (!uuidData) {
      throw new NotFoundException(`Uuid not found: ${id}`);
    }

    return uuidData;
  }

  async update(id: string, updateUuidDto: UpdateUuidDto, userToken: User) {
    const uuid = await this.findOne(id);

    if (!isAdminOrSameUser(uuid.user, userToken)) {
      throw new UnauthorizedException(`You can't update this uuid`);
    } else if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
      // User can't change the id or the user
      if (updateUuidDto.user) {
        updateUuidDto.user = userToken.id;
      }
    }

    try {
      await uuid.updateOne(updateUuidDto, {new: true});
      return { ...uuid.toJSON(), ...updateUuidDto };
    } catch (error) {
      this.handleException(error);
    }
  }

  async remove(id: string, userToken: User) {
    let uuid = await this.findOne(id);

    if (!isAdminOrSameUser(uuid.user, userToken)) {
      throw new UnauthorizedException(`You can't update this Uuid`);
    }

    if (!isValidObjectId(id)) {
      throw new BadRequestException(`Invalid mongo id: ${id}`);
    }

    try {
      // User only delete own tickets
      if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
        uuid = await this.uuidModel.findOneAndDelete({ _id: id, user: userToken.id }).exec();
      } else {
        // Admin delete all tickets
        uuid = await this.uuidModel.findByIdAndDelete(id).exec();
      }
    } catch (error) {
      this.handleException(error);
    }

    if (uuid) {
      return { message: `Uuid deleted: ${id}` };
    } else {
      throw new NotFoundException(`Uuid not found: ${id}`);
    }
  }  
  
  /*
  General logic
  */

  private handleException(error: any) {
    if (error.code === 11000) {
      throw new BadRequestException(`Uuid already exists: ${JSON.stringify(error.keyValue)}`);
    }
    console.log(error);
    throw new InternalServerErrorException(`Error, check server logs.`);
  }
}
