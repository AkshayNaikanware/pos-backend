import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentsService } from './payments.service';
import { PaymentProvider } from './payment-provider.interface';

const req = { saleId: 's1', amount: '10.00', currency: 'INR' };

describe('Payment abstraction', () => {
  it('mock provider simulates SUCCESS (default) and FAILED', async () => {
    const mock = new MockPaymentProvider();
    expect((await mock.charge(req)).status).toBe('SUCCESS');
    expect((await mock.charge({ ...req, simulate: 'SUCCESS' })).providerReference).toMatch(/^MOCK-/);
    const failed = await mock.charge({ ...req, simulate: 'FAILED' });
    expect(failed.status).toBe('FAILED');
    expect(failed.providerReference).toBeNull();
  });

  it('PaymentsService works with ANY provider implementing the interface', async () => {
    const fake: PaymentProvider = {
      name: 'FAKE',
      charge: async () => ({ provider: 'FAKE', providerReference: 'x', status: 'SUCCESS', response: {} }),
    };
    expect((await new PaymentsService(fake).charge(req)).provider).toBe('FAKE');
  });

  it('turns a provider crash into a FAILED result instead of throwing', async () => {
    const broken: PaymentProvider = {
      name: 'BROKEN',
      charge: async () => {
        throw new Error('gateway timeout');
      },
    };
    const result = await new PaymentsService(broken).charge(req);
    expect(result.status).toBe('FAILED');
    expect(result.provider).toBe('BROKEN');
  });
});
