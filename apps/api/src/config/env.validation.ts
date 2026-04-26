import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  APP_NAME: Joi.string().default('ChuFlow'),
  PORT: Joi.number().default(4000),
  MONGODB_URI: Joi.string().required(),
  JWT_SECRET: Joi.string().min(12).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  WEB_URL: Joi.string().uri().required(),
  CORS_ALLOWED_ORIGINS: Joi.string().allow('').optional(),
  AUTH_COOKIE_NAME: Joi.string().default('cms_access_token'),
  COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict', 'none').default('lax'),
  COOKIE_DOMAIN: Joi.string().allow('').optional(),
  ADMIN_EMAIL: Joi.string().email().required(),
  ADMIN_PASSWORD: Joi.string().min(8).required(),
  MAIL_HOST: Joi.string().allow('').optional(),
  MAIL_PORT: Joi.number().optional(),
  MAIL_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  MAIL_USER: Joi.string().allow('').optional(),
  MAIL_PASS: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().allow('').default('no-reply@church.local'),
});
