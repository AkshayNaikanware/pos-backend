import { IsIn, IsInt, IsUUID, Max, Min } from 'class-validator';

export class AdjustInventoryDto {
  @IsUUID()
  productId: string;

  // SET = stock becomes `quantity`; ADD = add `quantity` (can be negative)
  @IsIn(['SET', 'ADD'])
  mode: 'SET' | 'ADD';

  @IsInt() @Min(-1000000) @Max(1000000)
  quantity: number;
}
