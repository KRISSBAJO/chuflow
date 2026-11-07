export type Release = { version: string; build: string; url: string; kind: 'testflight' | 'download' | 'store' };

export function parseRelease(value: unknown): Release {
  if (!value || typeof value !== 'object') throw new Error('Invalid release information');
  const release = value as Record<string, unknown>;
  if (
    typeof release.version !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(release.version) ||
    typeof release.build !== 'string' ||
    !/^\d+$/.test(release.build) ||
    typeof release.url !== 'string' ||
    !['testflight', 'download', 'store'].includes(String(release.kind))
  )
    throw new Error('Invalid release information');
  const url = new URL(release.url);
  if (url.protocol !== 'https:' || url.username || url.password || !['expo.dev', 'apps.apple.com', 'play.google.com', 'chuflow.com', 'www.chuflow.com'].includes(url.hostname))
    throw new Error('Untrusted release destination');
  return release as Release;
}

export function newerRelease(release: Pick<Release, 'version' | 'build'>, version: string, build: string) {
  const target = release.version.split('.').map(Number);
  const installed = version.split('.').map(Number);
  if (installed.length !== 3 || installed.some((n) => !Number.isFinite(n))) return false;
  for (let index = 0; index < 3; index++) {
    if (target[index] !== installed[index]) return target[index] > installed[index];
  }
  return Number(release.build) > Number(build);
}

export type UpdateDriver = {
  enabled: boolean;
  check: () => Promise<{ isAvailable: boolean; isRollBackToEmbedded?: boolean }>;
  fetch: () => Promise<{ isNew: boolean; isRollBackToEmbedded?: boolean }>;
};

/** Downloads only a compatible update selected by Expo; never reloads the user's session. */
export async function downloadCompatibleUpdate(driver: UpdateDriver): Promise<'unavailable' | 'current' | 'ready'> {
  if (!driver.enabled) return 'unavailable';
  const result = await driver.check();
  if (!result.isAvailable && !result.isRollBackToEmbedded) return 'current';
  const downloaded = await driver.fetch();
  return downloaded.isNew || downloaded.isRollBackToEmbedded ? 'ready' : 'current';
}
