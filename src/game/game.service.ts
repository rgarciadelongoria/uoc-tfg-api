import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { User } from '../user/entities/user.entity';
import { Game } from './entities/game.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { isAdminOrSameUser, isCorrectCode } from '../common/utils/utils';
import { ValidCodes } from './enums/valid-codes.enum';
import { ValidRoles } from '../user/enums/valid-roles.enum';
import { GameDataInfo, LNGameDataInfoPrize } from './interfaces/game-data.interface';
import { ResponsePrize } from './interfaces/response-prize.interface';
import { LnTaskService } from '../task/ln-task.service';
import { FindDto } from './dto/find.dto';
import { FindDto as TicketFindDto } from '../ticket/dto/find.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Push } from '../push/entities/push.entity';

export const GameNames: [[ValidCodes, string]] = [
  [ValidCodes.LOTERIA_NACIONAL, 'Lotería Nacional']
]

@Injectable()
export class GameService {
  constructor(
    @InjectModel(Game.name)
    private readonly gameModel: Model<Game>,
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<Ticket>,
    private readonly lnTaskService: LnTaskService
  ) {}

  /*
  CRUD - Game
  */

  async create(createGameDto: CreateGameDto, userToken: User) {
    if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
      throw new UnauthorizedException(`You can't update this game`);
    }

    if (!isCorrectCode(createGameDto.code)) {
      throw new BadRequestException(`Invalid code: ${createGameDto.code}. Correct codes are: ${Object.values(ValidCodes).join(', ')}`);
    }

    this.checkCorrectData(createGameDto);

