import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  AnalyticsService,
  DailyReport,
  WeeklyReport,
} from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

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
