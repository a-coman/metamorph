import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUrl,
  Min,
  IsArray,
  ArrayMinSize,
  IsString,
  IsIn,
} from 'class-validator';
import { TRANSFORM_FAMILIES } from '@metamorph/core';
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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn([...TRANSFORM_FAMILIES], { each: true })
  transformFamilies?: string[];
}
