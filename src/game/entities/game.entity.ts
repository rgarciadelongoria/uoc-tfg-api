import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document } from 'mongoose';
import { GameData } from "../interfaces/game-data.interface";
import { ValidCodes } from "../enums/valid-codes.enum";
import { now } from 'mongoose';

@Schema()
export class Game extends Document {
	@Prop({
		required: true,
		index: true,
	})
	code: ValidCodes;
    
    @Prop({
        required: true,
        index: true,
    })
    date: Date;

    @Prop({
        type: mongoose.Schema.Types.Mixed,
    })
    data: GameData;
    
    @Prop({default: now()})
    createdAt: Date;
    @Prop({default: now()})
    updatedAt: Date;  
}

export const GameSchema = SchemaFactory.createForClass(Game);
