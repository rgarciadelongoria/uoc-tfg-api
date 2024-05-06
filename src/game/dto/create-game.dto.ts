import { IsDate, IsObject, IsString, MinLength } from "class-validator";
import { GameData } from "../interfaces/game-data.interface";

export class CreateGameDto {
    @IsString()
    @MinLength(1)
    code: string;
    @IsDate()
    date: Date;
    @IsObject()
    data: GameData;
}
