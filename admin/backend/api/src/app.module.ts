import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminSessionGuard } from './auth/admin-session.guard';
import { AdminController } from './users/admin.controller';
import { AdminService } from './users/admin.service';
import { User, UserSchema } from './users/user.schema';
import { UserActivity, UserActivitySchema } from './users/user-activity.schema';
import { AdminAudit, AdminAuditSchema } from './users/admin-audit.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        dbName: config.get<string>('MONGODB_DATABASE', 'revenue-intelligence'),
        tls: config.get<string>('NODE_ENV') === 'production',
        autoIndex: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserActivity.name, schema: UserActivitySchema },
      { name: AdminAudit.name, schema: AdminAuditSchema },
    ]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('ADMIN_JWT_SECRET');
        if (secret.length < 32) throw new Error('ADMIN_JWT_SECRET must contain at least 32 characters');
        return {
          secret,
          signOptions: {
            algorithm: 'HS256' as const,
            expiresIn: '15m',
            issuer: 'revops-admin-api',
            audience: 'revops-admin-app',
          },
        };
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [HealthController, AdminAuthController, AdminController],
  providers: [
    AdminAuthService,
    AdminService,
    AdminSessionGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
