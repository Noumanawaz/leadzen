import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CompanyContactRole } from '../../../../generated/prisma/client';

export class CreateCompanyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsInt() employeeCount?: number;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() revenueRange?: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateCompanyDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsInt() employeeCount?: number;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() revenueRange?: string;
  @IsOptional() @IsString() description?: string;
}

export class LinkCompanyContactDto {
  @IsString()
  contactId!: string;

  @IsEnum(CompanyContactRole)
  role!: CompanyContactRole;

  @IsOptional()
  isPrimary?: boolean;

  @IsOptional() @IsString() title?: string;
}

export class CreateContactDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() jobTitle?: string;
}
