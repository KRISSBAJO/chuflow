import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { BranchDocument } from '../branches/schemas/branch.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { GuestDocument } from '../guests/schemas/guest.schema';
import { CaptureOutreachDto } from './evangelism.dto';
import {
  OutreachContactDocument,
  OutreachLinkDocument,
} from './evangelism.schema';
import { EvangelismService } from './evangelism.service';

function argument(mock: jest.Mock, index = 0): Record<string, unknown> {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][index] as Record<string, unknown>;
}

describe('Evangelism follow-up safeguards', () => {
  const branchId = new Types.ObjectId();
  const ownerId = new Types.ObjectId();
  const token = 'a'.repeat(48);
  const user: AuthUser = {
    sub: String(ownerId),
    email: 'staff@example.com',
    role: 'branch_admin',
    branchId: String(branchId),
  };
  const capture: CaptureOutreachDto = {
    firstName: 'Ada',
    lastName: 'Okoro',
    phone: '+1 (615) 555-0123',
    preferredContactMethod: 'phone_call',
    consentToContact: true,
  };
  let service: EvangelismService;
  let links: { findOne: jest.Mock; findById: jest.Mock; create: jest.Mock };
  let contacts: {
    create: jest.Mock;
    findById: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let scope: {
    ensureBranchAccess: jest.Mock;
    resolveScopedBranchId: jest.Mock;
  };
  let users: { findOne: jest.Mock };
  let guests: { findOne: jest.Mock };

  beforeEach(() => {
    guests = { findOne: jest.fn() };
    links = {
      findById: jest.fn(),
      findOne: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        branchId,
        ownerId,
        kind: 'personal',
      }),
      create: jest.fn(),
    };
    contacts = {
      create: jest.fn().mockResolvedValue({ id: 'contact-id' }),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    users = {
      findOne: jest.fn().mockResolvedValue({
        _id: ownerId,
        id: String(ownerId),
        role: 'branch_admin',
        email: user.email,
        branchId,
      }),
    };
    scope = {
      ensureBranchAccess: jest.fn().mockResolvedValue(undefined),
      resolveScopedBranchId: jest.fn().mockResolvedValue(String(branchId)),
    };
    service = new EvangelismService(
      links as unknown as Model<OutreachLinkDocument>,
      contacts as unknown as Model<OutreachContactDocument>,
      {
        findOne: jest
          .fn()
          .mockResolvedValue({ _id: branchId, name: 'Central' }),
      } as unknown as Model<BranchDocument>,
      users as unknown as Model<UserDocument>,
      guests as unknown as Model<GuestDocument>,
      scope as unknown as AccessScopeService,
    );
  });

  it('attributes a personal submission and schedules first contact without creating attendance', async () => {
    await expect(service.capturePublic(token, capture)).resolves.toEqual({
      success: true,
    });
    const payload = argument(contacts.create);
    expect(payload).toMatchObject({
      branchId,
      reachedBy: ownerId,
      assignedTo: ownerId,
      normalizedPhone: '16155550123',
      consentToContact: true,
    });
    expect((payload.nextActionDate as Date).getTime()).toBeGreaterThan(
      Date.now() + 23 * 60 * 60 * 1000,
    );
    expect(payload).not.toHaveProperty('visitDate');
    expect(
      (payload.activities as Array<Record<string, unknown>>)[0].recordedBy,
    ).toBeUndefined();
  });

  it('puts branch-link submissions into the unassigned queue', async () => {
    links.findOne.mockResolvedValue({
      _id: new Types.ObjectId(),
      branchId,
      kind: 'branch',
    });
    await service.capturePublic(token, capture);
    expect(argument(contacts.create).assignedTo).toBeUndefined();
  });

  it('does not assign to an inactive personal-link owner', async () => {
    users.findOne.mockResolvedValue(null);
    await service.capturePublic(token, capture);
    expect(argument(contacts.create).assignedTo).toBeUndefined();
  });

  it('does not expose duplicates or overwrite an existing contact through a public link', async () => {
    contacts.create.mockRejectedValue({ code: 11000 });
    await expect(service.capturePublic(token, capture)).resolves.toEqual({
      success: true,
    });
    expect(contacts.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('shows staff an actionable duplicate error', async () => {
    contacts.create.mockRejectedValue({ code: 11000 });
    await expect(
      service.captureStaff(user, { ...capture, branchId: String(branchId) }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires permission and validates phone and preferred email before storing details', async () => {
    await expect(
      service.capturePublic(token, { ...capture, consentToContact: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.capturePublic(token, { ...capture, phone: '123' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.capturePublic(token, {
        ...capture,
        preferredContactMethod: 'email',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(contacts.create).not.toHaveBeenCalled();
  });

  it('rejects paused links and malformed tokens', async () => {
    await expect(service.publicInfo('bad-token')).rejects.toThrow(
      'unavailable',
    );
    links.findOne.mockResolvedValue(null);
    await expect(service.capturePublic(token, capture)).rejects.toThrow(
      'unavailable',
    );
    expect(contacts.create).not.toHaveBeenCalled();
  });

  it('does not leak internal link or owner details on the public form', async () => {
    await expect(service.publicInfo(token)).resolves.toEqual({
      branchName: 'Central',
      churchName: 'Central',
    });
  });

  it('denies cross-branch updates before changing a contact', async () => {
    contacts.findById.mockResolvedValue({ branchId });
    scope.ensureBranchAccess.mockRejectedValue(new ForbiddenException());
    await expect(
      service.update(user, String(new Types.ObjectId()), {
        stage: 'contacted',
        note: 'Spoke today',
        contactMethod: 'phone_call',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(contacts.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('records opt-out atomically and removes the next action', async () => {
    contacts.findById.mockResolvedValue({
      _id: new Types.ObjectId(),
      branchId,
      stage: 'contacted',
      revision: 0,
      nextActionDate: new Date(),
    });
    await service.update(user, String(new Types.ObjectId()), {
      stage: 'do_not_contact',
      note: 'Asked us to stop contacting them.',
      contactMethod: 'phone_call',
    });
    const update = argument(contacts.findOneAndUpdate, 1) as {
      $set: Record<string, unknown>;
      $unset: Record<string, unknown>;
      $push: { activities: { note: string } };
    };
    expect(update.$set).toMatchObject({
      stage: 'do_not_contact',
      consentToContact: false,
    });
    expect(update.$unset).toHaveProperty('nextActionDate');
    expect(update.$push.activities.note).toContain('stop contacting');
  });

  it('does not allow an opted-out person to be reactivated', async () => {
    contacts.findById.mockResolvedValue({ branchId, stage: 'do_not_contact' });
    await expect(
      service.update(user, String(new Types.ObjectId()), {
        stage: 'contacted',
        note: 'Try again',
        contactMethod: 'phone_call',
      }),
    ).rejects.toThrow('opted out');
    expect(contacts.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('detects concurrent updates rather than losing another team member’s changes', async () => {
    contacts.findById.mockResolvedValue({
      _id: new Types.ObjectId(),
      branchId,
      stage: 'new',
      revision: 2,
    });
    contacts.findOneAndUpdate.mockResolvedValue(null);
    await expect(
      service.update(user, String(new Types.ObjectId()), {
        stage: 'contacted',
        note: 'Spoke today',
        contactMethod: 'phone_call',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(argument(contacts.findOneAndUpdate).revision).toBe(2);
  });

  it('refuses to link a guest from another branch', async () => {
    contacts.findById.mockResolvedValue({ branchId });
    guests.findOne.mockResolvedValue(null);
    await expect(
      service.linkGuest(
        user,
        String(new Types.ObjectId()),
        String(new Types.ObjectId()),
      ),
    ).rejects.toThrow('same branch');
    expect(contacts.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('connects the guest journey without creating or changing attendance', async () => {
    const guestId = new Types.ObjectId();
    contacts.findById.mockResolvedValue({
      _id: new Types.ObjectId(),
      branchId,
      revision: 0,
      stage: 'visited',
    });
    guests.findOne.mockResolvedValue({
      _id: guestId,
      firstName: 'Ada',
      lastName: 'Okoro',
    });
    await service.linkGuest(
      user,
      String(new Types.ObjectId()),
      String(guestId),
    );
    const update = argument(contacts.findOneAndUpdate, 1) as {
      $set: { guestId: Types.ObjectId };
      $push: { activities: { note: string } };
    };
    expect(update.$set.guestId).toEqual(guestId);
    expect(update.$push.activities.note).toContain(
      'No attendance record was created',
    );
  });
  it('updates the public church name without changing the shareable token or ownership', async () => {
    const link = {
      branchId,
      token,
      ownerId,
      churchName: 'Old name',
      name: 'Outreach',
      save: jest.fn().mockResolvedValue({}),
    };
    links.findById.mockResolvedValue(link);
    await service.updateLink(user, String(new Types.ObjectId()), {
      churchName: ' New Church Name ',
    });
    expect(link.churchName).toBe('New Church Name');
    expect(link.token).toBe(token);
    expect(link.ownerId).toBe(ownerId);
    expect(link.save).toHaveBeenCalled();
  });

  it('shows the configured church name on an existing public link', async () => {
    links.findOne.mockResolvedValue({ branchId, churchName: 'Grace Church' });
    await expect(service.publicInfo(token)).resolves.toEqual({
      branchName: 'Central',
      churchName: 'Grace Church',
    });
  });

  it('can restore default colors without changing the existing link', async () => {
    const link = {
      branchId,
      token,
      headerColor: '#000000',
      buttonColor: '#ff8800',
      save: jest.fn().mockResolvedValue({}),
    };
    links.findById.mockResolvedValue(link);
    await service.updateLink(user, String(new Types.ObjectId()), {
      headerColor: null,
      buttonColor: null,
    });
    expect(link.headerColor).toBeUndefined();
    expect(link.buttonColor).toBeUndefined();
    expect(link.token).toBe(token);
  });
});
