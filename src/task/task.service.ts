import { HttpService } from '@nestjs/axios/dist';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom, take } from 'rxjs';
import { Model } from 'mongoose';
import { Game } from '../game/entities/game.entity';
import { ValidCodes } from '../game/enums/valid-codes.enum';
import { LNGameDataInfoPrize } from '../game/interfaces/game-data.interface';
import { getAccessToken } from '../common/utils/utils';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Push } from '../push/entities/push.entity';
import { GameNames } from '../game/game.service';

const cheerio = require('cheerio');

@Injectable()
export class TaskService {
    private readonly logger = new Logger(TaskService.name);
    private readonly maxGamesWithoutPrizes = 10;
    private hasWorking = false;

    /*
    LN variables
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
        await this.launchTaskLN();
    }

    /*
    LN tasks
    */

    // Runs every 15 minutes the thursdays and saturdays
    @Cron('0 */15 * * * 4,6', { name: 'handleIntervalLN'})
    async handleIntervalLN() {
        await this.launchTaskLN();
    }

    public async launchTaskLN() {
        if (!!process.env.RUN_TASKS && !this.hasWorking) {
            this.logger.log(`[LN]: Getting new info task started ${new Date().toISOString()}...`);
            this.hasWorking = true;
            await this.gettingInfoWithPrizesLN(); // Get new info with prizes
            await this.gettingInfoWithoutPrizesLN(); // Get new info without prizes
            this.hasWorking = false;
            this.logger.log(`[LN]: Getting new info task ended at ${new Date().toISOString()}...`);
        }
    }

    // WITH PRIZES

    private async gettingInfoWithPrizesLN() {
        let latestFameIdWithPrizes = '';
        let stop = false;
        do {
            const nextGameIdWithPrizes = await this.findNextGameIdWithPrizesLN();
            stop = (latestFameIdWithPrizes === nextGameIdWithPrizes);
            if (!stop) {
                const gameData = await this.findGameDataByGameId(nextGameIdWithPrizes);
                const game = await this.setGameData(gameData);
            }
            latestFameIdWithPrizes = nextGameIdWithPrizes;
        } while (!stop);
    }

    private async findNextGameIdWithPrizesLN() {
        // Get latest game by date with prizes
        let nextGameWithPrizes = await this.gameModel.findOne({
            $and: [
                { 'data.info.raw': { $exists: true } },
                { 'data.info.prizes': { $exists: true, $ne: [] } },
            ]
        }).sort({ date: -1 }).exec();

        if (!nextGameWithPrizes) { // Nothing found
            const defaultId = '1209609064'
            this.logger.error(`[LN]: Next game with prizes not found, using default game id: ${defaultId}`);
            return defaultId;
        } else {
            this.logger.log(`[LN]: Next game with prizes found, id: ${nextGameWithPrizes._id}`);
            const raw = JSON.parse(JSON.stringify(JSON.parse(nextGameWithPrizes.data?.info?.raw || {})));
            return raw?.drawIdSorteoSiguiente || null;
        }
    }

    // WITHOUT PRIZES

    private async gettingInfoWithoutPrizesLN() {
        const numberOfGamesWithoutPrizes = await this.getNumberOfGamesWithoutPrizes();
        let maxGamesWithoutPrizes = (this.maxGamesWithoutPrizes - numberOfGamesWithoutPrizes) || 0;
        while (maxGamesWithoutPrizes > 0) {
            const nextGameIdWithoutPrizes = await this.findNextGameIdWithoutPrizesLN();
            const gameData = await this.findGameDataByGameId(nextGameIdWithoutPrizes);
            const game = await this.setGameData(gameData);
            maxGamesWithoutPrizes--;
        }
    }

