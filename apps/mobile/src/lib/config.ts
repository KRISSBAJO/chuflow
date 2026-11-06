/** API base URL. Set EXPO_PUBLIC_API_URL to point the app at a local or staging API. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.chuflow.com/api').replace(/\/$/, '');

/** The full website, for the screens that only exist there. */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://chuflow.com').replace(/\/$/, '');
