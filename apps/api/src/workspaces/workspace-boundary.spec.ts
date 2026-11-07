import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createConnection, type Connection } from 'mongoose';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import {
  bindWorkspaceDatabase,
  FIRST_WORKSPACE_ID,
} from './workspace-boundary';

describe('workspace sessions', () => {
  const sub = '600000000000000000000001';

  it.each([
    [FIRST_WORKSPACE_ID, undefined, true],
    [FIRST_WORKSPACE_ID, 'another-church', false],
    ['another-church', undefined, false],
    ['another-church', FIRST_WORKSPACE_ID, false],
    ['another-church', 'another-church', true],
  ])(
    'isolates %s sessions with token workspace %s',
    async (id, workspaceId, allowed) => {
      const findById = jest
        .fn()
        .mockResolvedValue({ _id: sub, isActive: true });
      const strategy = new JwtStrategy(
        new ConfigService({ workspaceId: id, jwtSecret: 'test-only-secret' }),
        { findById } as never,
        { resolve: jest.fn().mockResolvedValue({}) } as never,
      );

      if (allowed) {
        await expect(
          strategy.validate({ sub, workspaceId }),
        ).resolves.toMatchObject({ workspaceId: id });
        expect(findById).toHaveBeenCalledWith(sub);
      } else {
        await expect(strategy.validate({ sub, workspaceId })).rejects.toThrow(
          UnauthorizedException,
        );
        expect(findById).not.toHaveBeenCalled();
      }
    },
  );
});

const mongoTest = process.env.CHUFLOW_WORKSPACE_QA === '1' ? it : it.skip;

mongoTest(
  'adopts legacy data in place, refuses a wrong database, and isolates a second workspace',
  async () => {
    const connections: Connection[] = [];
    async function connect(suffix: string) {
      const connection = createConnection('mongodb://127.0.0.1:27017', {
        dbName: `chuflow_workspace_test_${process.pid}_${Date.now()}_${suffix}`,
        serverSelectionTimeoutMS: 2000,
      });
      connections.push(connection);
      return connection.asPromise();
    }

    try {
      const legacy = await connect('legacy');
      const branches = legacy.db!.collection<{ _id: string; name: string }>(
        'branches',
      );
      await branches.insertOne({ _id: 'same-id', name: 'Nashville' });

      await expect(
        bindWorkspaceDatabase(legacy, 'another-church'),
      ).rejects.toThrow('requires an empty database');
      await bindWorkspaceDatabase(legacy, FIRST_WORKSPACE_ID);
      await bindWorkspaceDatabase(legacy, FIRST_WORKSPACE_ID);
      await expect(
        bindWorkspaceDatabase(legacy, 'another-church'),
      ).rejects.toThrow('different workspace');

      const other = await connect('other');
      await bindWorkspaceDatabase(other, 'another-church');
      await expect(
        bindWorkspaceDatabase(other, FIRST_WORKSPACE_ID),
      ).rejects.toThrow('different workspace');

      const otherBranches = other.db!.collection<{ _id: string; name: string }>(
        'branches',
      );
      expect(await otherBranches.countDocuments()).toBe(0);
      await otherBranches.insertOne({ _id: 'same-id', name: 'Other station' });
      expect(await branches.findOne({ _id: 'same-id' })).toMatchObject({
        name: 'Nashville',
      });
      expect(await otherBranches.findOne({ _id: 'same-id' })).toMatchObject({
        name: 'Other station',
      });
    } finally {
      await Promise.all(
        connections.map(async (connection) => {
          try {
            if (connection.readyState === 1) await connection.dropDatabase();
          } finally {
            await connection.close();
          }
        }),
      );
    }
  },
);
