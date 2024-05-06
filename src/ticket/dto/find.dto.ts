import { IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class FindDto extends PaginationDto {
    @IsOptional()
    @IsString()
    code: string;
}