    try {
      return await this.gameModel.create(createGameDto);
    } catch (error) {
      this.handleException(error);
    }
  }

  async findAll(findDto: FindDto) {
    const {
      limit = 10,
      offset = 0,
      code = '',
      onlyWithPrizes = false,
      minDays = 0,
      maxDays = 0
    } = findDto;

    let query = this.gameModel.find({}, { 'data.info.completePrizesListRaw': 0 })
      .sort({ date: -1 })
      .skip(offset)
      .limit(limit);

    if (code) {
      query = query.where({ code: code.toLocaleLowerCase().trim() });
    }

    if (minDays) {
      query = query.where({ date: { $lte: new Date(Date.now() - minDays * 24 * 60 * 60 * 1000) } });
    }

    if (maxDays) {
      query = query.where({ date: { $gte: new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000) } });
    }

    if (onlyWithPrizes) {
      query = query.where({
        $and: [
            { 'data.info.raw': { $exists: true } },
            { 'data.info.prizes': { $exists: true, $ne: [] } },
        ]
      })
    }

    return await query.exec();
  }

  async findOne(term: string) {
    let game: Game;

    // Mongo Id
    if (isValidObjectId(term)) {
      game = await this.gameModel.findById(term).exec();
    }

    // Code
    if (!game) {
      game = await this.gameModel.findOne({ code: term.toLocaleLowerCase().trim() }, { 'data.info.completePrizesListRaw': 0 }).exec();
    }

    if (!game) {
      throw new NotFoundException(`Game not found: ${term}`);
    }

    return game;
  }

  async update(id: string, updateGameDto: UpdateGameDto, userToken: User) {
    if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
      throw new UnauthorizedException(`You can't update this game`);
    }

    const game = await this.findOne(id);

    if (updateGameDto.code) {
      if (!isCorrectCode(updateGameDto.code)) {
        throw new BadRequestException(`Invalid code: ${updateGameDto.code}. Correct codes are: ${Object.values(ValidCodes).join(', ')}`);
      }
    }

    this.checkCorrectData(updateGameDto);

    try {
      await game.updateOne(updateGameDto, {new: true});
      return { ...game.toJSON(), ...updateGameDto };
    } catch (error) {
      this.handleException(error);
    }
  }

  async remove(id: string, userToken: User) {
    if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
      throw new UnauthorizedException(`You can't update this game`);
    }

    if (!isValidObjectId(id)) {
      throw new BadRequestException(`Invalid mongo id: ${id}`);
    }

    let game: Game;
    try {
      game = await this.gameModel.findByIdAndDelete(id).exec();
    } catch (error) {
      this.handleException(error);
    }

    if (game) {
      return { message: `Game deleted: ${id}` };
    } else {
      throw new NotFoundException(`Game not found: ${id}`);
    }
  }

  /*
  Endpoints - Game
  */

  async checkAllTicketsPrizes(findDto: TicketFindDto, userToken: User) {
    const { 
      limit = 10,
      offset = 0,
      code = ''
    } = findDto;

    let query = this.ticketModel.find({ user: userToken._id })
      .sort({ date: -1 })
      .skip(offset)
      .limit(limit);

    if (code) {
      query = query.where({ code: code.toLocaleLowerCase().trim() });
    }

    const tickets = await query.exec();

    if (!tickets) {
      throw new NotFoundException(`Tickets not found for user: ${userToken._id}`);
    }

    const prizes: ResponsePrize[] = [];
    for await (const ticket of tickets) {
      const prize: ResponsePrize = await this.checkTicketPrize(ticket._id, userToken, true);
      prizes.push(prize);
    }

    return prizes;
  }

  async checkTicketPrize(id: string, userToken: User, checkingAllTickets = false) {
    const ticket = await this.ticketModel.findById(id).exec();

    if (!ticket) {
      throw new NotFoundException(`Ticket not found: ${id}`);
    }

    if (!isAdminOrSameUser(ticket.user, userToken)) {
      throw new UnauthorizedException(`You can't check this ticket`);
    }

    const game = await this.gameModel.findOne({ date: ticket.date, code: ticket.code }, { 'data.info.completePrizesListRaw': 0 }).exec();

    if (!game && !checkingAllTickets) {
      throw new NotFoundException(`Game not found for ticket date or code: ${ticket.date} - ${ticket.code}`);
    } else if (!game && checkingAllTickets) {
      const noGamePrize: ResponsePrize = {
        ticket,
        game: null,
        prize: null
      }
      return noGamePrize;
    }

    return this.getPrizeResultByCode(game, ticket);
  } 

  async taskDownloadData(code: ValidCodes, userToken: User) {
    if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
      throw new UnauthorizedException(`You can't launch download data task`);
    } else if (!isCorrectCode(code)) {
      throw new BadRequestException(`Invalid code: ${code}. Correct codes are: ${Object.values(ValidCodes).join(', ')}`);
    
    // LN
    } else if (code === ValidCodes.LOTERIA_NACIONAL) {
      this.lnTaskService.launchTaskLN();
      return { message: `Task launched for code: ${code}` };

    } else {
      return { message: `Task not found for code: ${code}` };
    }
  }

  /*
  General logic
  */

  private getPrizeResultByCode(game: Game, ticket: Ticket) {
    let prize: LNGameDataInfoPrize; // Multiple intergaces by game code

    // LN
    if (game.code === ValidCodes.LOTERIA_NACIONAL) {
      prize = this.getPrizeResultByCodeLN(game, ticket);
    }

    const result: ResponsePrize = {
      ticket,
      game,
      prize // Multiple interfaces by game code
    }

    return result;
  }

  private handleException(error: any) {
    if (error.code === 11000) {
      throw new BadRequestException(`Game already exists: ${JSON.stringify(error.keyValue)}`);
    }
    console.log(error);
    throw new InternalServerErrorException(`Error, check server logs.`);
  }

  // Check GameData structure
  private checkCorrectData(gameDto: UpdateGameDto | CreateGameDto) {

    if (!gameDto.data) {
      throw new BadRequestException(`Invalid data: ${JSON.stringify(gameDto)}`);
    }

    if (!gameDto.data.info) {
      throw new BadRequestException(`Invalid data, need info: ${JSON.stringify(gameDto)}`);
    }

    // LN
    if (gameDto.code === ValidCodes.LOTERIA_NACIONAL) {
      this.checkCorrectGameDataInfoLN(gameDto.data.info);
    }
  }

  /*
  LN logic
  */

  async checkPrizeByNumberLN(gameId: string, number: string): Promise<LNGameDataInfoPrize[]> {
    try {
      const game = await this.gameModel.findOne({ 'data.info.gameId': gameId }, { 'data.info.completePrizesListRaw': 1 }).exec();
      const prizes = JSON.parse(game.data?.info?.completePrizesListRaw || '[]') as LNGameDataInfoPrize[];
      const results = prizes.filter((prize) => prize.number.substring(1).toLowerCase().indexOf(number) > -1);

      if (prizes.length && !results.length) {
        results.push({
          number: '0' + number,
          quantity: 0
        });
      }

      return results
    } catch (error) {
      this.handleException(error);
    }
  }

  private checkCorrectGameDataInfoPrizesLN(prices: LNGameDataInfoPrize[]) {
    return (prices.findIndex(el => {
      return (typeof el.number === 'string' && typeof el.quantity === 'number');
    }) > -1);
  }

  private checkCorrectGameDataInfoLN(info: GameDataInfo) {
    if (info.prizes) {
      if (!Array.isArray(info.prizes)) {
        throw new BadRequestException(`Invalid info, prizes is not an array: ${JSON.stringify(info)}`)
      } else if (!this.checkCorrectGameDataInfoPrizesLN(info.prizes as LNGameDataInfoPrize[])) {
        throw new BadRequestException(`Invalid info, prize incorrect format: ${JSON.stringify(info)}`)
      }
    } else {
      throw new BadRequestException(`Invalid info, prizes not found: ${JSON.stringify(info)}`)
    }
  }

  private getPrizeResultByCodeLN(game: Game, ticket: Ticket): LNGameDataInfoPrize {
    const ticketNumber = '0' + ticket.data?.info?.number;
    const prizes = JSON.parse(game.data?.info?.completePrizesListRaw || '[]') as LNGameDataInfoPrize[];
    const hasPrize = prizes.find(el => el.number === ticketNumber);

    return {
      number: ticket.data.info.number,
      quantity: hasPrize?.quantity || 0
    }
  }
}
