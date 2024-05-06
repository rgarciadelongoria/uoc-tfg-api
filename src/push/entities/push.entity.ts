import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from 'mongoose';

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
}

export const PushSchema = SchemaFactory.createForClass(Push);