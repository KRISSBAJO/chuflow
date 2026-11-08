import { Model, Types, model, models } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { GuestsService } from '../guests/guests.service';
import { GuestDocument } from '../guests/schemas/guest.schema';
import {
  ServiceUnitDocument,
  ServiceUnitSchema,
} from '../service-units/schemas/service-unit.schema';
import { MembersService } from './members.service';
import { MemberDocument, MemberSchema } from './schemas/member.schema';

jest.mock('../guests/guests.service', () => ({ GuestsService: class {} }));

describe('Multiple service-group membership', () => {
  it('keeps older records distinguishable from an explicitly cleared group list', async () => {
    if (!models.ServiceUnit) model('ServiceUnit', ServiceUnitSchema);
    const MemberModel =
      (models.MultiGroupCompatibility as Model<MemberDocument> | undefined) ||
      model<MemberDocument>('MultiGroupCompatibility', MemberSchema);
    const legacy = new MemberModel({ firstName: 'Ada', lastName: 'Okoro' });
    expect(legacy.get('serviceUnitIds')).toBeUndefined();
    const populated = await MemberModel.populate<{ firstName: string }>(
      { firstName: 'Ada' },
      { path: 'serviceUnitIds' },
    );
    expect(populated).not.toHaveProperty('serviceUnitIds');
  });
  const branch = new Types.ObjectId();
  const first = { _id: new Types.ObjectId(), name: 'Choir', branchId: branch };
  const second = {
    _id: new Types.ObjectId(),
    name: 'Ushering',
    branchId: branch,
  };
  const user: AuthUser = {
    sub: String(new Types.ObjectId()),
    email: 'admin@example.com',
    role: 'branch_admin',
    branchId: String(branch),
  };
  const basic = {
    branchId: String(branch),
    firstName: 'Ada',
    lastName: 'Okoro',
  };
  let service: MembersService;
  let create: jest.Mock;
  let update: jest.Mock;
  let findUnits: jest.Mock;
  let resolvedBranch: jest.Mock;

  beforeEach(() => {
    create = jest.fn().mockResolvedValue({});
    const chain = {
      select: jest.fn(),
      populate: jest.fn(),
      lean: jest.fn().mockResolvedValue({}),
    };
    chain.select.mockReturnValue(chain);
    chain.populate.mockReturnValue(chain);
    update = jest.fn().mockReturnValue(chain);
    findUnits = jest
      .fn()
      .mockReturnValue({ lean: jest.fn().mockResolvedValue([first, second]) });
    resolvedBranch = jest.fn().mockResolvedValue(String(branch));
    service = new MembersService(
      { create, findByIdAndUpdate: update } as unknown as Model<MemberDocument>,
      {} as Model<GuestDocument>,
      { find: findUnits } as unknown as Model<ServiceUnitDocument>,
      {} as GuestsService,
      {
        resolveScopedBranchId: resolvedBranch,
      } as unknown as AccessScopeService,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      branchId: { _id: branch },
      firstName: 'Ada',
      lastName: 'Okoro',
      serviceUnitId: first,
      serviceUnitIds: [first, second],
    } as unknown as Awaited<ReturnType<MembersService['findOne']>>);
  });
  const argument = (mock: jest.Mock, index = 0) =>
    (mock.mock.calls as unknown[][])[0][index] as Record<string, unknown>;

  it('saves several groups while preserving a primary reference for older clients', async () => {
    await service.create(
      { ...basic, serviceUnitIds: [String(first._id), String(second._id)] },
      user,
    );
    expect(argument(create).serviceUnitIds).toEqual([first._id, second._id]);
    expect(argument(create).serviceUnitId).toEqual(first._id);
  });

  it('deduplicates repeated assignments', async () => {
    findUnits.mockReturnValue({ lean: jest.fn().mockResolvedValue([first]) });
    await service.create(
      { ...basic, serviceUnitIds: [String(first._id), String(first._id)] },
      user,
    );
    expect(argument(create).serviceUnitIds).toEqual([first._id]);
  });

  it('does not restore a legacy group when an explicit empty selection was sent', async () => {
    await service.create(
      { ...basic, serviceUnitIds: [], serviceUnitInterest: 'Choir' },
      user,
    );
    expect(argument(create).serviceUnitIds).toEqual([]);
    expect(findUnits).not.toHaveBeenCalled();
  });

  it('continues accepting older single-group requests', async () => {
    findUnits.mockReturnValue({ lean: jest.fn().mockResolvedValue([first]) });
    await service.create({ ...basic, serviceUnitId: String(first._id) }, user);
    expect(argument(create).serviceUnitIds).toEqual([first._id]);
  });

  it('rejects groups from another branch', async () => {
    findUnits.mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue([{ ...first, branchId: new Types.ObjectId() }]),
    });
    await expect(
      service.create({ ...basic, serviceUnitIds: [String(first._id)] }, user),
    ).rejects.toThrow('branch');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects missing groups instead of silently dropping selections', async () => {
    findUnits.mockReturnValue({ lean: jest.fn().mockResolvedValue([first]) });
    await expect(
      service.create(
        { ...basic, serviceUnitIds: [String(first._id), String(second._id)] },
        user,
      ),
    ).rejects.toThrow('not found');
  });

  it('clears all assignments, including the older primary field', async () => {
    await service.update(
      String(new Types.ObjectId()),
      { serviceUnitIds: [] },
      user,
    );
    expect(argument(update, 1).serviceUnitIds).toEqual([]);
    expect(argument(update, 1).$unset).toEqual({
      serviceUnitId: '',
      serviceUnitInterest: '',
    });
  });

  it('leaves assignments untouched on unrelated profile edits', async () => {
    await service.update(
      String(new Types.ObjectId()),
      { familyDetails: 'Updated household' },
      user,
    );
    expect(findUnits).not.toHaveBeenCalled();
    expect(argument(update, 1)).not.toHaveProperty('serviceUnitIds');
    expect(argument(update, 1)).not.toHaveProperty('$unset');
  });

  it('resolves multiple group names from the public member form', async () => {
    await service.create(
      { ...basic, serviceUnitNames: ['Choir', 'Ushering'] },
      user,
    );
    expect(argument(create).serviceUnitIds).toEqual([first._id, second._id]);
  });

  it('validates carried-over memberships when the member changes branch', async () => {
    resolvedBranch.mockResolvedValue(String(new Types.ObjectId()));
    await expect(
      service.update(
        String(new Types.ObjectId()),
        { branchId: String(new Types.ObjectId()) },
        user,
      ),
    ).rejects.toThrow('branch');
    expect(update).not.toHaveBeenCalled();
  });
  it('section edits preserve unrelated fields and clear only explicitly emptied optional fields', async () => {
    await service.update(
      'member-id',
      { bccStatus: 'yes', bccLocation: '' },
      user,
    );
    const payload = argument(update, 1);
    expect(payload.bccStatus).toBe('yes');
    expect(payload).not.toHaveProperty('firstName');
    expect(payload).not.toHaveProperty('membershipStatus');
    expect(payload).not.toHaveProperty('serviceUnitIds');
    expect(payload.$unset).toEqual({ bccLocation: '' });
  });
});
