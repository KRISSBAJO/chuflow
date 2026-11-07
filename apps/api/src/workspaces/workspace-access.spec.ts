import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync } from 'node:crypto';
import type { Connection } from 'mongoose';
import { WorkspaceAccessService } from './workspace-access.service';

describe('workspace handoffs', () => {
  const source = '600000000000000000000001';
  const target = '600000000000000000000002';
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const encode = (value: string) => Buffer.from(value).toString('base64');

  function setup() {
    const membership = {
      _id: source + ':test-church',
      accountId: source,
      targetUserId: target,
      workspaceId: 'test-church',
      workspaceName: 'Test Church',
      enabled: true,
    };
    const memberships = {
      find: jest.fn((query) => ({
        sort: () => ({
          toArray: async () => (query.accountId === source ? [membership] : []),
        }),
      })),
      findOne: jest.fn(async (query) =>
        query._id === membership._id ? membership : null,
      ),
    };
    const redemptions = new Set<string>();
    const connection = {
      db: {
        collection: (name: string) =>
          name === 'workspace_memberships'
            ? memberships
            : {
                insertOne: async ({ _id }: { _id: string }) => {
                  if (redemptions.has(_id)) throw { code: 11000 };
                  redemptions.add(_id);
                },
              },
      },
    } as unknown as Connection;
    const jwt = new JwtService({
      secret: 'separate-local-session-secret',
      signOptions: { expiresIn: '1d' },
    });
    const directory = new WorkspaceAccessService(
      connection,
      new ConfigService({
        workspaceDirectorySigningKey: encode(keys.privateKey),
      }),
      jwt,
    );
    const receiver = (workspaceId: string) =>
      new WorkspaceAccessService(
        connection,
        new ConfigService({
          workspaceId,
          workspaceDirectoryVerificationKey: encode(keys.publicKey),
        }),
        jwt,
      );
    return { directory, receiver, jwt };
  }

  it('only lists and issues handoffs for an explicitly linked account', async () => {
    const { directory } = setup();
    expect(await directory.list(target)).toHaveLength(1);
    expect(await directory.list(source)).toContainEqual({
      id: 'test-church',
      name: 'Test Church',
      current: false,
    });
    await expect(
      directory.createHandoff(target, 'test-church'),
    ).rejects.toHaveProperty('status', 403);
  });

  it('enforces the intended workspace, expiry, signature and single use', async () => {
    const { directory, receiver, jwt } = setup();
    const { handoff, expiresIn } = await directory.createHandoff(
      source,
      'test-church',
    );
    const tenant = receiver('test-church');
    expect(expiresIn).toBe(60);
    await expect(
      receiver('other-church').redeem(handoff),
    ).rejects.toHaveProperty('status', 401);
    await expect(
      tenant.redeem(jwt.sign({ sub: target })),
    ).rejects.toHaveProperty('status', 401);
    const expired = jwt.sign(
      {},
      {
        secret: keys.privateKey,
        algorithm: 'RS256',
        issuer: 'chuflow-workspace-directory',
        subject: target,
        audience: 'test-church',
        jwtid: 'expired',
        expiresIn: -1,
      },
    );
    await expect(tenant.redeem(expired)).rejects.toHaveProperty('status', 401);
    await expect(tenant.redeem(handoff)).resolves.toBe(target);
    await expect(tenant.redeem(handoff)).rejects.toHaveProperty('status', 401);
  });
});
