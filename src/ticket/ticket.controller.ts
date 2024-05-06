import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { User } from '../user/entities/user.entity';
import { Auth, GetUser } from '../user/decorators';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('ticket')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  @Auth()
  create(
    @GetUser() userToken: User,
    @Body() createTicketDto: CreateTicketDto) {
    return this.ticketService.create(createTicketDto, userToken);
  }

  @Get()
  @Auth()
  findAll(
    @GetUser() userToken: User,
    @Query() paginationDto: PaginationDto) {
    return this.ticketService.findAll(paginationDto, userToken);
  }

  @Get(':id')
  @Auth()
  findOne(
    @GetUser() userToken: User,
    @Param('id') id: string) {
    return this.ticketService.findOne(id, userToken);
  }

  @Patch(':id')
  @Auth()
  update(
    @GetUser() userToken: User,
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto) {
    return this.ticketService.update(id, updateTicketDto, userToken);
  }

  @Delete(':id')
  @Auth()
  remove(
    @GetUser() userToken: User,
    @Param('id') id: string) {
    return this.ticketService.remove(id, userToken);
  }
}
