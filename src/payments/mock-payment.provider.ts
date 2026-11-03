import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ChargeRequest, ChargeResult, PaymentProvider } from './payment-provider.interface';

/** Simulates a gateway. Succeeds unless `simulate: 'FAILED'` is requested. */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK';

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const outcome = request.simulate ?? 'SUCCESS';
    const ok = outcome === 'SUCCESS';
    return {
      provider: this.name,
      providerReference: ok ? `MOCK-${randomUUID()}` : null,
      status: outcome,
      response: ok
        ? { approved: true, amount: request.amount, currency: request.currency }
        : { approved: false, reason: 'MOCK_DECLINED', amount: request.amount },
    };
  }
}
