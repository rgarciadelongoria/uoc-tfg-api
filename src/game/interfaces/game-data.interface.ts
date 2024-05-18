// LN

export interface LNGameDataInfoPrize {
    number: string;
    quantity: number;
    prizeType?: string;
}

// PR

export interface PRGameDataInfoPrizeCategory {
    category: string;
    quantity: number;
    winners: number;
} 

export interface PRGameDataInfoPrize {
    combination: string;
    categories: PRGameDataInfoPrizeCategory[];
    categoriesJoker: PRGameDataInfoPrizeCategory[];
    jackpot: number;
    bets: number;
    collection: number;
    prizesTotal: number;
    jackpotPool: number;
    jokerGameId: string;
    jokerAssociatedGameId: string;
    jokerJackpot: number;
    jokerCombination: string;
}

// General


export interface GameDataInfo {
    gameId: string;
    prizes: LNGameDataInfoPrize[] | PRGameDataInfoPrize[];
    raw: any; // Data from external API
    completePrizesListRaw?: string;
}

export interface GameData {
    info: GameDataInfo; // Add other game interfaces here with || operator
}