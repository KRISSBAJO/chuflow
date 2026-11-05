import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
export const HIERARCHY_MANAGERS = [
  'super_admin',
  'national_admin',
  'district_admin',
];
export function hierarchyId(value: string) {
  if (!Types.ObjectId.isValid(value))
    throw new BadRequestException('Invalid hierarchy record.');
  return new Types.ObjectId(value);
}
export function hierarchyParent(kind: string, parentKind?: string) {
  if (
    (kind === 'district' && parentKind) ||
    (kind === 'zone' && parentKind !== 'district') ||
    (kind === 'area' && parentKind !== 'zone')
  )
    throw new BadRequestException(
      'Districts contain zones; zones contain areas.',
    );
}
export function ensureHierarchyManager(
  u: AuthUser,
  district: { oversightRegion: string; name: string },
) {
  if (!HIERARCHY_MANAGERS.includes(u.role))
    throw new ForbiddenException(
      'Only an authorized administrator can change church structure or appointments.',
    );
  if (
    u.role !== 'super_admin' &&
    (!u.oversightRegion || u.oversightRegion !== district.oversightRegion)
  )
    throw new ForbiddenException('This district is outside your region.');
  if (
    u.role === 'district_admin' &&
    (!u.district || u.district !== district.name)
  )
    throw new ForbiddenException(
      'This district is outside your responsibility.',
    );
}
