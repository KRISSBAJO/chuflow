/*
 * Hands a scanned code from the camera modal back to the desk underneath it. The modal pops
 * itself and the desk reads the pending scan when it regains focus, which works the same on
 * native stacks and on the web.
 */

export type PendingScan = { sessionId: string; tab: 'checkin' | 'pickup'; code: string };

let pending: PendingScan | null = null;

export function setPendingScan(scan: PendingScan) {
  pending = scan;
}

/** Returns and clears the pending scan for this session, if any. */
export function takePendingScan(sessionId: string): PendingScan | null {
  if (!pending || pending.sessionId !== sessionId) return null;
  const scan = pending;
  pending = null;
  return scan;
}
