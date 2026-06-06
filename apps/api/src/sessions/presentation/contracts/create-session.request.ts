import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUrl,
  Min,
} from 'class-validator';
import { SessionMode } from '../../domain/enums/session-mode.enum.js';

export class CreateSessionRequest {
  @IsUrl()
  url!: string;

  @IsOptional()
  @IsEnum(SessionMode)
  mode?: SessionMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  generateCount?: number;

  @IsOptional()
  @IsBoolean()
  weakOracle?: boolean;
}
