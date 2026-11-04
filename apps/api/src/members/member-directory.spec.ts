import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { GuestsService } from '../guests/guests.service';
import { GuestDocument } from '../guests/schemas/guest.schema';
import { ServiceUnitDocument } from '../service-units/schemas/service-unit.schema';
import { MembersService } from './members.service';
import { MemberDocument } from './schemas/member.schema';

jest.mock('../guests/guests.service', () => ({ GuestsService: class {} }));

describe('Member directory at scale', () => {
  const branchId = new Types.ObjectId();
  const user: AuthUser = {
    sub: String(new Types.ObjectId()),
    email: 'admin@example.com',
    role: 'branch_admin',
    branchId: String(branchId),
  };
  let service: MembersService;
  let find: jest.Mock;
  let chain: {
    populate: jest.Mock;
    collation: jest.Mock;
    sort: jest.Mock;
    skip: jest.Mock;
    limit: jest.Mock;
    lean: jest.Mock;
  };
  beforeEach(() => {
    chain = {
      populate: jest.fn(),
      collation: jest.fn(),
      sort: jest.fn(),
      skip: jest.fn(),
      limit: jest.fn(),
      lean: jest.fn().mockResolvedValue([{ firstName: 'Ada' }]),
    };
    for (const method of [
      'populate',
      'collation',
      'sort',
      'skip',
      'limit',
    ] as const)
      chain[method].mockReturnValue(chain);
    find = jest.fn().mockReturnValue(chain);
    service = new MembersService(
      {
        find,
        countDocuments: jest.fn().mockResolvedValue(1000),
      } as unknown as Model<MemberDocument>,
      {
        countDocuments: jest.fn().mockResolvedValue(12),
      } as unknown as Model<GuestDocument>,
      {} as Model<ServiceUnitDocument>,
      {} as GuestsService,
      {
        buildBranchFilter: jest
          .fn()
          .mockResolvedValue({ branchId: { $in: [branchId] } }),
      } as unknown as AccessScopeService,
    );
  });

  it('fetches only page 40 of 1,000 members and retains the full total', async () => {
    const result = await service.directory(user, {
      page: '40',
      pageSize: '25',
    });
    expect(chain.skip).toHaveBeenCalledWith(975);
    expect(chain.limit).toHaveBeenCalledWith(25);
    expect(result.pagination).toEqual({
      page: 40,
      pageSize: 25,
      total: 1000,
      totalPages: 40,
    });
    expect(result.summary.total).toBe(1000);
  });

  it('clamps stale page numbers after filters change', async () => {
    const result = await service.directory(user, {
      page: '9000',
      pageSize: '100',
    });
    expect(result.pagination.page).toBe(10);
    expect(chain.skip).toHaveBeenCalledWith(900);
  });

  it('combines filters with branch access and escapes literal search terms', async () => {
    await service.directory(user, {
      search: 'Ada .*',
      status: 'active',
      foundation: 'pending',
      sort: 'name_asc',
    });
    const calls = find.mock.calls as unknown[][];
    const query = calls[0][0] as Record<string, unknown>;
    expect(query.branchId).toEqual({ $in: [branchId] });
    expect(query.membershipStatus).toBe('active');
    const clauses = query.$and as Array<{
      $or: Array<Record<string, { $regex: string }>>;
    }>;
    expect(clauses[1].$or[0].firstName.$regex).toBe('\\.\\*');
    expect(chain.sort).toHaveBeenCalledWith({
      firstName: 1,
      lastName: 1,
      _id: 1,
    });
  });
});
