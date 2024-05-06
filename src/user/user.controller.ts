import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req, SetMetadata } from '@nestjs/common';
import { Headers } from '@nestjs/common';
import { IncomingHttpHeaders } from 'http';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, LoginUserDto } from './dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Auth, GetUser } from './decorators';
import { User } from './entities/user.entity';
import { ValidRoles } from './enums/valid-roles.enum';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  } 

  @Get()
  @Auth()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.userService.findAll(paginationDto);
  }

  @Get(':term')
  @Auth()
  findOne(@Param('term') term: string) {
    return this.userService.findOne(term);
  }

  @Patch(':term')
  @Auth()
  update(
    @GetUser() userToken: User,
    @Param('term') term: string, 
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(term, updateUserDto, userToken);
  }

  @Delete(':term')
  @Auth()
  remove(
    @GetUser() userToken: User,
    @Param('term') term: string,
  ) {
    return this.userService.remove(term, userToken);
  }

  @Post('login')
  login(@Body() LoginUserDto: LoginUserDto) {
    return this.userService.login(LoginUserDto);
  }

  @Get('ticket/all')
  @Auth()
  ticketsFindAll(
    @GetUser() userToken: User,
    @Query() paginationDto: PaginationDto
  ) {
    return this.userService.ticketsFindAll(userToken, paginationDto);
  }

  @Get('push/all')
  @Auth()
  pushesFindAll(
    @GetUser() userToken: User,
    @Query() paginationDto: PaginationDto
  ) {
    return this.userService.pushesFindAll(userToken, paginationDto);
  }
}
