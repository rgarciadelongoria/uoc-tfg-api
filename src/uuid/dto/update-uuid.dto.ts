import { PartialType } from '@nestjs/swagger';
import { CreateUuidDto } from './create-uuid.dto';

export class UpdateUuidDto extends PartialType(CreateUuidDto) {}
