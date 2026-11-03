import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      success: true,
      message: 'POS Backend is running',
      application: 'Swazei POS',
      timestamp: new Date().toISOString(),
    };
  }
}
