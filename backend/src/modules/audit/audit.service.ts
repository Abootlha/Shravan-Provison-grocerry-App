import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { escapeRegex, pageMeta } from '../../common/dto/query-transforms';

const SECRET_KEY = /pass(word)?|token|otp|secret|hash/i;
const MAX_STRING = 200;
const MAX_ARRAY = 20;
const MAX_DIFF_JSON = 4000;
const NAME_CACHE_MS = 5 * 60 * 1000;

/** Request body → small, secret-free object suitable for the audit trail. */
export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return `[data uri, ${value.length} chars]`;
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}… (${value.length} chars)`
      : value;
  }
  if (typeof value !== 'object') return value;
  if (depth >= 4) return '[nested]';
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY)
      .map((v) => sanitizeForAudit(v, depth + 1));
    if (value.length > MAX_ARRAY)
      items.push(`… ${value.length - MAX_ARRAY} more`);
    return items;
  }
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key)
      ? '[redacted]'
      : sanitizeForAudit(v, depth + 1);
  }
  return out;
}

export function smallDiff(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    return undefined;
  }
  const changes = sanitizeForAudit(body) as Record<string, unknown>;
  if (JSON.stringify(changes).length > MAX_DIFF_JSON) {
    return { truncated: true, keys: Object.keys(changes) };
  }
  return { changes };
}

export interface AuditEntry {
  actorId?: string;
  role?: string;
  action: string;
  entity: string;
  entityId?: string;
  summary?: string;
  diff?: Record<string, unknown>;
  ip?: string;
  method?: string;
  path?: string;
  statusCode?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly names = new Map<string, { name: string; at: number }>();

  constructor(
    @InjectModel(AuditLog.name) private auditModel: Model<AuditLogDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async actorName(actorId?: string): Promise<string | undefined> {
    if (!actorId || !Types.ObjectId.isValid(actorId)) return undefined;
    const cached = this.names.get(actorId);
    if (cached && Date.now() - cached.at < NAME_CACHE_MS) return cached.name;
    const user = await this.userModel
      .findById(actorId)
      .select('name username')
      .lean()
      .exec();
    const name = user?.name || user?.username;
    if (name) this.names.set(actorId, { name, at: Date.now() });
    return name;
  }

  /** Never throws: a failed audit write must not fail the admin action. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      const actorName = await this.actorName(entry.actorId);
      await this.auditModel.create({
        ...entry,
        actorId:
          entry.actorId && Types.ObjectId.isValid(entry.actorId)
            ? new Types.ObjectId(entry.actorId)
            : undefined,
        actorName,
        summary: actorName ? `${actorName}: ${entry.summary}` : entry.summary,
      });
    } catch (error) {
      this.logger.error(
        `Audit log write failed for ${entry.action}: ${(error as Error).message}`,
      );
    }
  }

  async list(query: AuditLogQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, any> = {};
    if (query.actorId) filter.actorId = new Types.ObjectId(query.actorId);
    if (query.entity) filter.entity = query.entity;
    if (query.entityId) filter.entityId = query.entityId;
    if (query.action) filter.action = query.action;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = new Date(query.from);
      if (query.to) filter.createdAt.$lte = new Date(query.to);
    }
    if (query.q?.trim()) {
      filter.summary = { $regex: escapeRegex(query.q.trim()), $options: 'i' };
    }

    const [logs, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.auditModel.countDocuments(filter),
    ]);
    return { logs, ...pageMeta(total, page, limit) };
  }
}
