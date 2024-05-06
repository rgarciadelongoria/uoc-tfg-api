import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { GameService } from './game.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { Auth, GetUser } from '../user/decorators';
import { User } from '../user/entities/user.entity';
import { ValidCodes } from './enums/valid-codes.enum';
import { FindDto } from './dto/find.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post()
  @Auth()
  create(
    @GetUser() userToken: User,
    @Body() createGameDto: CreateGameDto) {
    return this.gameService.create(createGameDto, userToken);
  }

  @Get()
  findAll(@Query() findDto: FindDto) {
    return this.gameService.findAll(findDto);
  }

  @Get(':term')
  findOne(@Param('term') term: string) {
    return this.gameService.findOne(term);
  }

  @Patch(':id')
  @Auth()
  update(
    @GetUser() userToken: User,
    @Param('id') id: string,
    @Body() updateGameDto: UpdateGameDto) {
    return this.gameService.update(id, updateGameDto, userToken);
  }

  @Delete(':id')
  @Auth()
  remove(
    @GetUser() userToken: User,
    @Param('id') id: string) {
    return this.gameService.remove(id, userToken);
  }

  @Get('ticket/all')
  @Auth()
  checkAllTicketsPrizes(
    @GetUser() userToken: User,
    @Query() findDto: FindDto) {
    return this.gameService.checkAllTicketsPrizes(findDto, userToken);
  }

  @Get('ticket/:id')
  @Auth()
  checkTicketPrize(
    @GetUser() userToken: User,
    @Param('id') id: string) {
    return this.gameService.checkTicketPrize(id, userToken);
  }

  @Get('task/download-data/:code')
  @Auth()
  taskDownloadData(
    @GetUser() userToken: User,
    @Param('code') code: ValidCodes) {
    return this.gameService.taskDownloadData(code, userToken);
  }
}
