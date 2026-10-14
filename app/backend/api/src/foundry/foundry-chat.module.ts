import { Global, Module } from '@nestjs/common';
import { FoundryChatService } from './foundry-chat.service';

/** Global because both the onboarding brief agent and the workspace agent need one credential path. */
@Global()
@Module({ providers: [FoundryChatService], exports: [FoundryChatService] })
export class FoundryChatModule {}
