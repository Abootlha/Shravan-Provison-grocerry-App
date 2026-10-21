import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const RIDER_PUSH_FETCH = 'RIDER_PUSH_FETCH';

/** Android channels created by the rider app (services/notifications.ts). */
export const RIDER_ORDER_CHANNEL = 'order-alerts';
export const RIDER_UPDATES_CHANNEL = 'order-updates';

export interface RiderPushMessage {
  title: string;
  body: string;
  /** Read by the app when the notification is tapped. */
  data: Record<string, unknown>;
  channelId: string;
  /** Seconds the push service keeps trying an offline device. */
  ttl?: number;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

const MAX_BATCH = 100;

/**
 * Push alerts to riders' phones through the Expo push service, so a rider
 * hears about a new order even when the app is in the background or closed
 * (socket events only reach a running app).
 *
 * Best effort: never throws to callers. Tokens Expo reports as no longer
 * registered are removed from the rider. EXPO_ACCESS_TOKEN is only needed if
 * "enhanced push security" is turned on for the Expo project.
 */
@Injectable()
export class RiderPushService {
  private readonly logger = new Logger(RiderPushService.name);
  private readonly accessToken?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    @InjectModel(Rider.name) private readonly riderModel: Model<RiderDocument>,
    configService: ConfigService,
    @Optional() @Inject(RIDER_PUSH_FETCH) fetchImpl?: typeof fetch,
  ) {
    this.accessToken =
      configService.get<string>('EXPO_ACCESS_TOKEN') || undefined;
    this.fetchImpl = fetchImpl ?? fetch;
  }

  /** Fire-and-forget wrapper for call sites in order flows. */
  notify(riderId: string | undefined | null, message: RiderPushMessage): void {
    if (!riderId) return;
    this.send(riderId, message).catch((error: Error) =>
      this.logger.warn(`Push to rider ${riderId} failed: ${error.message}`),
    );
  }

  async send(riderId: string, message: RiderPushMessage): Promise<number> {
    if (!Types.ObjectId.isValid(riderId)) return 0;
    const rider = await this.riderModel
      .findById(riderId)
      .select('pushTokens')
      .lean()
      .exec();
    const tokens = (rider?.pushTokens ?? []).filter(Boolean);
    if (!tokens.length) return 0;

    const dead: string[] = [];
    let delivered = 0;
    for (let i = 0; i < tokens.length; i += MAX_BATCH) {
      const batch = tokens.slice(i, i + MAX_BATCH);
      const tickets = await this.post(
        batch.map((to) => ({
          to,
          title: message.title,
          body: message.body,
          data: message.data,
          sound: 'default',
          priority: 'high',
          channelId: message.channelId,
          ttl: message.ttl ?? 300,
        })),
      );
      tickets.forEach((ticket, index) => {
        if (ticket?.status === 'ok') delivered += 1;
        else if (ticket?.details?.error === 'DeviceNotRegistered') {
          dead.push(batch[index]);
        } else if (ticket?.status === 'error') {
          this.logger.warn(
            `Expo push rejected for rider ${riderId}: ${ticket.message ?? ticket.details?.error ?? 'unknown error'}`,
          );
        }
      });
    }

    if (dead.length) {
      await this.riderModel
        .updateOne({ _id: riderId }, { $pull: { pushTokens: { $in: dead } } })
        .exec();
    }
    return delivered;
  }

  private async post(messages: object[]): Promise<ExpoTicket[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    const response = await this.fetchImpl(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Expo push HTTP ${response.status}`);
    }
    const json = (await response.json()) as { data?: ExpoTicket[] };
    return Array.isArray(json?.data) ? json.data : [];
  }
}
