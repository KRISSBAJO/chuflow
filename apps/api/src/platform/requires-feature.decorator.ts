import { SetMetadata } from '@nestjs/common';
import type { FeatureKey } from './platform.types';

export const REQUIRES_FEATURE_KEY = 'requiresFeature';

/** Marks a controller or handler as part of a plan feature; locked plans get 402. */
export const RequiresFeature = (feature: FeatureKey) =>
  SetMetadata(REQUIRES_FEATURE_KEY, feature);
