import { SetMetadata } from '@nestjs/common';
import { StoreRole } from './auth.types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: StoreRole[]) => SetMetadata(ROLES_KEY, roles);
