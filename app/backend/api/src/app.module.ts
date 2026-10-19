import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { FoundryChatModule } from './foundry/foundry-chat.module';
import { WorkspaceModule } from './workspace/workspace.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://127.0.0.1:27017/revenue-intelligence'),
        dbName: config.get<string>('MONGODB_DATABASE', 'revenue-intelligence'),
        autoIndex: true,
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');
        if (secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
        return {
          secret,
          signOptions: {
            algorithm: 'HS256',
            expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m'),
            issuer: 'revenue-intelligence-api',
            audience: 'revenue-intelligence-app',
          },
        };
      },
    }),
    // Baseline for read-only and onboarding routes; every credential-redemption
    // route declares a tighter @Throttle of its own, so raising this does not
    // loosen sign-in or signup.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    FoundryChatModule,
    AuthModule,
    WorkspaceModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
