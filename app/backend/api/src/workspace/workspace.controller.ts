import { Body, Controller, ForbiddenException, Get, Headers, Param, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { maxEvidenceFileSize } from '../onboarding/evidence-item.schema';
import { EvidenceStorageService, UploadedEvidence } from './evidence-storage.service';
import { SendWorkspaceMessageDto } from './dto/send-workspace-message.dto';
import { WorkspaceService } from './workspace.service';

@Controller('workspace')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly evidence: EvidenceStorageService,
    private readonly config: ConfigService,
  ) {}

  private assertTrustedOrigin(origin?: string) {
    const allowedOrigins = (this.config.get<string>('FRONTEND_ORIGIN', 'http://localhost:3000'))
      .split(',').map((value) => value.trim());
    if (!origin || !allowedOrigins.includes(origin)) throw new ForbiddenException('Request origin could not be verified');
  }

  @Get('threads')
  listThreads(@Req() request: AuthenticatedRequest) {
    return this.workspace.listThreads(request.auth!.sub);
  }

  @Get('threads/:id')
  getThread(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.workspace.getThread(request.auth!.sub, id);
  }

  @Get('files')
  listFiles(@Req() request: AuthenticatedRequest) {
    return this.evidence.list(request.auth!.sub);
  }

  /** Bytes go to the server's storage folder; CSV and JSON also keep their text for the agent. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FilesInterceptor('files', 5, { limits: { fileSize: maxEvidenceFileSize } }))
  @Post('files')
  uploadFiles(
    @UploadedFiles() files: UploadedEvidence[] | undefined,
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
  ) {
    this.assertTrustedOrigin(origin);
    return this.evidence.store(request.auth!.sub, files ?? []);
  }

  /** Long-running: the route declares its own throttle so one user cannot fan out agent calls. */
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('threads')
  createThread(
    @Body() body: SendWorkspaceMessageDto,
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
  ) {
    this.assertTrustedOrigin(origin);
    return this.workspace.send(request.auth!.sub, body.message, undefined, body.attachmentIds ?? []);
  }

  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('threads/:id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() body: SendWorkspaceMessageDto,
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
  ) {
    this.assertTrustedOrigin(origin);
    return this.workspace.send(request.auth!.sub, body.message, id, body.attachmentIds ?? []);
  }
}