    private async findNextGameIdWithoutPrizesLN() {
        // Get latest game by date without prizes
        let nextGameWithoutPrizes = await this.gameModel.findOne({
            $and: [
                { 'data.info.raw': { $exists: true } },
                { 'data.info.prizes': { $exists: true, $eq: [] } },
            ]
        }).sort({ date: -1 }).exec();

        if (!nextGameWithoutPrizes) {
            // If not found game without prizes, get the next game with prizes
            return await this.findNextGameIdWithPrizesLN();
        } else {
            this.logger.log(`[LN]: Next game without prizes found, id: ${nextGameWithoutPrizes._id}`);
            const raw = JSON.parse(JSON.stringify(JSON.parse(nextGameWithoutPrizes.data.info.raw)));
            return raw?.drawIdSorteoSiguiente || null;
        }
    }

    // COMMON

    private async getNumberOfGamesWithoutPrizes() {
        return await this.gameModel.countDocuments({
            $and: [
                { 'data.info.raw': { $exists: true } },
                { 'data.info.prizes': { $exists: true, $eq: [] } },
            ]
        }).exec();
    }

    private async findGameDataByGameId (gameId: string) {
        // const urlData1 = `https://www.loteriasyapuestas.es/servicios/resultados2?idsorteo=${gameId}`;
        // const { data: data1 } = await firstValueFrom(this.httpService.get(urlData1));
        // const urlData2 = `https://www.loteriasyapuestas.es/servicios/premioDecimoWeb?idsorteo=${gameId}`;
        // const { data: data2 } = await firstValueFrom(this.httpService.get(urlData2));
        // return { data1, data2 };


        var requestOptions = {
            method: 'GET',
            redirect: 'follow'
        };

        // Important: Don´t use this data
        const urlData1 = await fetch(`https://www.loteriasyapuestas.es/servicios/resultados1?idsorteo=${gameId}`, (requestOptions as any))
        const data1 = JSON.parse(await urlData1.text());
        // This, data2 is the best data to get the date of the game
        const urlData2 = await fetch(`https://www.loteriasyapuestas.es/servicios/resultados2?idsorteo=${gameId}`, (requestOptions as any))
        const data2 = JSON.parse(await urlData2.text());
        const urlData3 = await fetch(`https://www.loteriasyapuestas.es/servicios/premioDecimoWeb?idsorteo=${gameId}`, (requestOptions as any))
        const data3 = JSON.parse(await urlData3.text());
        return { data1, data2, data3 };
    }

    private async setGameData(gameData) {
        const {data1, data2, data3} = gameData;
        const gameDate = (new Date(data2.fechaSorteo)).setUTCHours(0,0,0,0);
        const gameExist = await this.gameModel.findOne({date: gameDate}).exec(); // Check if game already exists
        const gamePrizes = this.extractPrizesFromRawDataLN(data1, data2, data3);
        
        if (gameExist) {
            if ((!gameExist.data ||
                !gameExist.data.info ||
                !Array.isArray(gameExist.data.info.prizes) ||
                !gameExist.data.info.prizes.length ||
                !gameExist.data.info.prizes[0].number) && // Sometimes get incomplete Prizes
                (gamePrizes.length)
            ) {
                this.logger.log(`[LN]: Updating game with date ${data2.fechaSorteo} already exist. Updating game with id: ${gameExist._id}`);
                const game = await this.gameModel.findByIdAndUpdate(gameExist._id, {
                    data: {
                        info: {
                            raw: JSON.stringify(data2),
                            prizes: gamePrizes,
                            gameId: data2.drawIdSorteo || '',
                        }
                    }
                });
                this.logger.log(`[LN]: Game with id: ${game._id} updated`);
                
                // Send notification for all tickets of this game if has prizes
                const pushTokens = await this.getPushTokensForGame(game.date.toString(), game.code);
                const uniquePushTokens = Array.from(new Set(pushTokens));
                let gameName = '';
                GameNames.forEach(([code, name]) => {
                    if (code === game.code) {
                        gameName = name;
                    }
                });

                uniquePushTokens.forEach(token => {
                    const date = `${game.date.getDate()}/${game.date.getMonth() + 1}/${game.date.getFullYear()}`
                    this.sendNotification(
                        token,
                        'NOTIFICATION_NEW_DATA_TITLE',
                        'NOTIFICATION_NEW_DATA_BODY',
                        [gameName],
                        [gameName, date]
                    );
                });
            } 
        } else {
            this.logger.log(`[LN]: Creating game with date ${data2.fechaSorteo} already exist.`);
            const game = await this.gameModel.create({
                code: ValidCodes.LOTERIA_NACIONAL,
                date: gameDate,
                data: {
                    info: {
                        raw: JSON.stringify(data2),
                        prizes: gamePrizes,
                        gameId: data2.drawIdSorteo || '',
                    }
                }
            });
            this.logger.log(`[LN]: Game created with id: ${game._id}`);
        }
    }

