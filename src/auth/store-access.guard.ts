import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { isUUID } from 'class-validator';

import { UserStore } from '../database/entities/pos.entities';

type StoreRequest = Request & {
  user?: {
    id: string;
    email: string;
  };
  params: {
    storeId?: string;
  };
  storeAccess?: {
    storeId: string;
    merchantId: string;
    role: string;
  };
};

@Injectable()
export class StoreAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(UserStore)
    private readonly userStoreRepository: Repository<UserStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StoreRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Login required');
    }

    const storeId = request.params.storeId;

    if (!storeId) {
      throw new BadRequestException('Store ID is required');
    }

    if (!isUUID(storeId)) {
      throw new BadRequestException('Store ID must be a valid UUID');
    }

    const membership = await this.userStoreRepository.findOne({
      where: {
        userId: request.user.id,
        storeId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this store');
    }

    request.storeAccess = {
      storeId: membership.storeId,
      merchantId: membership.merchantId,
      role: membership.role,
    };

    return true;
  }
}
