import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
    @IsEmail()
    email: string;
    @IsString()
    @MinLength(1)
    password: string;
    @IsString()
    @MinLength(1)
    name: string;
    @IsArray()
    @IsOptional()
    roles: string[];
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

