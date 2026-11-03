import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, LessThan } from 'typeorm';
import { IdempotencyKey } from '../database/entities/pos.entities';

@Injectable()
export class IdempotencyRepository {
  constructor(private readonly dataSource: DataSource) {}

  private repo(m?: EntityManager) {
    return (m ?? this.dataSource.manager).getRepository(IdempotencyKey);
  }

  /** Inserts a PROCESSING row. Returns null if the key already exists. */
  async tryCreate(data: Pick<IdempotencyKey, 'merchantId' | 'storeId' | 'idempotencyKey' | 'requestHash'>) {
    try {
      const r = this.repo();
      return await r.save(r.create({ ...data, status: 'PROCESSING' }));
    } catch (e) {
      if ((e as { code?: string }).code === '23505') return null;
      throw e;
    }
  }

  find(storeId: string, idempotencyKey: string) {
    return this.repo().findOneOrFail({ where: { storeId, idempotencyKey } });
  }

  /** Compare-and-set: only one concurrent caller can flip FAILED -> PROCESSING. */
  async takeOverFailed(id: string) {
    const res = await this.repo().update({ id, status: 'FAILED' }, { status: 'PROCESSING' });
    return res.affected === 1;
  }

  /** A crashed worker leaves PROCESSING behind; after `olderThanMs` it may be retried. */
  async takeOverStale(id: string, olderThanMs: number) {
    const cutoff = new Date(Date.now() - olderThanMs);
    const res = await this.repo().update(
      { id, status: 'PROCESSING', updatedAt: LessThan(cutoff) },
      { status: 'PROCESSING' },
    );
    return res.affected === 1;
  }

  setResult(id: string, status: 'COMPLETED' | 'FAILED', saleId: string | null, m?: EntityManager) {
    return this.repo(m).update(id, { status, saleId });
  }

  markFailed(id: string) {
    return this.repo().update({ id, status: 'PROCESSING' }, { status: 'FAILED' });
  }
}
