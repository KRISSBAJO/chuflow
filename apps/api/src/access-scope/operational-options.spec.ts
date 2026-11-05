import { ForbiddenException } from '@nestjs/common';
import { BranchesService } from '../branches/branches.service';
import { UsersService } from '../users/users.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

const user: AuthUser = {
  sub: 'worker-id',
  email: 'worker@example.test',
  role: 'follow_up',
  branchId: 'branch-a',
};
function query() {
  return {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  };
}
describe('Operational dropdown scope and data minimization', () => {
  it('applies accessible branches before returning branch labels', async () => {
    const chain = query();
    const branchModel = { find: jest.fn(() => chain) };
    const accessScopeService = {
      getBranchDocumentQuery: jest
        .fn()
        .mockResolvedValue({ _id: { $in: ['branch-a'] } }),
    };
    await BranchesService.prototype.findOptions.call(
      { branchModel, accessScopeService } as unknown as BranchesService,
      user,
    );
    expect(branchModel.find).toHaveBeenCalledWith({
      _id: { $in: ['branch-a'] },
    });
    expect(chain.select).toHaveBeenCalledWith(
      '_id name oversightRegion district',
    );
  });
  it('returns active care-worker labels within the authorized branch, without account details', async () => {
    const chain = query();
    const userModel = { find: jest.fn(() => chain) };
    const accessScopeService = {
      buildBranchFilter: jest
        .fn()
        .mockResolvedValue({ branchId: { $in: ['branch-a'] } }),
    };
    await UsersService.prototype.assignmentOptions.call(
      { userModel, accessScopeService } as unknown as UsersService,
      user,
      'branch-a',
    );
    expect(accessScopeService.buildBranchFilter).toHaveBeenCalledWith(
      user,
      'branch-a',
    );
    expect(userModel.find).toHaveBeenCalledWith({
      branchId: { $in: ['branch-a'] },
      isActive: true,
      role: {
        $in: [
          'branch_admin',
          'resident_pastor',
          'associate_pastor',
          'follow_up',
        ],
      },
    });
    expect(chain.select).toHaveBeenCalledWith(
      '_id firstName lastName role branchId',
    );
  });
  it('rejects an inaccessible branch before querying people', async () => {
    const userModel = { find: jest.fn() };
    const accessScopeService = {
      buildBranchFilter: jest.fn().mockRejectedValue(new ForbiddenException()),
    };
    await expect(
      UsersService.prototype.assignmentOptions.call(
        { userModel, accessScopeService } as unknown as UsersService,
        user,
        'branch-b',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(userModel.find).not.toHaveBeenCalled();
  });
});
