import { IsBoolean, IsNumber, IsOptional, IsPositive, IsString, Min } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class FindDto extends PaginationDto {
    @IsOptional()
    @IsString()
    code: string;
    @IsOptional()
    @IsBoolean()
    onlyWithPrizes: boolean;
    @IsOptional()
    minDays: number;
    @IsOptional()
    maxDays: number;
}