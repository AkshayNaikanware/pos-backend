export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface ChargeRequest {
  saleId: string;
  amount: string; // "123.45"
  currency: string;
  /** Test hook. Only the mock provider honours it; real providers ignore it. */
  simulate?: 'SUCCESS' | 'FAILED';
}

export interface ChargeResult {
  provider: string;
  providerReference: string | null;
  status: 'SUCCESS' | 'FAILED';
  response: Record<string, unknown>;
}

/** Anything that can take money. Sales code only ever sees this interface. */
export interface PaymentProvider {
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}
