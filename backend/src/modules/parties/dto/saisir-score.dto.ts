import { IsInt, Min, Max } from 'class-validator';

export class SaisirScoreDto {
  @IsInt()
  @Min(0)
  @Max(13)
  scoreA: number;

  @IsInt()
  @Min(0)
  @Max(13)
  scoreB: number;
}
