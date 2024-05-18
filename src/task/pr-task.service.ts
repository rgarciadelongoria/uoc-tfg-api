import { HttpService } from '@nestjs/axios/dist';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom, take } from 'rxjs';
import { Model } from 'mongoose';
import { Game } from '../game/entities/game.entity';
import { ValidCodes } from '../game/enums/valid-codes.enum';
import { PRGameDataInfoPrize } from '../game/interfaces/game-data.interface';
import { getAccessToken } from '../common/utils/utils';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Push } from '../push/entities/push.entity';
import { GameNames } from '../game/game.service';

const cheerio = require('cheerio');

@Injectable()
export class PrTaskService {
    private readonly logger = new Logger(PrTaskService.name);
    private readonly maxGamesWithoutPrizes = 10;
    private hasWorking = false;

    /*
    PR variables
    */
    
    constructor(
        @InjectModel(Game.name)
        private readonly gameModel: Model<Game>,
        @InjectModel(Ticket.name)
        private readonly ticketModel: Model<Ticket>,
        @InjectModel(Push.name)
        private readonly pushModel: Model<Push>,
        private readonly httpService: HttpService
    ) {}

    async onModuleInit() {
        await this.launchTaskPR();
    }

    /*
    PR tasks
    */

    // Runs every 15 minutes the mondays, thursdays and saturdays
    @Cron('0 */15 * * * 1,4,6', { name: 'handleIntervalPR'})
    async handleIntervalPR() {
        await this.launchTaskPR();
    }

    public async launchTaskPR() {
        if (!!process.env.RUN_TASKS && !this.hasWorking) {
            this.logger.log(`[PR]: Getting new info task started ${new Date().toISOString()}...`);
            this.hasWorking = true;
            await this.gettingInfoPR();
            this.hasWorking = false;
            this.logger.log(`[PR]: Getting new info task ended at ${new Date().toISOString()}...`);
        }
    }

    private async gettingInfoPR() {
        const latestGamesPR = await this.getLatestGamesPR();
        for (let i = 0; i < latestGamesPR.data1.length; i++) {
            const gameData = latestGamesPR.data1[i];
            await this.setGameDataPR(gameData);
        }
    }

    private async getLatestGamesPR() {
        var requestOptions = {
            method: 'GET',
            redirect: 'follow'
        };

        const urlData1 = await fetch(`https://www.loteriasyapuestas.es/servicios/buscadorUltimosSorteosCelebradosPrimitiva`, (requestOptions as any))
        const data1 = JSON.parse(await urlData1.text());
        
        return {data1};
    }

    private async setGameDataPR(gameData) {
        const gameDate = (new Date(gameData.fecha_sorteo)).setUTCHours(0,0,0,0);
        const gameExist = await this.gameModel.findOne({
            $and: [
                { 'code': ValidCodes.LA_PRIMITIVA },
                { 'date': gameDate }
            ]
        }).exec();
        if (!gameExist) {
            this.logger.log(`[PR]: Creating game with date ${gameData.fecha_sorteo}`);
            const game = await this.gameModel.create({
                code: ValidCodes.LA_PRIMITIVA,
                date: gameDate,
                data: {
                    info: {
                        raw: JSON.stringify(gameData),
                        prizes: this.extractPrizesFromRawDataPR(gameData),
                        gameId: gameData.id_sorteo || '',
                    }
                }
            });
            this.logger.log(`[PR]: Game created with id: ${game._id}`);
        } else {
            this.logger.log(`[PR]: Game with date ${gameData.fecha_sorteo} already exist.`);
        }
    }

    private extractPrizesFromRawDataPR(gameData): PRGameDataInfoPrize[] {
        let prizes: PRGameDataInfoPrize[] = [];

        const combination = gameData.combinacion || null;
        const categories = gameData.escrutinio || [];
        const categories_joker = gameData.escrutinio_joker || [];

        if (combination && categories.length) {
            const prize: PRGameDataInfoPrize = {
                combination: combination,
                categories: categories.map(category => ({
                    category: category.categoria || '',
                    quantity: category.premio || 0,
                    winners: category.ganadores || 0,
                })),
                categoriesJoker: categories_joker.map(category => ({
                    category: category.orden_escrutinio || '',
                    quantity: category.premio || 0,
                    winners: category.ganadores || 0,
                })),
                jackpot: gameData.premio_bote || 0,
                bets: gameData.apuestas || 0,
                collection: gameData.recaudacion || 0,
                prizesTotal: gameData.premios || 0,
                jackpotPool: gameData.fondo_bote || 0,
                jokerGameId: gameData.joker?.gameid || '',
                jokerAssociatedGameId: gameData.joker?.relsorteoid_asociado || '',
                jokerJackpot: gameData.joker?.bote_joker || 0,
                jokerCombination: gameData.joker?.combinacion || ''
            }
            prizes.push(prize);
        }

        return prizes;
    }

    // TODO: Move this to a service
    private async getPushTokensForGame(date: string, code: string): Promise<string[]> {
        const tickets = await this.ticketModel.find({ date, code }).exec();
        const ticketUserIds = tickets.map(ticket => ticket.user);
    
        const pushes = await this.pushModel.find({ user: { $in: ticketUserIds } }).exec();
        const pushTokens = pushes.map(push => push.token);
    
        return pushTokens;
    }
}