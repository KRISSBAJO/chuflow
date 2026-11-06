import { BadRequestException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { ChildRoom, ChildVisit } from './children.schema';
export const cardToken = () => 'cfc_' + randomBytes(24).toString('base64url');
export const pickupToken = () => 'cfp_' + randomBytes(24).toString('base64url');
export const tokenHash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const pickupDisplay = () => randomBytes(5).toString('hex').toUpperCase();
export function ageMonths(birthDate: string, at = new Date()) {
  const d = new Date(birthDate + 'T00:00:00Z');
  if (
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== birthDate ||
    d > at
  )
    throw new BadRequestException(
      'Enter a valid birth date that is not in the future.',
    );
  return (
    (at.getUTCFullYear() - d.getUTCFullYear()) * 12 +
    at.getUTCMonth() -
    d.getUTCMonth() -
    (at.getUTCDate() < d.getUTCDate() ? 1 : 0)
  );
}
export function checkRoom(
  room: ChildRoom,
  birthDate: string,
  visits: ChildVisit[],
  added: number,
  at: Date,
) {
  const age = ageMonths(birthDate, at);
  if (age < room.minMonths || age > room.maxMonths)
    throw new BadRequestException('Choose an age-appropriate classroom.');
  if (
    visits.filter((v) => v.roomId === room.id && v.status === 'checked_in')
      .length +
      added >
    room.capacity
  )
    throw new BadRequestException(
      `${room.name} is full. Ask the supervisor for help.`,
    );
}
export function requireUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length)
    throw new BadRequestException(`Select each ${label} only once.`);
}
export function validatePickup(
  child: { pickupGuardianIds: string[] },
  guardianId: string,
  confirmed: boolean,
) {
  if (!confirmed)
    throw new BadRequestException(
      'Confirm the collecting adult’s identity before releasing the child.',
    );
  if (!child.pickupGuardianIds.includes(guardianId))
    throw new BadRequestException(
      'This adult is not authorized to collect this child. A pickup receipt does not override this restriction.',
    );
}
