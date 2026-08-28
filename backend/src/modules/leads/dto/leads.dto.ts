import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { LeadStatus } from '../../../../generated/prisma/client';

export class CreateLeadDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() pipelineId?: string;
  @IsOptional() @IsString() pipelineStageId?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() tagIds?: string[];
}

export class UpdateLeadDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsInt() @Min(0) leadScore?: number;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() pipelineId?: string | null;
  /** Pass empty string to clear stage (unassigned). */
  @IsOptional() @IsString() pipelineStageId?: string;
  @IsOptional() @IsString() timezone?: string;
}

export class CreateNoteDto {
  @IsString()
  body!: string;
}
