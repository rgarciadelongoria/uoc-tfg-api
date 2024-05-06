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
import { LNGameDataInfo, LNGameDataInfoPrize } from './interfaces/game-data.interface';
import { ResponsePrize } from './interfaces/response-prize.interface';
import { TaskService } from '../task/task.service';
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
    private readonly taskService: TaskService
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
      onlyWithPrizes = false
    } = findDto;

    let query = this.gameModel.find()
      .sort({ date: -1 })
      .skip(offset)
      .limit(limit);

    if (code) {
      query = query.where({ code: code.toLocaleLowerCase().trim() });
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
      game = await this.gameModel.findOne({ code: term.toLocaleLowerCase().trim() }).exec();
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

    const game = await this.gameModel.findOne({ date: ticket.date, code: ticket.code }).exec();

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

    const prizes = game.data?.info?.prizes;

    if (!prizes) {
      throw new InternalServerErrorException(`Invalid game data: ${game}`);
    }

    return this.getPrizeResultByCode(game, ticket, prizes);
  }

  async taskDownloadData(code: ValidCodes, userToken: User) {
    if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
      throw new UnauthorizedException(`You can't launch download data task`);
    } else if (!isCorrectCode(code)) {
      throw new BadRequestException(`Invalid code: ${code}. Correct codes are: ${Object.values(ValidCodes).join(', ')}`);
    
    // LN
    } else if (code === ValidCodes.LOTERIA_NACIONAL) {
      this.taskService.launchTaskLN();
      return { message: `Task launched for code: ${code}` };

    } else {
      return { message: `Task not found for code: ${code}` };
    }
  }

  /*
  General logic
  */

  private getPrizeResultByCode(game: Game, ticket: Ticket, prizes: LNGameDataInfoPrize[]) {
    let prize: LNGameDataInfoPrize; // Multiple intergaces by game code

    // LN
    if (game.code === ValidCodes.LOTERIA_NACIONAL) {
      prize = this.getPrizeResultByCodeLN(game, ticket, prizes);
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

  private checkCorrectGameDataInfoPrizesLN(prices: LNGameDataInfoPrize[]) {
    return (prices.findIndex(el => {
      return (typeof el.number === 'string' && typeof el.quantity === 'number');
    }) > -1);
  }

  private checkCorrectGameDataInfoLN(info: LNGameDataInfo) {
    if (info.prizes) {
      if (!Array.isArray(info.prizes)) {
        throw new BadRequestException(`Invalid info, prizes is not an array: ${JSON.stringify(info)}`)
      } else if (!this.checkCorrectGameDataInfoPrizesLN(info.prizes)) {
        throw new BadRequestException(`Invalid info, prize incorrect format: ${JSON.stringify(info)}`)
      }
    } else {
      throw new BadRequestException(`Invalid info, prizes not found: ${JSON.stringify(info)}`)
    }
  }

  private getPrizeResultByCodeLN(game: Game, ticket: Ticket, prizes: LNGameDataInfoPrize[]): LNGameDataInfoPrize {
    const ticketNumber = ticket.data?.info?.number;
    const hasPrize = prizes.find(el => {
      const numberA = el.number;
      const numberB = ticketNumber;
      const numberC = ticketNumber.slice(numberB.length - numberA.length);
      return el.number === numberC
    });
    return {
      number: ticket.data.info.number,
      quantity: hasPrize?.quantity || 0
    }
  }
}
