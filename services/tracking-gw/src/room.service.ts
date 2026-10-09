import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

export interface RoomMembership {
  socketId: string;
  userId: string;
  role: string;
  joinedAt: Date;
}

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);
  private readonly rooms = new Map<string, Map<string, RoomMembership>>();
  private readonly socketRooms = new Map<string, Set<string>>();

  private readonly ROOM_TYPES = {
    ORDER: 'order',
    USER: 'user',
    RIDER: 'rider',
    ADMIN: 'admin',
  } as const;

  getOrderRoom(orderId: string): string {
    return `${this.ROOM_TYPES.ORDER}_${orderId}`;
  }

  getUserRoom(userId: string): string {
    return `${this.ROOM_TYPES.USER}_${userId}`;
  }

  getRiderRoom(riderId: string): string {
    return `${this.ROOM_TYPES.RIDER}_${riderId}`;
  }

  getAdminRoom(): string {
    return this.ROOM_TYPES.ADMIN;
  }

  joinRoom(server: Server, socket: Socket, room: string, user: { userId: string; role: string }): void {
    socket.join(room);

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Map());
    }

    const roomMembers = this.rooms.get(room)!;
    roomMembers.set(socket.id, {
      socketId: socket.id,
      userId: user.userId,
      role: user.role,
      joinedAt: new Date(),
    });

    if (!this.socketRooms.has(socket.id)) {
      this.socketRooms.set(socket.id, new Set());
    }
    this.socketRooms.get(socket.id)!.add(room);

    this.logger.log(`Socket ${socket.id} (user: ${user.userId}, role: ${user.role}) joined room: ${room}`);
  }

  leaveRoom(server: Server, socket: Socket, room: string): void {
    socket.leave(room);

    const roomMembers = this.rooms.get(room);
    if (roomMembers) {
      roomMembers.delete(socket.id);
      if (roomMembers.size === 0) {
        this.rooms.delete(room);
      }
    }

    const socketRoomList = this.socketRooms.get(socket.id);
    if (socketRoomList) {
      socketRoomList.delete(room);
    }

    this.logger.log(`Socket ${socket.id} left room: ${room}`);
  }

  leaveAllRooms(server: Server, socket: Socket): void {
    const rooms = this.socketRooms.get(socket.id);
    if (rooms) {
      for (const room of rooms) {
        this.leaveRoom(server, socket, room);
      }
      this.socketRooms.delete(socket.id);
    }
  }

  broadcastToRoom(server: Server, room: string, event: string, data: any): void {
    server.to(room).emit(event, data);
    this.logger.debug(`Broadcast ${event} to room ${room}:`, data);
  }

  broadcastToOrderRoom(server: Server, orderId: string, event: string, data: any): void {
    const room = this.getOrderRoom(orderId);
    this.broadcastToRoom(server, room, event, data);
  }

  broadcastToUser(server: Server, userId: string, event: string, data: any): void {
    const room = this.getUserRoom(userId);
    this.broadcastToRoom(server, room, event, data);
  }

  broadcastToRider(server: Server, riderId: string, event: string, data: any): void {
    const room = this.getRiderRoom(riderId);
    this.broadcastToRoom(server, room, event, data);
  }

  broadcastToAdmins(server: Server, event: string, data: any): void {
    const room = this.getAdminRoom();
    this.broadcastToRoom(server, room, event, data);
  }

  canJoinOrderRoom(userId: string, role: string, orderId: string): boolean {
    return true;
  }

  getRoomMembers(room: string): RoomMembership[] {
    const roomMembers = this.rooms.get(room);
    if (!roomMembers) {
      return [];
    }
    return Array.from(roomMembers.values());
  }

  isUserInRoom(socketId: string, room: string): boolean {
    const socketRoomList = this.socketRooms.get(socketId);
    return socketRoomList ? socketRoomList.has(room) : false;
  }
}
