import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Guest, GuestDocument } from '../guests/schemas/guest.schema';
import {
  CaptureOutreachDto,
  CreateOutreachContactDto,
  CreateOutreachLinkDto,
  OUTREACH_STAGES,
  UpdateOutreachDto,
  UpdateOutreachLinkDto,
} from './evangelism.dto';
import {
  OutreachContact,
  OutreachContactDocument,
  OutreachLink,
  OutreachLinkDocument,
} from './evangelism.schema';

const terminalStages = ['closed', 'do_not_contact'];

export type OutreachPageResult = {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  totalPages: number;
  summary: { all: number; fresh: number; unassigned: number; overdue: number };
  stages: Record<string, number>;
};

@Injectable()
export class EvangelismService {
  constructor(
    @InjectModel(OutreachLink.name)
    private readonly links: Model<OutreachLinkDocument>,
    @InjectModel(OutreachContact.name)
    private readonly contacts: Model<OutreachContactDocument>,
    @InjectModel(Branch.name) private readonly branches: Model<BranchDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Guest.name) private readonly guests: Model<GuestDocument>,
    private readonly scope: AccessScopeService,
  ) {}

  private id(value: string) {
    if (!Types.ObjectId.isValid(value))
      throw new BadRequestException('Invalid record identifier');
    return new Types.ObjectId(value);
  }

  private async branch(user: AuthUser, requested: string) {
    this.id(requested);
    const id = await this.scope.resolveScopedBranchId(user, requested);
    const branch = await this.branches.findOne({ _id: id, status: 'active' });
    if (!branch) throw new BadRequestException('Choose an active branch');
    return branch;
  }

  private async assignee(id: string, branchId: string) {
    const person = await this.users.findOne({
      _id: this.id(id),
      isActive: true,
    });
    if (!person) throw new BadRequestException('Choose an active team member');
    await this.scope.ensureBranchAccess(
      {
        sub: String(person._id),
        email: person.email,
        role: person.role as AuthUser['role'],
        branchId: person.branchId?.toString(),
        oversightRegion: person.oversightRegion,
        district: person.district,
      },
      branchId,
    );
    return person;
  }

  async createLink(user: AuthUser, dto: CreateOutreachLinkDto) {
    if (dto.name.trim().length < 2)
      throw new BadRequestException('Give this link a descriptive name');
    if (dto.churchName !== undefined && dto.churchName.trim().length < 2)
      throw new BadRequestException('Enter a church name');
    const branch = await this.branch(user, dto.branchId);
    return this.links.create({
      branchId: branch._id,
      name: dto.name.trim(),
      churchName: dto.churchName?.trim() || branch.name,
      headerColor: dto.headerColor || undefined,
      buttonColor: dto.buttonColor || undefined,
      kind: dto.kind,
      createdBy: user.sub,
      ownerId: dto.kind === 'personal' ? user.sub : undefined,
      token: randomBytes(24).toString('hex'),
    });
  }

  async listLinks(
    user: AuthUser,
    branchId?: string,
    exportAll = false,
  ): Promise<Record<string, unknown>[]> {
    if (branchId) this.id(branchId);
    const links = await this.links
      .find(await this.scope.buildBranchFilter(user, branchId))
      .populate('branchId', 'name')
      .populate('ownerId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(exportAll ? 100001 : 200)
      .lean();
    const counts = await this.contacts.aggregate<{
      _id: Types.ObjectId;
      total: number;
    }>([
      { $match: { linkId: { $in: links.map((link) => link._id) } } },
      { $group: { _id: '$linkId', total: { $sum: 1 } } },
    ]);
    const totals = new Map(counts.map((row) => [String(row._id), row.total]));
    return links.map((link) => ({
      ...link,
      contactCount: totals.get(String(link._id)) ?? 0,
    }));
  }

  async getLink(user: AuthUser, id: string) {
    const link = await this.links.findById(this.id(id));
    if (!link) throw new NotFoundException('Link not found');
    await this.scope.ensureBranchAccess(user, String(link.branchId));
    return link.populate('branchId', 'name');
  }

  async updateLink(user: AuthUser, id: string, dto: UpdateOutreachLinkDto) {
    const link = await this.links.findById(this.id(id));
    if (!link) throw new NotFoundException('Link not found');
    await this.scope.ensureBranchAccess(user, String(link.branchId));
    if (dto.churchName !== undefined) {
      if (dto.churchName.trim().length < 2)
        throw new BadRequestException('Enter a church name');
      link.churchName = dto.churchName.trim();
    }
    if (dto.name !== undefined) {
      if (dto.name.trim().length < 2)
        throw new BadRequestException('Give this link a descriptive name');
      link.name = dto.name.trim();
    }
    if (dto.isActive !== undefined) link.isActive = dto.isActive;
    if (dto.headerColor !== undefined)
      link.headerColor = dto.headerColor || undefined;
    if (dto.buttonColor !== undefined)
      link.buttonColor = dto.buttonColor || undefined;
    return link.save();
  }

  async team(user: AuthUser, branchId: string) {
    this.id(branchId);
    await this.scope.ensureBranchAccess(user, branchId);
    return this.users
      .find({
        isActive: true,
        $or: [{ branchId: this.id(branchId) }, { _id: this.id(user.sub) }],
      })
      .select('_id firstName lastName')
      .sort({ firstName: 1, lastName: 1 })
      .lean();
  }

  async branchOptions(user: AuthUser) {
    return this.branches
      .find({
        ...(await this.scope.getBranchDocumentQuery(user)),
        status: 'active',
      })
      .select('_id name')
      .sort({ name: 1 })
      .lean();
  }

  private async publicLink(token: string) {
    if (!/^[a-f0-9]{48}$/.test(token))
      throw new NotFoundException('This link is unavailable');
    const link = await this.links.findOne({ token, isActive: true });
    if (!link) throw new NotFoundException('This link is unavailable');
    const branch = await this.branches.findOne({
      _id: link.branchId,
      status: 'active',
    });
    if (!branch) throw new NotFoundException('This link is unavailable');
    return { link, branch };
  }

  async publicInfo(token: string) {
    const { branch, link } = await this.publicLink(token);
    return {
      branchName: branch.name,
      churchName: link.churchName || branch.name,
      ...(link.headerColor ? { headerColor: link.headerColor } : {}),
      ...(link.buttonColor ? { buttonColor: link.buttonColor } : {}),
    };
  }

  private async capture(
    dto: CaptureOutreachDto,
    branchId: Types.ObjectId,
    source: {
      linkId?: Types.ObjectId;
      reachedBy?: Types.ObjectId;
      assignedTo?: Types.ObjectId;
    },
    isPublic: boolean,
  ) {
    if (dto.website) return { success: true };
    if (!dto.consentToContact)
      throw new BadRequestException('Permission to follow up is required');
    if (dto.preferredContactMethod === 'email' && !dto.email)
      throw new BadRequestException(
        'An email address is required when email is the preferred contact method',
      );
    const phone = dto.phone.replace(/\D/g, '');
    if (phone.length < 7 || phone.length > 15)
      throw new BadRequestException(
        'Enter a valid phone number, including country code',
      );
    if (!dto.firstName.trim() || !dto.lastName.trim())
      throw new BadRequestException('First and last name are required');
    const now = new Date();
    try {
      const contact = await this.contacts.create({
        branchId,
        ...source,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone.trim(),
        normalizedPhone: phone,
        email: dto.email?.trim().toLowerCase(),
        city: dto.city?.trim(),
        prayerRequest: dto.prayerRequest?.trim(),
        preferredContactMethod: dto.preferredContactMethod,
        interest: dto.interest,
        preferredContactTime: dto.preferredContactTime?.trim(),
        consentToContact: true,
        consentRecordedAt: now,
        nextActionDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        activities: [
          {
            note: 'Contact received with permission to follow up. Make first contact within 24 hours.',
            stage: 'new',
            contactMethod: 'registration',
            recordedBy: isPublic ? undefined : source.reachedBy,
            assignedTo: source.assignedTo,
            nextActionDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            createdAt: now,
          },
        ],
      });
      return isPublic ? { success: true } : { id: String(contact._id) };
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        if (isPublic) return { success: true };
        throw new ConflictException(
          'This phone number is already in this branch’s evangelism contacts. Open the existing record to continue follow-up.',
        );
      }
      throw error;
    }
  }

  async capturePublic(token: string, dto: CaptureOutreachDto) {
    const { link } = await this.publicLink(token);
    let owner: Types.ObjectId | undefined;
    if (link.ownerId) {
      // A link still accepts contacts if its original owner has left; the branch can reassign them.
      try {
        const person = await this.assignee(
          String(link.ownerId),
          String(link.branchId),
        );
        owner = person._id;
      } catch {
        owner = undefined;
      }
    }
    return this.capture(
      dto,
      link.branchId,
      { linkId: link._id, reachedBy: link.ownerId, assignedTo: owner },
      true,
    );
  }

  async captureStaff(user: AuthUser, dto: CreateOutreachContactDto) {
    const branch = await this.branch(user, dto.branchId);
    return this.capture(
      dto,
      branch._id,
      { reachedBy: this.id(user.sub), assignedTo: this.id(user.sub) },
      false,
    );
  }

  async list(
    user: AuthUser,
    params: {
      branchId?: string;
      stage?: string;
      queue?: string;
      search?: string;
      page?: string;
    },
  ): Promise<OutreachPageResult> {
    if (params.branchId) this.id(params.branchId);
    const scope = await this.scope.buildBranchFilter(user, params.branchId);
    const active = { ...scope, stage: { $nin: terminalStages } };
    const query: Record<string, unknown> = { ...scope };
    if (
      params.stage &&
      OUTREACH_STAGES.includes(params.stage as (typeof OUTREACH_STAGES)[number])
    )
      query.stage = params.stage;
    if (params.queue === 'mine') query.assignedTo = this.id(user.sub);
    if (params.queue === 'unassigned') query.assignedTo = { $exists: false };
    if (params.queue === 'overdue') {
      query.nextActionDate = { $lt: new Date() };
      query.stage = { $nin: terminalStages };
    }
    const search = params.search?.trim().slice(0, 100);
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = ['firstName', 'lastName', 'phone', 'email'].map((field) => ({
        [field]: { $regex: escaped, $options: 'i' },
      }));
    }
    const [total, all, fresh, unassigned, overdue, stages] = await Promise.all([
      this.contacts.countDocuments(query),
      this.contacts.countDocuments(scope),
      this.contacts.countDocuments({ ...scope, stage: 'new' }),
      this.contacts.countDocuments({
        ...active,
        assignedTo: { $exists: false },
      }),
      this.contacts.countDocuments({
        ...active,
        nextActionDate: { $lt: new Date() },
      }),
      this.contacts.aggregate<{ _id: string; total: number }>([
        { $match: scope },
        { $group: { _id: '$stage', total: { $sum: 1 } } },
      ]),
    ]);
    const page = Math.min(
      Math.max(1, Number(params.page) || 1),
      Math.max(1, Math.ceil(total / 30)),
    );
    const items = await this.contacts
      .find(query)
      .select('-activities')
      .populate('branchId', 'name')
      .populate('assignedTo', 'firstName lastName')
      .populate('reachedBy', 'firstName lastName')
      .sort(
        params.queue === 'overdue'
          ? { nextActionDate: 1, _id: 1 }
          : { createdAt: -1, _id: -1 },
      )
      .skip((page - 1) * 30)
      .limit(30)
      .lean();
    return {
      items: items.map((item) => ({
        ...item,
        isOverdue:
          !!item.nextActionDate &&
          item.nextActionDate.getTime() < Date.now() &&
          !terminalStages.includes(item.stage),
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / 30)),
      summary: { all, fresh, unassigned, overdue },
      stages: Object.fromEntries(stages.map((row) => [row._id, row.total])),
    };
  }

  async detail(user: AuthUser, id: string) {
    const contact = await this.contacts.findById(this.id(id));
    if (!contact) throw new NotFoundException('Contact not found');
    await this.scope.ensureBranchAccess(user, String(contact.branchId));
    return contact.populate([
      { path: 'guestId', select: 'firstName lastName convertedToMember' },
      { path: 'branchId', select: 'name' },
      {
        path: 'assignedTo reachedBy activities.recordedBy activities.assignedTo',
        select: 'firstName lastName',
      },
      { path: 'linkId', select: 'name kind' },
    ]);
  }

  async guestMatches(user: AuthUser, id: string) {
    const contact = await this.contacts.findById(this.id(id));
    if (!contact) throw new NotFoundException('Contact not found');
    await this.scope.ensureBranchAccess(user, String(contact.branchId));
    const phonePattern =
      '^\\D*' + contact.normalizedPhone.split('').join('\\D*') + '\\D*$';
    return this.guests
      .find({
        branchId: contact.branchId,
        $or: [
          { phone: { $regex: phonePattern } },
          ...(contact.email
            ? [
                {
                  email: {
                    $regex:
                      '^' +
                      contact.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                      '$',
                    $options: 'i',
                  },
                },
              ]
            : []),
        ],
      })
      .select('_id firstName lastName phone')
      .limit(20)
      .lean();
  }

  async linkGuest(user: AuthUser, id: string, guestId: string) {
    const contact = await this.contacts.findById(this.id(id));
    if (!contact) throw new NotFoundException('Contact not found');
    await this.scope.ensureBranchAccess(user, String(contact.branchId));
    if (contact.guestId) {
      if (String(contact.guestId) === guestId) return { success: true };
      throw new ConflictException(
        'This outreach contact already has a linked guest record.',
      );
    }
    const guest = await this.guests.findOne({
      _id: this.id(guestId),
      branchId: contact.branchId,
    });
    if (!guest)
      throw new BadRequestException('Choose a guest from the same branch');
    const updated = await this.contacts.findOneAndUpdate(
      {
        _id: contact._id,
        revision: contact.revision,
        guestId: { $exists: false },
      },
      {
        $set: { guestId: guest._id },
        $inc: { revision: 1 },
        $push: {
          activities: {
            note: `Linked to guest record for ${guest.firstName} ${guest.lastName}. No attendance record was created by this action.`,
            stage: contact.stage,
            contactMethod: 'administrative',
            recordedBy: this.id(user.sub),
            assignedTo: contact.assignedTo,
            nextActionDate: contact.nextActionDate,
            createdAt: new Date(),
          },
        },
      },
    );
    if (!updated)
      throw new ConflictException(
        'The contact changed. Refresh and try again.',
      );
    return { success: true };
  }

  async update(user: AuthUser, id: string, dto: UpdateOutreachDto) {
    const contact = await this.contacts.findById(this.id(id));
    if (!contact) throw new NotFoundException('Contact not found');
    await this.scope.ensureBranchAccess(user, String(contact.branchId));
    if (!dto.note.trim()) throw new BadRequestException('Add a follow-up note');
    if (contact.stage === 'do_not_contact' && dto.stage !== 'do_not_contact')
      throw new BadRequestException(
        'This person has opted out. Do not contact them.',
      );
    if (
      contact.stage === 'do_not_contact' &&
      dto.contactMethod !== 'administrative'
    )
      throw new BadRequestException(
        'Only administrative notes can be added after opt-out',
      );
    if (dto.assignedTo && dto.unassign)
      throw new BadRequestException('Choose an owner or unassign, not both');
    if (dto.nextActionDate && dto.clearNextAction)
      throw new BadRequestException(
        'Choose a next action date or clear it, not both',
      );
    if (dto.assignedTo)
      await this.assignee(dto.assignedTo, String(contact.branchId));
    const assignedTo = dto.unassign
      ? undefined
      : dto.assignedTo
        ? this.id(dto.assignedTo)
        : contact.assignedTo;
    const nextActionDate =
      terminalStages.includes(dto.stage) || dto.clearNextAction
        ? undefined
        : dto.nextActionDate
          ? new Date(dto.nextActionDate)
          : contact.nextActionDate;
    const set: Record<string, unknown> = { stage: dto.stage };
    const unset: Record<string, string> = {};
    if (assignedTo) set.assignedTo = assignedTo;
    else unset.assignedTo = '';
    if (nextActionDate) set.nextActionDate = nextActionDate;
    else unset.nextActionDate = '';
    if (dto.stage === 'do_not_contact') set.consentToContact = false;
    const updated = await this.contacts.findOneAndUpdate(
      { _id: contact._id, revision: contact.revision },
      {
        $set: set,
        $unset: unset,
        $inc: { revision: 1 },
        $push: {
          activities: {
            note: dto.note.trim(),
            stage: dto.stage,
            contactMethod: dto.contactMethod,
            recordedBy: this.id(user.sub),
            assignedTo,
            nextActionDate,
            createdAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated)
      throw new ConflictException(
        'Another team member updated this contact. Refresh and try again.',
      );
    return { success: true };
  }
}
