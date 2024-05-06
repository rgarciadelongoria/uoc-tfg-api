import { IsDate, IsJSON, IsMongoId, IsObject, IsOptional, IsString, MinLength } from "class-validator";
import { ObjectId } from "mongoose";
import { TicketData } from "../interfaces/ticket-data.interface";

export class CreateTicketDto {
    @IsString()
    @IsOptional()
    code: string;
    @IsDate()
    @IsOptional()
    date?: Date;
    @IsMongoId()
    @IsOptional()
    user?: ObjectId;
    @IsObject()
    data?: TicketData;
}
