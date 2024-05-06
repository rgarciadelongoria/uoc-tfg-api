import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Model } from "mongoose";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { User } from "../entities/user.entity";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<User>
    ) {
        super({
            secretOrKey: process.env.JWT_SECRET,
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
        });
    }
    async validate(payload: JwtPayload): Promise<User> {

        const { id } = payload;

        const user = await this.userModel.findById(id)
            .select('+id')
            .exec()

        if (!user) {
            throw new UnauthorizedException(`Token not valid`);
        }

        if (!user.isActive) {
            throw new UnauthorizedException(`User is not active`);
        }

        return user;
    }
}