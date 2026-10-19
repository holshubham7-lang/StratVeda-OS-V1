import { BadRequestException, Controller, ForbiddenException, Get, Headers, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminRequest, AdminSessionGuard } from '../auth/admin-session.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AdminSessionGuard)
export class AdminController {
  constructor(private readonly admin: AdminService, private readonly config: ConfigService) {}

  private assertTrustedOrigin(origin?: string) {
    const allowed = (this.config.get<string>('ADMIN_FRONTEND_ORIGINS') ?? 'http://localhost:3001')
      .split(',').map((value) => value.trim());
    if (!origin || !allowed.includes(origin)) throw new ForbiddenException('This request origin is not allowed');
  }

  @Get('overview')
  overview() { return this.admin.overview(); }

  @Get('users')
  listUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
  ) {
    const currentPage = Math.min(Math.max(Number(page) || 1, 1), 100000);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 50);
    return this.admin.listUsers({ page: currentPage, limit: pageSize, search, status, provider });
  }

  @Get('users/:id')
  userDetails(@Param('id') id: string) { return this.admin.userDetails(id); }

  @Patch('users/:id/active/:status')
  setUserStatus(@Param('id') id: string, @Param('status') status: string, @Req() request: AdminRequest, @Headers('origin') origin?: string) {
    this.assertTrustedOrigin(origin);
    if (status !== 'true' && status !== 'false') throw new BadRequestException('Invalid user status');
    return this.admin.setUserStatus(id, status === 'true', request.admin!.email, request.ip);
  }

  @Get('audit')
  audit(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('action') action?: string,
    @Query('search') search?: string,
  ) {
    const currentPage = Math.min(Math.max(Number(page) || 1, 1), 100000);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 50);
    return this.admin.auditEvents({ page: currentPage, limit: pageSize, action, search });
  }
}
