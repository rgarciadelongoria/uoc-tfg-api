import { IsNumber, IsOptional, IsPositive, IsString, Min } from "class-validator";

export class PaginationDto {
    @IsOptional()
    @IsNumber()
    @IsPositive()
    @Min(1)
    limit: number;
    @IsOptional()
    @IsNumber()
    offset: number;
}