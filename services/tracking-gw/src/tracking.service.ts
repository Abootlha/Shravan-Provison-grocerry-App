import { Injectable, Logger } from '@nestjs/common';
import { RoomService } from './room.service';
import { Server } from 'socket.io';

export interface OrderStatusUpdate {
  orderId: string;
  status: string;
  timeline: {
    status: string;
    timestamp: Date;
    location?: {
      lat: number;
      lng: number;
    };
  }[];
}

export interface RiderLocationUpdate {
  riderId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
}

export interface EtaUpdate {
  orderId: string;
  eta: Date;
  durationMinutes: number;
}

export interface OrderAssigned {
  orderId: string;
  rider: {
    id: string;
    name: string;
    phone: string;
    vehicleNumber?: string;
    photoUrl?: string;
  };
}

export interface NewOrderAssignment {
  orderId: string;
  pickupLocation: {
    address: string;
    lat: number;
    lng: number;
  };
  deliveryLocation: {
    address: string;
    lat: number;
    lng: number;
  };
  estimatedDistance?: number;
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly roomService: RoomService) {}

  broadcastOrderStatusUpdate(server: Server, orderId: string, update: OrderStatusUpdate): void {
    this.logger.log(`Broadcasting order status update for order ${orderId}: ${update.status}`);
    this.roomService.broadcastToOrderRoom(server, orderId, 'orderStatusUpdate', update);
    this.roomService.broadcastToAdmins(server, 'orderStatusUpdate', update);
  }

  broadcastRiderLocation(server: Server, orderId: string, location: RiderLocationUpdate): void {
    this.roomService.broadcastToOrderRoom(server, orderId, 'riderLocationUpdate', location);
  }

  broadcastEtaUpdate(server: Server, orderId: string, eta: EtaUpdate): void {
    this.logger.log(`Broadcasting ETA update for order ${orderId}: ${eta.durationMinutes} minutes`);
    this.roomService.broadcastToOrderRoom(server, orderId, 'etaUpdate', eta);
  }

  broadcastOrderAssigned(server: Server, orderId: string, assignment: OrderAssigned): void {
    this.logger.log(`Broadcasting order assignment for order ${orderId} to rider ${assignment.rider.id}`);
    this.roomService.broadcastToOrderRoom(server, orderId, 'orderAssigned', assignment);
    this.roomService.broadcastToRider(server, assignment.rider.id, 'newOrderAssignment', {
      orderId,
      pickupLocation: { address: '', lat: 0, lng: 0 },
      deliveryLocation: { address: '', lat: 0, lng: 0 },
    } as NewOrderAssignment);
    this.roomService.broadcastToAdmins(server, 'orderAssigned', assignment);
  }

  async getOrderTrackingHistory(orderId: string): Promise<any[]> {
    return [];
  }

  async updateRiderLocation(riderId: string, location: RiderLocationUpdate): Promise<void> {
    this.logger.debug(`Rider ${riderId} location updated: ${location.lat}, ${location.lng}`);
  }
}
