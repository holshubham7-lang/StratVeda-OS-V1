import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  health() {
    if (this.connection.readyState !== 1) throw new ServiceUnavailableException('Database connection is not ready');
    return { status: 'ok' };
  }
}
