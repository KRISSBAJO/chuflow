import { FIRST_WORKSPACE_ID, FIRST_WORKSPACE_NAME } from '../workspaces/workspace-boundary';

function parseCsv(value?: string) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default () => {
  const webUrl = process.env.WEB_URL ?? 'http://localhost:3001';
  const localFrontendOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];

  return {
    appName: process.env.APP_NAME ?? 'ChuFlow',
    workspaceDirectorySigningKey: process.env.WORKSPACE_DIRECTORY_SIGNING_KEY?.trim(),
    workspaceDirectoryVerificationKey: process.env.WORKSPACE_DIRECTORY_VERIFICATION_KEY?.trim(),
    workspaceId: process.env.WORKSPACE_ID?.trim() || FIRST_WORKSPACE_ID,
    workspaceName: process.env.WORKSPACE_NAME?.trim() || FIRST_WORKSPACE_NAME,
    port: parseInt(process.env.PORT ?? '4000', 10),
    mongodbUri:
      process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/church_mgt',
    jwtSecret: process.env.JWT_SECRET ?? 'super-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    mobileJwtExpiresIn: process.env.MOBILE_JWT_EXPIRES_IN ?? '30d',
    webUrl,
    corsAllowedOrigins: Array.from(
      new Set([
        webUrl,
        ...parseCsv(process.env.CORS_ALLOWED_ORIGINS),
        ...localFrontendOrigins,
      ]),
    ),
    cookieName: process.env.AUTH_COOKIE_NAME ?? 'cms_access_token',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    cookieSameSite: (process.env.COOKIE_SAME_SITE ?? 'lax').toLowerCase(),
    cookieDomain: process.env.COOKIE_DOMAIN?.trim() || undefined,
    adminEmail: process.env.ADMIN_EMAIL ?? 'admin@church.local',
    adminPassword: process.env.ADMIN_PASSWORD ?? 'ChangeMe123!',
    mailHost: process.env.MAIL_HOST,
    mailProvider: process.env.MAIL_PROVIDER ?? 'smtp',
    relykitApiKey: process.env.RELYKIT_API_KEY,
    mailPort: process.env.MAIL_PORT
      ? parseInt(process.env.MAIL_PORT, 10)
      : undefined,
    mailSecure: process.env.MAIL_SECURE === 'true',
    mailUser: process.env.MAIL_USER,
    mailPass: process.env.MAIL_PASS,
    mailFrom: process.env.MAIL_FROM ?? 'no-reply@church.local',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY?.trim() || undefined,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY?.trim() || undefined,
    vapidSubject: process.env.VAPID_SUBJECT?.trim() || undefined,
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN?.trim() || undefined,
  };
};
