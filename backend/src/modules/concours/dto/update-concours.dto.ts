import { PartialType } from '@nestjs/mapped-types';
import { CreateConcoursDto } from './create-concours.dto';

export class UpdateConcoursDto extends PartialType(CreateConcoursDto) {}
