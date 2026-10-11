import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  AnalyticsService,
  DailyReport,
  WeeklyReport,
} from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { AnalyticsSummaryService } from './analytics-summary.service';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary.dto';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly summaryService: AnalyticsSummaryService,
  ) {}

  /** Dashboard KPIs for an inclusive date range in the store timezone. */
  @Get('summary')
  async getSummary(@Query() query: AnalyticsSummaryQueryDto) {
    return this.summaryService.getSummary(query.from, query.to);
  }

  @Get('daily')
  async getDailyReport(@Query('date') date?: string): Promise<DailyReport> {
    return this.analyticsService.getDailyReport(date);
  }

  @Get('weekly')
  async getWeeklyReport(
    @Query('startDate') startDate?: string,
  ): Promise<WeeklyReport> {
    return this.analyticsService.getWeeklyReport(startDate);
  }

  @Get('top-products')
  async getTopProducts(@Query('limit') limit?: string): Promise<any[]> {
    return this.analyticsService.getTopProducts(limit ? parseInt(limit) : 10);
  }

  @Get('revenue-by-category')
  async getRevenueByCategory(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<any[]> {
    return this.analyticsService.getRevenueByCategory(
      new Date(startDate),
      new Date(endDate),
    );
  }
}
