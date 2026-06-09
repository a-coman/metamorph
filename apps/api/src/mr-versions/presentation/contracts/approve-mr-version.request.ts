import { IsOptional, IsString, MinLength } from 'class-validator';

export class ApproveMrVersionRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  playbookContent?: string;
}
