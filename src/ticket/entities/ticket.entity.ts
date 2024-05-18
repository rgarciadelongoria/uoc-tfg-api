import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document } from 'mongoose';
import { TicketData } from "../interfaces/ticket-data.interface";
import { now } from 'mongoose';

@Schema()
export class Ticket extends Document {
	@Prop({
		index: true,
	})
	code: string;
    
    @Prop({
        index: true,
    })
    date: Date;

    @Prop({
        required: true,
		index: true,
    })
    user: string;

    @Prop({
        type: mongoose.Schema.Types.Mixed,
    })
    data: TicketData;

    @Prop({default: now()})
    createdAt: Date;
    @Prop({default: now()})
    updatedAt: Date;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);