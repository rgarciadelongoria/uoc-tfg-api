import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PushService } from './push.service';
import { CreatePushDto } from './dto/create-push.dto';
import { UpdatePushDto } from './dto/update-push.dto';
import { Auth, GetUser } from '../user/decorators';
import { User } from '../user/entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post()
  @Auth()
  create(
    @GetUser() userToken: User,
    @Body() createPushDto: CreatePushDto) {
    return this.pushService.create(createPushDto, userToken);
  }

  @Get()
  @Auth()
  findAll(
    @GetUser() userToken: User,
    @Query() paginationDto: PaginationDto) {
    return this.pushService.findAll(paginationDto, userToken);
  }

  @Get(':token')
  findOne(
    @Param('token') token: string) {
    return this.pushService.findOne(token);
  }

  @Patch(':id')
  @Auth()
  update(
    @GetUser() userToken: User,
    @Param('id') id: string,
    @Body() updatePushDto: UpdatePushDto) {
    return this.pushService.update(id, updatePushDto, userToken);
  }

  @Delete(':id')
  @Auth()
  remove(
    @GetUser() userToken: User,
    @Param('id') id: string) {
    return this.pushService.remove(id, userToken);
  }

  @Delete('token/:token')
  @Auth()
  removeByToken(
    @GetUser() userToken: User,
    @Param('token') id: string) {
    return this.pushService.removeByToken(id, userToken);
  }
}