    /*
    Transform raw data to our prizes format
    */
    private extractPrizesFromRawDataLN(data1: any, data2: any, data3: any): LNGameDataInfoPrize[] {

        let prizes: LNGameDataInfoPrize[] = [];

        const primerPremio = data2.primerPremio || null;

        if (primerPremio) {
            const prize: LNGameDataInfoPrize = {
                number: primerPremio.decimo?.toString() || '',
                quantity: primerPremio.prize || 0,
            }
            prizes.push(prize);
        }

        const segundoPremio = data2.segundoPremio || null;

        if (segundoPremio) {
            const prize: LNGameDataInfoPrize = {
                number: segundoPremio.decimo?.toString() || '',
                quantity: segundoPremio.prize || 0,
            }
            prizes.push(prize);
        }

        const tercerosPremios = data2.tercerosPremios || [];
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(tercerosPremios));
        
        const cuartosPremios = data2.cuartosPremios || [];
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(cuartosPremios));
        
        const quintosPremios = data2.quintosPremios || [];
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(quintosPremios));

        prizes = prizes.concat(this.formatRawExtraPrizesDataLN(data3));  // Extract extra prizes data
        
        const extraccionesDeCuatroCifras = data2.extraccionesDeCuatroCifras || [];
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(extraccionesDeCuatroCifras));
        
        const extraccionesDeTresCifras = data2.extraccionesDeTresCifras || [];
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(extraccionesDeTresCifras));
        
        const extraccionesDeDosCifras = data2.extraccionesDeDosCifras || [];
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(extraccionesDeDosCifras));

        const reintegros = data2.reintegros || [];
        prizes = prizes.concat(this.formatRawDataPrizeArrayLN(reintegros));
        
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

    private sendNotification(deviceToken: string, title: string, body: string, titleArgs: string[] = [], bodyArgs: string[] = []) {
        getAccessToken().then((accessToken) => {
            const data = {
                message:{
                    token: deviceToken,
                    android: {
                        priority: 'high',
                        notification: {
                            "title_loc_key" : title,
                            "title_loc_args" : titleArgs,
                            "body_loc_key" : body,
                            "body_loc_args" : bodyArgs
                        }
                    },
                    apns: {
                        payload: {
                            aps : {
                                alert : {
                                    "title-loc-key" : title,
                                    "title-loc-args" : titleArgs,
                                    "loc-key" : body,
                                    "loc-args" : bodyArgs
                                }
                            }
                        }
                    },
                }
            };
            const headers = {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }

            try {
                const response$ = this.httpService.post(
                    'https://fcm.googleapis.com/v1/projects/lookttery/messages:send', 
                    data,
                    {headers}
                );
                response$.pipe(
                    take(1)
                ).subscribe({
                    next: response => {
                        this.logger.log(`[LN]: Notification to ${deviceToken} was sent: ${response.data}`);
                    },
                    error: error => {
                        this.logger.error(`[LN]: Error sending notification: ${error}`);
                    }
                });
            } catch (error) {
                this.logger.error(`[LN]: Error sending notification: ${error}`);
            }
        });
    }

    private async getPushTokensForGame(date: string, code: string): Promise<string[]> {
        const tickets = await this.ticketModel.find({ date, code }).exec();
        const ticketUserIds = tickets.map(ticket => ticket.user);
    
        const pushes = await this.pushModel.find({ user: { $in: ticketUserIds } }).exec();
        const pushTokens = pushes.map(push => push.token);
    
        return pushTokens;
    }
}