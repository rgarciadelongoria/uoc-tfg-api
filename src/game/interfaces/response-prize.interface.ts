import { Ticket } from "../../ticket/entities/ticket.entity";
import { Game } from "../entities/game.entity";
import { LNGameDataInfoPrize } from "./game-data.interface";

export interface ResponsePrize {
    ticket: Ticket,
    game: Game,
    prize: LNGameDataInfoPrize // Add other game prizes interfaces here with || operator
}