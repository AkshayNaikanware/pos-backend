import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  sku: string;

  @IsString() @IsNotEmpty() @MaxLength(180)
  name: string;

  @IsOptional() @IsString()
  description?: string;

  // price as a string with up to 2 decimals, e.g. "199.00"
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, { message: 'price must be like 199 or 199.50' })
  price: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
