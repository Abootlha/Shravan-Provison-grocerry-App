import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { MetricsService } from './metrics.service';
import { ReportService } from './report.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly metricsService: MetricsService,
    private readonly reportService: ReportService,
  ) {}

  @Get('order-volume/day')
  async getOrderVolumeByDay(@Query() query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.validateDates(query);
    return this.metricsService.getOrderVolumeByDay(startDate, endDate);
  }

  @Get('order-volume/hour')
  async getOrderVolumeByHour(@Query('date') dateStr: string) {
    if (!dateStr) throw new BadRequestException('date is required');
    const date = new Date(dateStr);
    return this.metricsService.getOrderVolumeByHour(date);
  }

  @Get('revenue/day')
  async getRevenueByDay(@Query() query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.validateDates(query);
    return this.metricsService.getRevenueByDay(startDate, endDate);
  }

  @Get('revenue/week')
  async getRevenueByWeek(@Query() query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.validateDates(query);
    return this.metricsService.getRevenueByWeek(startDate, endDate);
  }

  @Get('revenue/month')
  async getRevenueByMonth(@Query() query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.validateDates(query);
    return this.metricsService.getRevenueByMonth(startDate, endDate);
  }

  @Get('average-order-value')
  async getAverageOrderValue(@Query() query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.validateDates(query);
    return { value: await this.metricsService.getAverageOrderValue(startDate, endDate) };
  }

  @Get('average-delivery-time')
  async getAverageDeliveryTime(@Query() query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.validateDates(query);
    return { value: await this.metricsService.getAverageDeliveryTime(startDate, endDate) };
  }

  @Get('rider-performance')
  async getRiderPerformance(@Query() query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.validateDates(query);
    return this.reportService.getRiderPerformanceMetrics(startDate, endDate);
  }

  @Get('top-products')
  async getTopProducts(@Query() query: AnalyticsQueryDto) {
    const { startDate, endDate, limit } = query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.reportService.getTopProducts(start, end, limitNum);
  }

  @Get('customer-retention')
  async getCustomerRetention(@Query() query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.validateDates(query);
    return this.reportService.getCustomerRetention(startDate, endDate);
  }

  @Get('daily-summary')
  async getDailySummary(@Query('date') dateStr: string) {
    if (!dateStr) throw new BadRequestException('date is required');
    return this.reportService.getDailySummary(new Date(dateStr));
  }

  private validateDates(query: AnalyticsQueryDto) {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    return {
      startDate: new Date(query.startDate),
      endDate: new Date(query.endDate),
    };
  }
}
