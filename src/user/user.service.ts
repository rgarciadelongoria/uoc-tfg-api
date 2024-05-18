import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, isValidObjectId } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto, LoginUserDto } from './dto';
import { User } from './entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { ValidRoles } from './enums/valid-roles.enum';
import { Ticket } from '../ticket/entities/ticket.entity';
import { isAdminOrSameUser } from '../common/utils/utils';
import { Push } from '../push/entities/push.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<Ticket>,
    @InjectModel(Push.name)
    private readonly pushModel: Model<Push>,
    private readonly jwtService: JwtService,
  ) {}

  /*
  CRUD - User
  */

  async create(createUserDto: CreateUserDto) {
    if (!this.isValidPassword(createUserDto.password)) {
      throw new BadRequestException(`Password must be 8-16 characters, at least one uppercase letter, one lowercase letter and one number.`);
    }

    if (createUserDto.roles) {
      if (!this.isCorrectRole(createUserDto.roles)) {
        throw new BadRequestException(`Invalid roles: ${createUserDto.roles}. Correct names are: ${Object.values(ValidRoles).join(', ')}`);
      }
    }

    createUserDto.email = createUserDto.email.toLowerCase().trim();
    createUserDto.password = await this.getPasswordHash(createUserDto.password);

    try {
      return await this.userModel.create(createUserDto);
    } catch (error) {
      this.handleException(error);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit = 10, offset = 0} = paginationDto;

    return await this.userModel.find()
      .sort({ name: 1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  async findOne(term: string) {
    let user: User;

    // Mongo Id
    if (isValidObjectId(term)) {
      user = await this.userModel.findById(term).exec();
    }

    // Email
    if (!user) {
      user = await this.userModel.findOne({ email: term.toLocaleLowerCase().trim() }).exec();
    }

    if (!user) {
      throw new NotFoundException(`User not found: ${term}`);
    }

    return user;
  }

  async update(term: string, updateUserDto: UpdateUserDto, userToken: User) {
    const user = await this.findOne(term);

    if (!isAdminOrSameUser(user.id, userToken)) {
      throw new UnauthorizedException(`You can't update this user`);
    }

    if (updateUserDto.email) {
      updateUserDto.email = updateUserDto.email.toLowerCase().trim();
    }

    if (updateUserDto.password) {
      if (!this.isValidPassword(updateUserDto.password)) {
        throw new BadRequestException(`Password must be 8-16 characters, at least one uppercase letter, one lowercase letter and one number.`);
      }
      updateUserDto.password = await this.getPasswordHash(updateUserDto.password);
    }

    try {
      await user.updateOne(updateUserDto, {new: true});
      return { ...user.toJSON(), ...updateUserDto };
    } catch (error) {
      this.handleException(error);
    }
  }

  async remove(term: string, userToken: User) {
    const user = await this.findOne(term);

    if (!isAdminOrSameUser(user.id, userToken)) {
      throw new UnauthorizedException(`You can't update this user`);
    }

    if (user.isActive === false) {
      throw new BadRequestException(`User already inactive: ${user.email}`);
    }

    try {
      await user.updateOne({isActive: false}, {new: true});
      user.isActive = false;
      return user;
    } catch (error) {
      this.handleException(error);
    }
  }

  /*
  Endpoints - User
  */

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    const user = await this.userModel.findOne({ email: email.toLowerCase().trim() })
      .select('+password')
      .exec();

    if (!user) {
      throw new UnauthorizedException(`Invalid credentials`);
    }

    if (!bcrypt.compareSync(password, user.password)) {
      throw new UnauthorizedException(`Invalid credentials`);
    }

    user.updatedAt = new Date();
    user.save();

    return {
      user,
      token: this.getJwtToken({ id: user.id })
    };
  }

  async ticketsFindAll(userToken: User, paginationDto: PaginationDto) {
    const { limit = 10, offset = 0} = paginationDto;
    const user = await this.findOne(userToken.id);

    if (!user) {
      throw new NotFoundException(`User not found: ${userToken.id}`);
    }

    return await this.ticketModel.find({ user: userToken.id })
      .sort({ name: 1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  async pushesFindAll(userToken: User, paginationDto: PaginationDto) {
    const { limit = 10, offset = 0} = paginationDto;
    const user = await this.findOne(userToken.id);

    if (!user) {
      throw new NotFoundException(`User not found: ${userToken.id}`);
    }

    return await this.pushModel.find({ user: userToken.id })
      .sort({ name: 1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  /*
  General logic
  */

  private handleException(error: any) {
    if (error.code === 11000) {
      throw new BadRequestException(`User already exists: ${JSON.stringify(error.keyValue)}`);
    }
    console.log(error);
    throw new InternalServerErrorException(`Error, check server logs.`);
  }

  private async getPasswordHash(password: string) {
    return await bcrypt.hash(password, 10);
  }

  private isValidPassword(password: string) {
    return true; 
    // TODO: Check for users and disable for uuid users

    // Regex to validate password one letter, one number, one uppercase letter, one lowercase letter, 8-16 characters
    const regExp = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{8,16}$/;
    if (regExp.test(password)) {
      return true;
    }
    return false;
  }

  private getJwtToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  private isCorrectRole(role: string[]) {
    let isCorrect = true;
    role.forEach((r) => {
      if (isCorrect && !Object.values(ValidRoles).includes(r as ValidRoles)) {
        isCorrect = false;
      }
    });
    return isCorrect;
  }
}
