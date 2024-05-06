import { IsMongoId, IsString, IsUUID } from "class-validator";
import { ObjectId } from "mongoose";

export class CreateUuidDto {
    @IsString()
    uuid: string;
    @IsMongoId()
    user: ObjectId;
}
