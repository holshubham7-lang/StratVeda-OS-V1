import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { maxDataIntakeFileSize, maxDataIntakeFiles } from './data-intake.constants';
import { DataIntakeService } from './data-intake.service';
import { UploadedDataFile } from './file-validation';

@Controller('data-intake')
@UseGuards(JwtAuthGuard)
export class DataIntakeController {
  constructor(
    private readonly intake: DataIntakeService,
    private readonly config: ConfigService,
  ) {}

  private assertTrustedOrigin(origin?: string) {
    const allowedOrigins = (this.config.get<string>('FRONTEND_ORIGIN', 'http://localhost:3000'))
      .split(',').map((value) => value.trim());
    if (!origin || !allowedOrigins.includes(origin)) throw new ForbiddenException('Request origin could not be verified');
  }

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.intake.get(request.auth!.sub);
  }

  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @UseInterceptors(FilesInterceptor('files', maxDataIntakeFiles, { limits: { fileSize: maxDataIntakeFileSize } }))
  @Post('files')
  upload(
    @UploadedFiles() files: UploadedDataFile[] | undefined,
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
  ) {
    this.assertTrustedOrigin(origin);
    return this.intake.upload(request.auth!.sub, files ?? []);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Delete('files/:id')
  remove(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
  ) {
    this.assertTrustedOrigin(origin);
    return this.intake.removeFile(request.auth!.sub, id);
  }

  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  @Post('complete')
  complete(
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
  ) {
    this.assertTrustedOrigin(origin);
    return this.intake.complete(request.auth!.sub);
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('skip')
  skip(
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
  ) {
    this.assertTrustedOrigin(origin);
    return this.intake.skip(request.auth!.sub);
  }
}
