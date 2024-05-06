import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from 'mongoose';

@Schema()
export class Uuid extends Document {
    @Prop({
        required: true,
        index: true,
    })
    uuid: string;
    
    @Prop({
        required: true,
        index: true,
    })
    user: string;
}

export const UuidSchema = SchemaFactory.createForClass(Uuid);
