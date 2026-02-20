import { IsString, IsArray, IsOptional, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class CreateEquipeDto {
  @IsString()
  concoursId: string;

  @IsOptional()
  @IsString()
  nom?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  joueurIds: string[];
}
