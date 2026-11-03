import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested,
} from 'class-validator';

export class SaleItemDto {
  @IsUUID()
  productId: string;

  @IsInt() @Min(1) @Max(10000)
  quantity: number;
  // NOTE: there is deliberately no price field. Prices are read server-side,
  // and `forbidNonWhitelisted` rejects any request that tries to send one.
}

export class CreateSaleDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  /** Test hook for the mock payment provider. Real providers ignore it. */
  @IsOptional() @IsIn(['SUCCESS', 'FAILED'])
  simulatePayment?: 'SUCCESS' | 'FAILED';
}
