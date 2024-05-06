import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UuidService } from './uuid.service';
import { CreateUuidDto } from './dto/create-uuid.dto';
import { UpdateUuidDto } from './dto/update-uuid.dto';
import { Auth, GetUser } from '../user/decorators';
import { User } from '../user/entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('uuid')
export class UuidController {
  constructor(private readonly uuidService: UuidService) {}
  
  @Post()
  @Auth()
  create(
    @GetUser() userToken: User,
    @Body() createUuidDto: CreateUuidDto) {
    return this.uuidService.create(createUuidDto, userToken);
  }

  @Get()
  @Auth()
  findAll(
    @GetUser() userToken: User,
    @Query() paginationDto: PaginationDto) {
    return this.uuidService.findAll(paginationDto, userToken);
  }

  @Get(':uuid')
  findOne(
    @Param('uuid') uuid: string) {
    return this.uuidService.findOne(uuid);
  }

  @Patch(':id')
  @Auth()
  update(
    @GetUser() userToken: User,
    @Param('id') id: string,
    @Body() updateUuidDto: UpdateUuidDto) {
    return this.uuidService.update(id, updateUuidDto, userToken);
  }

  @Delete(':id')
  @Auth()
  remove(
    @GetUser() userToken: User,
    @Param('id') id: string) {
    return this.uuidService.remove(id, userToken);
  }
}
