import { IsMongoId, IsString } from "class-validator";
import { ObjectId } from "mongoose";

export class CreatePushDto {
    @IsString()
    token: string;
    @IsMongoId()
    user: ObjectId;
}
