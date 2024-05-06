// LN

export interface LNGameDataInfoPrize {
    number: string;
    quantity: number;
}

export interface LNGameDataInfo {
    gameId: string;
    prizes: LNGameDataInfoPrize[];
    raw: any; // Data from external API
    extraData: any; // Data from external API
}

// General

export interface GameData {
    info: LNGameDataInfo; // Add other game interfaces here with || operator
}