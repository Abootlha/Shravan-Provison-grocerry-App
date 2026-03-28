export interface IOrderEvent {
  type: string;
  data?: any;
  timestamp: Date;
}

export interface IDailyAnalytics {
  date: Date;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  revenue: number;
  deliveriesCompleted: number;
  cancellations: number;
}
