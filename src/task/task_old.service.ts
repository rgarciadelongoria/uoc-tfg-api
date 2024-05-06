import { HttpService } from '@nestjs/axios/dist';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { Model } from 'mongoose';
import { Game } from '../game/entities/game.entity';
import { ValidCodes } from '../game/enums/valid-codes.enum';
import { LNGameDataInfoPrize } from '../game/interfaces/game-data.interface';

const cheerio = require('cheerio');

@Injectable()
export class TaskService {
    private debugOneTime = false; // false for production

    private readonly logger = new Logger(TaskService.name);
    private hasWorking = false;
    private running = false;

    /*
    LN variables
    */
    private controlRepeatedGameId = '';
    // private numLatestExtraDataGamesToUpload = 10; // Number of latest games to upload extra data
    private numFutureGames = 3; // Number of future games to add, init on 0
    
    constructor(
        @InjectModel(Game.name)
        private readonly gameModel: Model<Game>,
        private readonly httpService: HttpService
    ) {}

    /*
    LN tasks
    */

    // Runs every 2 seconds
    // @Cron('*/2 * * * * *', { name: 'handleIntervalLN'})

    // Runs every day at 00:00
    @Cron('0 0 0 * * *', { name: 'handleIntervalLN'})
    async handleIntervalLN() {
        if (!this.debugOneTime || !this.running) {
            this.running = true;
            if (!!process.env.RUN_TASKS && !this.hasWorking) {
                this.hasWorking = true;
                await this.downloadDataTaskLN(); // Download LN games raw data
                this.hasWorking = false;
            }
        }
    }

    /*
    Download LN games raw data
    */
    public async downloadDataTaskLN() {
        this.logger.debug(`>>> LN create game task started at ${new Date().toISOString()}...`);
        let continueCreatingGames = true;
        do {
            const nextGameData = await this.findNextGameLN();
            if (!nextGameData) {
                this.logger.debug('No more games to create');
                break;
            }
            continueCreatingGames = await this.createGameLN(nextGameData.data, nextGameData.prizesData);
        } while (continueCreatingGames);
        this.logger.debug('>>> LN create game task ends at ' + new Date().toISOString());
    }

    /*
    Create LN games from raw data
    */
    private async createGameLN(gameData, prizesData): Promise<boolean> {
        const gameDate = new Date(gameData.fechaSorteo);
        gameDate.setUTCHours(0,0,0,0);

        const gameExist = await this.gameModel.findOne({date: gameDate}).exec();

        // Exist game with date and has raw data and has prizes
        if (gameExist && gameExist.data?.info?.raw && gameExist.data?.info?.prizes?.length > 0) {
            this.logger.debug(`Game with date ${gameData.fechaSorteo} already exist with id: ${gameExist._id}`);
            return false;

        // Exist game with date and has raw data but has no prizes
        } else if (gameExist && gameExist.data?.info?.raw && (gameExist.data?.info?.prizes?.length === 0 || !gameExist.data?.info?.prizes)) {
            this.logger.error(`Game with date ${gameData.fechaSorteo} already exist and has raw data but has no prizes`);
            const prizes = this.extractPrizesFromRawDataLN(gameData, prizesData);
            if (!prizes || prizes.length === 0) {
                this.logger.error(`Game with date ${gameData.fechaSorteo} has no new prizes`);
                return true;
            }
            const game = await this.gameModel.findByIdAndUpdate(gameExist._id, {
                data: {
                    info: {
                        raw: JSON.stringify(gameData),
                        prizes: prizes,
                    }
                }
            });
            this.logger.debug(`Game updated with id: ${game._id}`);
            return true;

        // Exist game with date but has no raw data
        } else {
            this.logger.error(`Game with date ${gameData.fechaSorteo} already exist and has no raw data`);
            const prizes = this.extractPrizesFromRawDataLN(gameData, prizesData);
            if (!prizes || prizes.length === 0) {
                this.logger.error(`Game with date ${gameData.fechaSorteo} has no new prizes`);
            }
            const game = await this.gameModel.create({
                code: ValidCodes.LOTERIA_NACIONAL,
                date: gameDate,
                data: {
                    info: {
                        raw: JSON.stringify(gameData),
                        prizes: prizes,
                        gameId: gameData.drawIdSorteo || '',
                    }
                }
            });
            this.logger.debug(`Game created with id: ${game._id}`);
            return true;
        }
    }

