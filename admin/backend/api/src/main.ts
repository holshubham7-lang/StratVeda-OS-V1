import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);
  // Azure App Service terminates TLS in a loopback proxy, so req.ip is container-local
  // unless that single hop is trusted. Clients cannot spoof it: the platform appends the
  // real client address, and Express takes the rightmost untrusted value.
  (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 'loopback');
  const origins = (config.get<string>('ADMIN_FRONTEND_ORIGINS') ?? 'http://localhost:3001')
    .split(',').map((origin) => origin.trim()).filter(Boolean);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: (origin, callback) => callback(null, !origin || origins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.enableShutdownHooks();
  await app.listen(Number(config.get('PORT', 8080)), '0.0.0.0');
}

void bootstrap();
