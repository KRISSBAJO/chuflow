import * as Joi from 'joi';
import { FIRST_WORKSPACE_ID } from '../workspaces/workspace-boundary';

export const envValidationSchema = Joi.object({
  APP_NAME: Joi.string().default('ChuFlow'),
  WORKSPACE_ID: Joi.string()
    .trim()
    .max(64)
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .default(FIRST_WORKSPACE_ID),
  WORKSPACE_NAME: Joi.string().trim().max(120).when('WORKSPACE_ID', {
    is: FIRST_WORKSPACE_ID,
    otherwise: Joi.required(),
  }),
  PORT: Joi.number().default(4000),
  MONGODB_URI: Joi.string().required(),
  WORKSPACE_DATABASE_NAME: Joi.string()
    .pattern(/^[\w-]{1,63}$/)
    .when('WORKSPACE_ID', {
      is: FIRST_WORKSPACE_ID,
      then: Joi.forbidden(),
    }),
  JWT_SECRET: Joi.string().min(12).required(),
  // Control plane. Workers only read entitlements; the primary API hosts the operator API.
  CONTROL_DATABASE_NAME: Joi.string()
    .pattern(/^[\w-]{1,63}$/)
    .invalid('admin', 'config', 'local')
    .when('PLATFORM_ENABLED', { is: true, then: Joi.required() }),
  CONTROL_ENCRYPTION_KEY: Joi.string()
    .base64()
    .pattern(/^[A-Za-z0-9+/]{43}=$/)
    .when('PLATFORM_ENABLED', { is: true, then: Joi.required() }),
  PLATFORM_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  PLATFORM_JWT_SECRET: Joi.string()
    .min(32)
    .when('PLATFORM_ENABLED', { is: true, then: Joi.required() }),
  PLATFORM_OWNER_EMAIL: Joi.string().email().optional(),
  PLATFORM_OWNER_PASSWORD: Joi.string().min(12).optional(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  // Sign-ins from the mobile app last longer; the API still rejects deactivated users on every call.
  MOBILE_JWT_EXPIRES_IN: Joi.string().default('30d'),
  WEB_URL: Joi.string().uri().required(),
  CORS_ALLOWED_ORIGINS: Joi.string().allow('').optional(),
  AUTH_COOKIE_NAME: Joi.string().default('cms_access_token'),
  COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict', 'none').default('lax'),
  COOKIE_DOMAIN: Joi.string().allow('').optional(),
  ADMIN_EMAIL: Joi.string().email().required(),
  ADMIN_PASSWORD: Joi.string().min(8).required(),
  MAIL_HOST: Joi.string().allow('').optional(),
  MAIL_PROVIDER: Joi.string().valid('smtp', 'relykit').default('smtp'),
  RELYKIT_API_KEY: Joi.string().when('MAIL_PROVIDER', {
    is: 'relykit',
    then: Joi.string()
      .pattern(/^rlk_live_[A-Za-z0-9_-]+$/)
      .required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  MAIL_PORT: Joi.number().optional(),
  MAIL_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  MAIL_USER: Joi.string().allow('').optional(),
  MAIL_PASS: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().allow('').default('no-reply@church.local'),
  YOUTH_CLAMAV_HOST: Joi.string().hostname().optional(),
  YOUTH_CLAMAV_PORT: Joi.number().integer().min(1).max(65535).default(3310),
  // Only needed if "Enhanced push security" is turned on for the Expo project.
  EXPO_ACCESS_TOKEN: Joi.string().allow('').optional(),
  VAPID_PUBLIC_KEY: Joi.string().allow('').optional(),
  VAPID_PRIVATE_KEY: Joi.string().allow('').optional(),
  // A mailto: or https: contact the push services can reach if something goes wrong.
  VAPID_SUBJECT: Joi.string()
    .allow('')
    .pattern(/^(mailto:|https:)/)
    .optional(),
});
