import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Store, UserStore } from '../database/entities/pos.entities';

@Injectable()
export class StoresService {
  constructor(private readonly dataSource: DataSource) {}

  /** All active stores the user can work in, with their role. */
  findForUser(userId: string) {
    return this.dataSource
      .getRepository(UserStore)
      .createQueryBuilder('us')
      .innerJoin(Store, 's', 's.id = us.storeId')
      .where('us.userId = :userId', { userId })
      .andWhere('s.isActive = true')
      .select('s.id', 'id')
      .addSelect('s.name', 'name')
      .addSelect('s.address', 'address')
      .addSelect('s.merchantId', 'merchantId')
      .addSelect('us.role', 'role')
      .orderBy('s.name', 'ASC')
      .getRawMany();
  }
}
