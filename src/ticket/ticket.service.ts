import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Ticket } from './entities/ticket.entity';
import { User } from '../user/entities/user.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { isAdminOrSameUser, isCorrectCode } from '../common/utils/utils';
import { ValidCodes } from '../game/enums/valid-codes.enum';
import { ValidRoles } from '../user/enums/valid-roles.enum';
import { LNTicketDataInfo } from './interfaces/ticket-data.interface';
import { Game } from '../game/entities/game.entity';

@Injectable()
export class TicketService {
  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<Ticket>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(Game.name)
    private readonly gameModel: Model<Game>
  ) {}

  /*
  CRUD - Ticket
  */
  
  async create(createTicketDto: CreateTicketDto, userToken: User) {
    if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
      createTicketDto.user = userToken.id;
    } else {
      const user = await this.userModel.findById(createTicketDto.user).exec();
      if (!user) {
        throw new NotFoundException(`User not found: ${createTicketDto.user}`);
      }
    }

    // Check if ticket code exists
    const ticket = await this.ticketModel.findOne({
      'data.info.code': createTicketDto.data.info.code,
      'user': createTicketDto.user
    }).exec();
    if (ticket) {
      throw new BadRequestException({
        message: `Ticket already exists: ${createTicketDto.data.info.code}`,
        ticket: ticket
      });
    }


    // Get game code from ticket code
    const code = this.getGameCodeFromTicket(createTicketDto.data.info.code);
    if (!code) {
      throw new BadRequestException(`No game code found for this ticket: ${createTicketDto.data.info.code}`);
    } else {
      createTicketDto.code = code;
    }

    if (!isCorrectCode(createTicketDto.code)) {
      throw new BadRequestException(`Invalid code: ${createTicketDto.code}. Correct codes are: ${Object.values(ValidCodes).join(', ')}`);
    }

    // Get game number from ticket code
    if (code === ValidCodes.LOTERIA_NACIONAL) {
      // LN
      const number = this.getTicketNumberFromTicketLN(createTicketDto.data.info.code);
      if (!number) {
        throw new BadRequestException(`No game number found for this ticket: ${createTicketDto.data.info.code}`);
      } else {
        createTicketDto.data.info.number = number;
      }
    } else {
      // TODO: Get other game numbers
    }


    // Get game date from ticket code
    const date = await this.getGameDateFromTicketLN(createTicketDto.data.info.code);
    if (!date) {
      throw new BadRequestException(`No game found for this ticket: ${createTicketDto.data.info.code}`);
    } else {
      createTicketDto.date = date;
    }

    if (createTicketDto.data) {
      this.checkCorrectData(createTicketDto);
    }

    try {
      return await this.ticketModel.create(createTicketDto);
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
    return await this.ticketModel.find(queryFilters)
      .sort({ date: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  async findOne(id: string, userToken: User) {
    let ticket: Ticket;

    // Mongo Id
    if (isValidObjectId(id)) {
      // User only get own tickets
      if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
        ticket = await this.ticketModel.findOne({ _id: id, user: userToken.id }).exec();
      } else {
        // Admin get all tickets
        ticket = await this.ticketModel.findById(id).exec();
      }
    }

    if (!ticket) {
      throw new NotFoundException(`Ticket not found: ${id}`);
    }

    return ticket;
  }

  async update(id: string, updateTicketDto: UpdateTicketDto, userToken: User) {
    const ticket = await this.findOne(id, userToken);

    if (!isAdminOrSameUser(ticket.user, userToken)) {
      throw new UnauthorizedException(`You can't update this ticket`);
    } else if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
      // User can't change the id or the user
      if (updateTicketDto.user) {
        updateTicketDto.user = userToken.id;
      }
    }

    if (updateTicketDto.code) {
      if (!isCorrectCode(updateTicketDto.code)) {
        throw new BadRequestException(`Invalid code: ${updateTicketDto.code}. Correct codes are: ${Object.values(ValidCodes).join(', ')}`);
      }
    }

    if (updateTicketDto.data) {
      this.checkCorrectData(updateTicketDto);
    }

    try {
      await ticket.updateOne(updateTicketDto, {new: true});
      return { ...ticket.toJSON(), ...updateTicketDto };
    } catch (error) {
      this.handleException(error);
    }
  }

  async remove(id: string, userToken: User) {
    let ticket = await this.findOne(id, userToken);

    if (!isAdminOrSameUser(ticket.user, userToken)) {
      throw new UnauthorizedException(`You can't update this ticket`);
    }

    if (!isValidObjectId(id)) {
      throw new BadRequestException(`Invalid mongo id: ${id}`);
    }

    try {
      // User only delete own tickets
      if (!userToken.roles?.includes(ValidRoles.ADMIN)) {
        ticket = await this.ticketModel.findOneAndDelete({ _id: id, user: userToken.id }).exec();
      } else {
        // Admin delete all tickets
        ticket = await this.ticketModel.findByIdAndDelete(id).exec();
      }
    } catch (error) {
      this.handleException(error);
    }

    if (ticket) {
      return { message: `Ticket deleted: ${id}` };
    } else {
      throw new NotFoundException(`Ticket not found: ${id}`);
    }
  }  
  
  /*
  General logic
  */

  private handleException(error: any) {
    if (error.code === 11000) {
      throw new BadRequestException(`Ticket already exists: ${JSON.stringify(error.keyValue)}`);
    }
    console.log(error);
    throw new InternalServerErrorException(`Error, check server logs.`);
  }

  private checkTicketDataNumber(number: string) {
    // Test if number is a positive integer
    return (typeof number === 'string') && /^\d+$/.test(number); 
  }

  // Check TicketData structure
  private checkCorrectData(ticketDto: UpdateTicketDto | CreateTicketDto) {
    if (!ticketDto.data) {
      throw new BadRequestException(`Invalid data: ${JSON.stringify(ticketDto)}`);
    }

    if (!ticketDto.data.info) {
      throw new BadRequestException(`Invalid data, need info: ${JSON.stringify(ticketDto)}`);
    }

    // LN
    if (ticketDto.code === ValidCodes.LOTERIA_NACIONAL) {
      this.checkCorrectTicketDataInfoLN(ticketDto.data.info);
    }
  }

  // Get ticket game code from ticket code
  private getGameCodeFromTicket(code: string) {
    let gameCode = null;
    // Check LN game code
    gameCode = this.getGameCodeFromTicketLN(code);
    if (!code) {
      // TODO: Check other Games
    }
    return gameCode;
  }

  /*
  LN general logic
  */

  private async getGameDateFromTicketLN(code: string) {
    try {
      const regex = new RegExp(`${code.substring(1,4)}$`);
      const games = await this.gameModel.find({ 'data.info.gameId': regex }).exec();

      return (games.length > 0) ? games[0].date : null;
    } catch (error) {
      throw error;
    }
  }

  private getGameCodeFromTicketLN(code: string) {
    let isLN = false;
    if (code.length === 20) {
      isLN = true;
    }
    return isLN ? ValidCodes.LOTERIA_NACIONAL : null;
  }

  private getTicketNumberFromTicketLN(code: string) {
    return code.substring(11,16)
  }

  private checkCorrectTicketDataInfoLN(info: LNTicketDataInfo) {
    if (!this.checkTicketDataNumber(info.number)) {
      throw new BadRequestException(`Invalid number: ${JSON.stringify(info)}`);
    }
  }
}
