import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ValidRoles } from '../enums/valid-roles.enum';

@Schema()
export class User extends Document {
	@Prop({
		required: true,
		unique: true,
		index: true,
	})
  	email: string;

	@Prop({
		select: false,
		required: true,
	})
  	password: string;
	
	@Prop({
		required: true,
	})
	name: string;

	@Prop({
		required: true,
		default: [ValidRoles.USER],
	})
	roles: string[];

	@Prop({
		boolean: true,
		required: false,
		default: true,
	})
	isActive?: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
