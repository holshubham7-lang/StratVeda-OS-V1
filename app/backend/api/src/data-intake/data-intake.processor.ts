import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataIntakeService } from './data-intake.service';

@Injectable()
export class DataIntakeProcessor implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly intake: DataIntakeService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    void this.intake.recoverStaleSessions().catch(() => undefined);
    const interval = Number(this.config.get('DATA_INTAKE_POLL_INTERVAL_MS', '3000'));
    if (!Number.isFinite(interval) || interval < 1000) return;
    this.timer = setInterval(() => void this.tick(), interval);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.intake.processPending();
    } catch {
      this.running = false;
    } finally {
      this.running = false;
    }
  }
}
