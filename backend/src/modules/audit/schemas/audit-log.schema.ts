import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

/** One staff mutation (collection: auditlogs). Append-only. */
@Schema({
  collection: 'auditlogs',
  timestamps: { createdAt: true, updatedAt: false },
})
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  actorId?: Types.ObjectId;

  @Prop()
  actorName?: string;

  /** Role at the time of the action (admin | manager). */
  @Prop()
  role?: string;

  /** e.g. products.update, products.status, orders.assign-rider, settings.update */
  @Prop({ required: true })
  action!: string;

  /** First path segment after /admin, e.g. products, orders, settings. */
  @Prop({ required: true })
  entity!: string;

  @Prop()
  entityId?: string;

  @Prop()
  summary?: string;

  /** Sanitised request body (secrets redacted, long values truncated). */
  @Prop({ type: MongooseSchema.Types.Mixed })
  diff?: Record<string, unknown>;

  @Prop()
  ip?: string;

  @Prop()
  method?: string;

  @Prop()
  path?: string;

  @Prop()
  statusCode?: number;

  createdAt?: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// GET /admin/audit-log: newest first, optionally by actor or entity.
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
