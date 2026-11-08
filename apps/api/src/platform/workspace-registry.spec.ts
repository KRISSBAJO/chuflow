/* eslint-disable @typescript-eslint/no-require-imports */
import { randomBytes } from 'node:crypto';
import { openSecret, sealSecret } from './workspace-secrets';

const gateway = require('../../scripts/workspace-gateway.cjs') as {
  readRegistry: (
    env: Record<string, string | undefined>,
    extra?: unknown[],
  ) => Map<
    string,
    {
      status: string;
      jwtSecret: string;
      databaseName?: string;
      mongodbUri?: string;
    }
  >;
  registryFromRecords: (
    records: unknown[],
    env: Record<string, string | undefined>,
  ) => unknown[];
};

describe('sealed workspace secrets', () => {
  const key = randomBytes(32).toString('base64');

  it('round-trips and refuses the wrong key or a tampered value', () => {
    const sealed = sealSecret('a-signing-secret-of-decent-length', key);
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(openSecret(sealed, key)).toBe('a-signing-secret-of-decent-length');
    expect(() =>
      openSecret(sealed, randomBytes(32).toString('base64')),
    ).toThrow();
    expect(() => openSecret(sealed.slice(0, -2) + 'zz', key)).toThrow();
    expect(() => sealSecret('x', 'short')).toThrow(/32 bytes/);
  });
});

describe('gateway registry from the control database', () => {
  const key = randomBytes(32).toString('base64');
  const env = {
    MONGODB_URI: 'mongodb://127.0.0.1:27017/church_mgt',
    JWT_SECRET: 'primary-secret-with-enough-length',
    CONTROL_ENCRYPTION_KEY: key,
  };
  const record = (id: string, status: string) => ({
    _id: id,
    name: id,
    status,
    databaseName: 'chuflow_' + id.replace(/-/g, '_'),
    jwtSecret: sealSecret(randomBytes(32).toString('hex'), key),
    adminEmail: `admin@${id}.church`,
    adminPassword: sealSecret('generated-password-20', key),
  });

  it('serves active and suspended workspaces and drops the rest', () => {
    const entries = gateway.registryFromRecords(
      [
        record('alpha-church', 'active'),
        record('beta-church', 'suspended'),
        record('old-church', 'archived'),
        record('new-church', 'provisioning'),
      ],
      env,
    );
    const registry = gateway.readRegistry(env, entries);
    expect([...registry.keys()]).toEqual(['alpha-church', 'beta-church']);
    expect(registry.get('alpha-church')).toMatchObject({
      status: 'active',
      databaseName: 'chuflow_alpha_church',
      mongodbUri: env.MONGODB_URI,
    });
    expect(registry.get('beta-church')?.status).toBe('suspended');
    expect(registry.get('alpha-church')?.jwtSecret).toHaveLength(64);
  });

  it('still refuses a workspace that would share the primary database or key', () => {
    const clash = {
      ...record('clash-church', 'active'),
      databaseName: 'church_mgt',
    };
    expect(() =>
      gateway.readRegistry(env, gateway.registryFromRecords([clash], env)),
    ).toThrow(/distinct database/);
  });
});
