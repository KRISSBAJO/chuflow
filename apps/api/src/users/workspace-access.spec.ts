import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
const viewer: AuthUser = {
  sub: '111111111111111111111111',
  email: 'admin@example.com',
  role: 'district_admin',
  district: 'One',
  oversightRegion: 'Nation',
};
describe('user detail workspace access', () => {
  function fixture() {
    const chain = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    const branches = { find: jest.fn().mockReturnValue(chain) };
    const scope = {
      getBranchDocumentQuery: jest
        .fn()
        .mockResolvedValueOnce({ areaId: 'assigned-area' })
        .mockResolvedValueOnce({ district: 'One' }),
      oversightAssignments: jest.fn().mockResolvedValue([]),
    };
    const service = new UsersService(
      {} as never,
      branches as never,
      {} as never,
      scope as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, branches, scope };
  }
  it('intersects the target access with the viewing administrator scope', async () => {
    const f = fixture();
    jest.spyOn(f.service, 'findOneForAdmin').mockResolvedValue({
      _id: '222222222222222222222222',
      email: 'pastor@example.com',
      role: 'resident_pastor',
      branchId: '333333333333333333333333',
    } as never);
    await f.service.accessDetails(viewer, '222222222222222222222222');
    expect(f.branches.find).toHaveBeenCalledWith({
      $and: [{ areaId: 'assigned-area' }, { district: 'One' }],
    });
  });
  it('checks the target authorization before reading churches or appointments', async () => {
    const f = fixture();
    jest
      .spyOn(f.service, 'findOneForAdmin')
      .mockRejectedValue(new ForbiddenException());
    await expect(
      f.service.accessDetails(viewer, '222222222222222222222222'),
    ).rejects.toThrow(ForbiddenException);
    expect(f.branches.find).not.toHaveBeenCalled();
    expect(f.scope.oversightAssignments).not.toHaveBeenCalled();
  });
});
