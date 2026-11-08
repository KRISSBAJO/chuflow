/* eslint-disable @typescript-eslint/no-require-imports */
// The gateway script (CommonJS) and the API share one implementation so sealed values match.
const secrets = require('../../scripts/workspace-secrets.cjs') as {
  seal: (plaintext: string, encodedKey: string) => string;
  open: (sealed: string, encodedKey: string) => string;
  loadKey: (encoded: string) => Buffer;
};

export const sealSecret = secrets.seal;
export const openSecret = secrets.open;
export const loadControlKey = secrets.loadKey;
