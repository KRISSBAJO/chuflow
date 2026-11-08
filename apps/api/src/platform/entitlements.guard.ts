import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  EntitlementException,
  EntitlementsService,
} from './entitlements.service';
import type { FeatureKey } from './platform.types';
import { REQUIRES_FEATURE_KEY } from './requires-feature.decorator';

/** Routes that must keep working whatever the subscription says. */
const ALWAYS_OPEN = new Set(['auth', 'platform', 'push', '']);
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SUBSCRIPTION_EXEMPT = 'subscriptionExempt';
export const SubscriptionExempt = () => SetMetadata(SUBSCRIPTION_EXEMPT, true);

/*
 * Applies the plan after sign-in and role checks: a locked workspace gets nothing, a read-only
 * workspace may look and export but not change (attendance counted on phones still syncs),
 * and features outside the plan answer 402 so the apps can show an upgrade prompt.
 */
@Injectable()
export class EntitlementsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const controller =
      this.reflector.get<string | undefined>(
        PATH_METADATA,
        context.getClass(),
      ) ?? '';
    if (ALWAYS_OPEN.has(controller.split('/')[0]) ||
        this.reflector.get<boolean>(SUBSCRIPTION_EXEMPT, context.getHandler())) return true;

    const snapshot = await this.entitlements.snapshot();
    if (!snapshot.enforced) return true;

    const request = context.switchToHttp().getRequest<{ method: string }>();
    if (snapshot.access === 'locked') {
      throw new EntitlementException(
        'workspace_locked',
        'This workspace is not active. Contact your administrator.',
        {
          reason: snapshot.reason,
        },
      );
    }
    if (
      snapshot.access === 'read_only' &&
      !READ_METHODS.has(request.method) &&
      !(controller === 'attendance' && request.method === 'POST')
    ) {
      throw new EntitlementException(
        'workspace_read_only',
        'Your subscription needs attention before changes can be made.',
        {
          reason: snapshot.reason,
          graceEndsAt: snapshot.graceEndsAt,
        },
      );
    }

    const feature = this.reflector.getAllAndOverride<FeatureKey | undefined>(
      REQUIRES_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (feature && !snapshot.features.includes(feature)) {
      throw new EntitlementException(
        'feature_locked',
        'This feature is not included in your plan.',
        { feature },
      );
    }
    return true;
  }
}
