import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  PAYMENT_PROVIDER,
  type ChargeRequest,
  type ChargeResult,
  type PaymentProvider,
} from './payment-provider.interface';

/** Facade over the configured provider. A provider crash becomes a FAILED result. */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(@Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    try {
      return await this.provider.charge(request);
    } catch (e) {
      this.logger.error(`Provider ${this.provider.name} threw: ${(e as Error).message}`);
      return {
        provider: this.provider.name,
        providerReference: null,
        status: 'FAILED',
        response: { error: 'PROVIDER_ERROR' },
      };
    }
  }
}