    /*
    Find next game raw data
    */
    private async findNextGameLN() {
        const nextGameId = await this.findNextGameIdLN();
        if (this.controlRepeatedGameId !== nextGameId) {
            this.controlRepeatedGameId = nextGameId;
            if (!nextGameId) {
                this.logger.error('Next game id not found');
                return null;
            } else {
                const url = `https://www.loteriasyapuestas.es/servicios/resultados2?idsorteo=${nextGameId}`;
                const { data: data } = await firstValueFrom(this.httpService.get(url));
                const url2 = `https://www.loteriasyapuestas.es/servicios/premioDecimoWeb?idsorteo=${nextGameId}`;
                const { data: prizesData } = await firstValueFrom(this.httpService.get(url2));
                return { data, prizesData };
            }
        } else  {
            this.logger.debug('Next game id is the same as last time');
            return null;
        }
    }

    /*
    Find next game id
    */
    private async findNextGameIdLN() {
        // Get latest game by date with prizes
        let game = await this.gameModel.findOne({
            $and: [
                { 'data.info.raw': { $exists: true } },
                { 'data.info.prizes': { $exists: true, $ne: [] } },
            ]
        }).sort({ date: -1 }).exec();

        if (!game) {
            const defaultId = '1209609064' // '1212409072';
            this.logger.error(`Latest game not found, using default id: ${defaultId}`);
            return defaultId; // Default first game
        } else if ((!game.data?.info?.raw)) {
            this.logger.error('Latest game raw data not found');
            return null; // Never should happen
        } else {
            this.logger.debug(`Latest game id: ${game._id}`);
            const raw = JSON.parse(JSON.stringify(JSON.parse(game.data.info.raw)));
            return raw?.drawIdSorteoSiguiente || null;
        }
    }

    /*
    Transform raw data to our prizes format
    */
    private extractPrizesFromRawDataLN(data: any, prizesData: any): LNGameDataInfoPrize[] {

        let prizes: LNGameDataInfoPrize[] = [];

        if (data.primerPremio) {
            const prize: LNGameDataInfoPrize = {
                number: data.primerPremio.decimo?.toString() || '',
                quantity: data.primerPremio.prize || 0,
            }
            prizes.push(prize);
        }

        if (data.segundoPremio) {
            const prize: LNGameDataInfoPrize = {
                number: data.segundoPremio.decimo?.toString() || '',
                quantity: data.segundoPremio.prize || 0,
            }
            prizes.push(prize);
        }
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(data.tercerosPremios));
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(data.cuartosPremios));
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(data.quintosPremios));
        prizes = prizes.concat(this.formatRawExtraPrizesDataLN(prizesData));  // Extract extra prizes data
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(data.extraccionesDeCuatroCifras));
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(data.extraccionesDeTresCifras));
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(data.extraccionesDeDosCifras));
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(data.reintegros));
        
        return prizes;
    }

    /*
    Transform raw data prize array to our prizes format
    */
    private formatRawDataPrizeArrayLN(rawDataPrizeArray: any[]): LNGameDataInfoPrize[] {
        const prizes: LNGameDataInfoPrize[] = [];
        if (Array.isArray(rawDataPrizeArray) && rawDataPrizeArray.length > 0) {
            rawDataPrizeArray.forEach(el => {
                const prize: LNGameDataInfoPrize = {
                    number: el.decimo?.toString() || '',
                    quantity: el.prize || 0,
                }
                prizes.push(prize);
            });
        }
        return prizes;
    }

    private formatRawExtraPrizesDataLN(rawPrizesData: any): LNGameDataInfoPrize[] {
        let prizes: LNGameDataInfoPrize[] = [];
        if (Array.isArray(rawPrizesData.compruebe) && rawPrizesData.compruebe.length > 0) {
            const rawPrizesDataArray = rawPrizesData.compruebe;
            // Type C prizes
            const typeCPrizesRaw = rawPrizesDataArray.filter(item => item.prizeType && item.prizeType.charAt(3) === 'C');
            const typeCPrizes: LNGameDataInfoPrize = typeCPrizesRaw.map(item => ({
                number: parseInt(item.decimo, 10).toString(),
                quantity: item.prize
            }));
            prizes = prizes.concat(typeCPrizes);
            // Type P5 prizes
            const typeP5PrizesRaw = rawPrizesDataArray.filter(item => item.prizeType && item.prizeType.charAt(0) === 'P' && item.prizeType.charAt(6) === '5');
            const typeP5Prizes: LNGameDataInfoPrize = typeP5PrizesRaw.map(item => ({
                number: parseInt(item.decimo, 10).toString(),
                quantity: item.prize
            }));
            prizes = prizes.concat(typeP5Prizes);
        }
        return prizes;
    }
}
