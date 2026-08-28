import { IsArray, IsBoolean, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class StageInput {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class CreatePipelineDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageInput)
  stages!: StageInput[];
}

export class CreateDealDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  pipelineId!: string;

  @IsString()
  stageId!: string;

  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() value?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() probability?: number;
  @IsOptional() @IsString() ownerId?: string;
}

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() assignedTo?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() dueAt?: string;
  @IsOptional() @IsString() priority?: string;
}

export class UpdateDealStatusDto {
  @IsString()
  status!: 'open' | 'won' | 'lost';
}
