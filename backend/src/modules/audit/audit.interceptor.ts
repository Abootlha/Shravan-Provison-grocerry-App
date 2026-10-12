import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService, smallDiff } from './audit.service';
import { isStaffRole } from '../users/schemas/user.schema';

export const AUDIT_ACTION_KEY = 'auditAction';

/** Overrides the derived audit action name for a route, e.g. 'settings.update'. */
export const AuditAction = (action: string) =>
  SetMetadata(AUDIT_ACTION_KEY, action);

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const METHOD_VERBS: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};
const API_PREFIX = /^\/?api\/v1\//;
// Fields worth surfacing in the one-line summary.
const SUMMARY_FIELDS = [
  'status',
  'isActive',
  'role',
  'delta',
  'reason',
  'riderId',
  'reorderLevel',
];

export interface DerivedAudit {
  entity: string;
  action: string;
  entityId?: string;
}

/**
 * entity = first path segment after /api/v1[/admin];
 * action = entity + trailing static segments (e.g. products.status,
 * orders.assign-rider) or entity + verb from the HTTP method.
 */
export function deriveAudit(
  method: string,
  routePath: string,
  params: Record<string, string> = {},
): DerivedAudit {
  const segments = routePath.replace(API_PREFIX, '').split('/').filter(Boolean);
  if (segments[0] === 'admin') segments.shift();
  const entity = segments[0] || 'unknown';
  const rest = segments.slice(1);
  const statics = rest.filter((s) => !s.startsWith(':'));
  const paramName = rest.find((s) => s.startsWith(':'))?.slice(1);
  const entityId = paramName ? params[paramName] : undefined;
  const action = statics.length
    ? `${entity}.${statics.join('.')}`
    : `${entity}.${METHOD_VERBS[method] || method.toLowerCase()}`;
  return { entity, action, entityId };
}

/** Best effort id of the created/updated record from a `{ thing: {_id} }` response. */
function idFromResponse(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  for (const value of Object.values(body as Record<string, any>)) {
    const id = value?._id ?? value?.id;
    if (id && typeof id.toString === 'function') return id.toString();
  }
  return undefined;
}

/**
 * Global interceptor: every successful mutation by an admin or manager
 * (all /admin/** routes, settings, catalogue, riders, order actions) is
 * written to `auditlogs`. Auth routes are excluded.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const user = req?.user;
    const routePath: string = req?.route?.path || req?.path || '';
    if (
      !MUTATIONS.has(req?.method) ||
      !user ||
      !isStaffRole(user.role) ||
      routePath.replace(API_PREFIX, '').startsWith('auth/')
    ) {
      return next.handle();
    }

    const override = this.reflector.getAllAndOverride<string | undefined>(
      AUDIT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      tap((responseBody) => {
        const derived = deriveAudit(req.method, routePath, req.params);
        const action = override || derived.action;
        const entityId = derived.entityId || idFromResponse(responseBody);
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const highlights = SUMMARY_FIELDS.filter((k) => body[k] !== undefined)
          .map((k) => `${k}=${String(body[k])}`)
          .join(', ');
        const res = context.switchToHttp().getResponse();
        void this.auditService.record({
          actorId: user.userId,
          role: user.role,
          action,
          entity: derived.entity,
          entityId,
          summary: [action, entityId, highlights].filter(Boolean).join(' '),
          diff: smallDiff(body),
          ip: req.ip,
          method: req.method,
          path: String(req.originalUrl || req.url || '').split('?')[0],
          statusCode: res?.statusCode,
        });
      }),
    );
  }
}
