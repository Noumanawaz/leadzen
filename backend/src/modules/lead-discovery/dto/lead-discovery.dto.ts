import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { LeadSourceType } from '../../../../generated/prisma/client';

export class CreateLeadSourceDto {
  @IsEnum(LeadSourceType) type!: LeadSourceType;
  @IsString() name!: string;
  @IsOptional() @IsString() integrationId?: string;
  @IsOptional() @IsObject() configuration?: Record<string, unknown>;
}

export class UpdateImportMappingDto {
  @IsObject() mapping!: Record<string, string>;
  @IsOptional()
  @IsEnum(['skip', 'merge', 'update', 'create'] as const)
  duplicatePolicy?: 'skip' | 'merge' | 'update' | 'create';
}

export class PlacesSearchDto {
  @IsString() textQuery!: string;
  @IsOptional() @IsNumber() @Min(1) maxResultCount?: number;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsNumber() radiusMeters?: number;
}

export class PlacesImportDto {
  @IsArray()
  places!: Array<Record<string, unknown>>;
}

export class ApolloConnectDto {
  @IsString() apiKey!: string;
  @IsOptional() @IsString() label?: string;
}

export class ApolloSearchDto {
  @IsOptional() @IsString() qKeywords?: string;
  @IsOptional() @IsArray() personTitles?: string[];
  @IsOptional() @IsArray() personLocations?: string[];
  @IsOptional() @IsNumber() page?: number;
}

export class ApolloImportDto {
  @IsArray()
  people!: Array<Record<string, unknown>>;
}

export class CreateLeadFormDto {
  @IsString() name!: string;
  @IsOptional() fields?: unknown;
  @IsOptional() automation?: unknown;
  @IsOptional() spamSettings?: unknown;
}

export class CreateReferralLinkDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() pipelineId?: string;
  @IsOptional() @IsString() sequenceId?: string;
}

export class CreateApiKeyDto {
  @IsString() name!: string;
}

export class PublicLeadIngestDto {
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() sourceName?: string;
}

export class GooglePlacesConnectDto {
  @IsString() apiKey!: string;
  @IsOptional() @IsString() label?: string;
}
