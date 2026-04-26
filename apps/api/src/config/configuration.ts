export default () => ({
  appName: process.env.APP_NAME ?? 'ChuFlow',
  port: parseInt(process.env.PORT ?? '4000', 10),
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/church_mgt',
  jwtSecret: process.env.JWT_SECRET ?? 'super-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  webUrl: process.env.WEB_URL ?? 'http://localhost:3001',
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? process.env.WEB_URL ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  cookieName: process.env.AUTH_COOKIE_NAME ?? 'cms_access_token',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: (process.env.COOKIE_SAME_SITE ?? 'lax').toLowerCase(),
  cookieDomain: process.env.COOKIE_DOMAIN?.trim() || undefined,
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@church.local',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'ChangeMe123!',
  mailHost: process.env.MAIL_HOST,
  mailPort: process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT, 10) : undefined,
  mailSecure: process.env.MAIL_SECURE === 'true',
  mailUser: process.env.MAIL_USER,
  mailPass: process.env.MAIL_PASS,
  mailFrom: process.env.MAIL_FROM ?? 'no-reply@church.local',
});
