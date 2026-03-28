import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AnalyticsService } from './analytics.service';
import { MetricsService } from './metrics.service';
import { ReportService } from './report.service';

@Controller()
export class AnalyticsGrpcController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly metricsService: MetricsService,
    private readonly reportService: ReportService,
  ) {}

  @GrpcMethod('AnalyticsService', 'GetOrderVolumeByDay')
  async getOrderVolumeByDay(data: { startDate: string; endDate: string }) {
    return this.metricsService.getOrderVolumeByDay(new Date(data.startDate), new Date(data.endDate));
  }

  @GrpcMethod('AnalyticsService', 'GetOrderVolumeByHour')
  async getOrderVolumeByHour(data: { date: string }) {
    return this.metricsService.getOrderVolumeByHour(new Date(data.date));
  }

  @GrpcMethod('AnalyticsService', 'GetRevenueByDay')
  async getRevenueByDay(data: { startDate: string; endDate: string }) {
    return this.metricsService.getRevenueByDay(new Date(data.startDate), new Date(data.endDate));
  }

  @GrpcMethod('AnalyticsService', 'GetRevenueByWeek')
  async getRevenueByWeek(data: { startDate: string; endDate: string }) {
    return this.metricsService.getRevenueByWeek(new Date(data.startDate), new Date(data.endDate));
  }

  @GrpcMethod('AnalyticsService', 'GetRevenueByMonth')
  async getRevenueByMonth(data: { startDate: string; endDate: string }) {
    return this.metricsService.getRevenueByMonth(new Date(data.startDate), new Date(data.endDate));
  }

  @GrpcMethod('AnalyticsService', 'GetAverageOrderValue')
  async getAverageOrderValue(data: { startDate: string; endDate: string }) {
    const value = await this.metricsService.getAverageOrderValue(new Date(data.startDate), new Date(data.endDate));
    return { value };
  }

  @GrpcMethod('AnalyticsService', 'GetAverageDeliveryTime')
  async getAverageDeliveryTime(data: { startDate: string; endDate: string }) {
    const value = await this.metricsService.getAverageDeliveryTime(new Date(data.startDate), new Date(data.endDate));
    return { value };
  }

  @GrpcMethod('AnalyticsService', 'GetRiderPerformance')
  async getRiderPerformance(data: { startDate: string; endDate: string }) {
    return this.reportService.getRiderPerformanceMetrics(new Date(data.startDate), new Date(data.endDate));
  }

  @GrpcMethod('AnalyticsService', 'GetTopProducts')
  async getTopProducts(data: { startDate: string; endDate: string; limit: number }) {
    return this.reportService.getTopProducts(new Date(data.startDate), new Date(data.endDate), data.limit);
  }

  @GrpcMethod('AnalyticsService', 'GetCustomerRetention')
  async getCustomerRetention(data: { startDate: string; endDate: string }) {
    return this.reportService.getCustomerRetention(new Date(data.startDate), new Date(data.endDate));
  }

  @GrpcMethod('AnalyticsService', 'TrackOrderEvent')
  async trackOrderEvent(data: any) {
    await this.analyticsService.trackOrderEvent(data);
    return { success: true };
  }

  @GrpcMethod('AnalyticsService', 'TrackRiderEvent')
  async trackRiderEvent(data: any) {
    await this.analyticsService.trackRiderEvent(data);
    return { success: true };
  }
}
