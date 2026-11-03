import { Request } from 'express';

export type StoreRole = 'OWNER' | 'MANAGER' | 'CASHIER';

export type AuthenticatedRequest = Request & {
  user: { id: string; email: string };
};

export type StoreRequest = AuthenticatedRequest & {
  storeAccess: { storeId: string; merchantId: string; role: StoreRole };
};
