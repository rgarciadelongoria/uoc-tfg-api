import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from 'mongoose';
import { now } from 'mongoose';

@Schema()
export class Push extends Document {
    @Prop({
        required: true,
        index: true,
    })
    token: string;
    
    @Prop({
        required: true,
        index: true,
    })
    user: string;

    @Prop({default: now()})
    createdAt: Date;
    @Prop({default: now()})
    updatedAt: Date;
}

export const PushSchema = SchemaFactory.createForClass(Push);