import { Module } from '@nestjs/common';
import { MockPaymentProvider } from './mock-payment.provider';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { PaymentsService } from './payments.service';

@Module({
  providers: [
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
