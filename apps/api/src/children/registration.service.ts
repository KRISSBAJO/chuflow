import { Optional } from '@nestjs/common';
import { GuestFieldsService, MinistryFormKind } from '../guests/guest-fields.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { ChildrenService } from './children.service';
import { ChildFamily } from './children.schema';
import { Branch } from '../branches/schemas/branch.schema';
import {
  ChildrenRegistration,
  ChildrenRegistrationLink,
} from './registration.schema';
import {
  ParentRegistrationDto,
  RegistrationReviewDto,
} from './registration.dto';
import { ChildrenQueryDto } from './children.dto';
import { ageMonths, tokenHash, requireUnique } from './children.logic';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
export function registrationUuid(key: string) {
  const h = createHash('sha256').update(key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function validateParentSubmission(d: ParentRegistrationDto) {
  if (!d.consent)
    throw new BadRequestException('Guardian permission is required.');
  if (
    !d.familyName.trim() ||
    d.adults.some(
      (a) =>
        !a.firstName.trim() ||
        !a.lastName.trim() ||
        a.phone.replace(/\D/g, '').length < 5,
    )
  )
    throw new BadRequestException(
      'Enter the family and adult contact details.',
    );
  for (const c of d.children) {
    if (
      !c.firstName.trim() ||
      !c.lastName.trim() ||
      ageMonths(c.birthDate) >= 216
    )
      throw new BadRequestException(
        'Enter a valid child name and birth date (under 18).',
      );
    requireUnique(c.pickupAdults.map(String), 'pickup adult');
    if (!c.pickupAdults.length || c.pickupAdults.some((i) => !d.adults[i]))
      throw new BadRequestException(
        'Choose at least one listed pickup adult for every child.',
      );
  }
}
@Injectable()
export class ChildrenRegistrationService {
  constructor(
    @InjectModel(ChildrenRegistrationLink.name)
    private readonly links: Model<ChildrenRegistrationLink>,
    @InjectModel(ChildrenRegistration.name)
    private readonly registrations: Model<ChildrenRegistration>,
    @InjectModel(ChildFamily.name)
    private readonly families: Model<ChildFamily>,
    @InjectModel(Branch.name) private readonly branches: Model<Branch>,
    private readonly ministry: ChildrenService,
    @Optional() private readonly forms?: GuestFieldsService,
  ) {}
  private id(v: string) {
    if (!Types.ObjectId.isValid(v))
      throw new BadRequestException('Invalid registration record.');
    return new Types.ObjectId(v);
  }
  async manage(
    u: AuthUser,
    branchId: string,
    action: 'status' | 'rotate' | 'disable',
  ) {
    await this.ministry.registrationAccess(u, branchId);
    const filter = { branchId: this.id(branchId) };
    if (action === 'status') {
      const link = await this.links
        .findOne(filter)
        .select('+publicToken')
        .lean();
      return {
        enabled: !!link?.isActive,
        exists: !!link,
        token: link?.publicToken,
      };
    }
    if (action === 'disable') {
      await this.links.updateOne(filter, {
        $set: { isActive: false, changedBy: u.sub },
      });
      return { enabled: false };
    }
    const token = randomBytes(32).toString('base64url');
    await this.links.updateOne(
      filter,
      {
        $set: {
          tokenHash: tokenHash(token),
          publicToken: token,
          isActive: true,
          changedBy: u.sub,
        },
      },
      { upsert: true },
    );
    return { token, enabled: true };
  }
  private async link(token: string, consume = false) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token || ''))
      throw new NotFoundException(
        'Registration link unavailable. Please contact the church.',
      );
    const link = await this.links
      .findOne({
        tokenHash: tokenHash(token),
        isActive: true,
      })
      .lean();
    if (
      !link ||
      !(await this.branches.exists({ _id: link.branchId, status: 'active' }))
    )
      throw new NotFoundException(
        'Registration link unavailable. Please contact the church.',
      );
    if (consume) {
      const slot = new Date(Math.floor(Date.now() / 60000) * 60000);
      await this.links.updateOne(
        { _id: link._id, windowAt: { $ne: slot } },
        { $set: { windowAt: slot, attempts: 0 } },
      );
      const r = await this.links.updateOne(
        { _id: link._id, windowAt: slot, attempts: { $lt: 30 } },
        { $inc: { attempts: 1 } },
      );
      if (!r.modifiedCount)
        throw new BadRequestException(
          'Please try again shortly or contact the church.',
        );
    }
    return link;
  }
  async publicInfo(token: string) {
    const link = await this.link(token);
    const branch = await this.branches
      .findById(link.branchId)
      .select('name')
      .lean();
    return { churchName: branch?.name || 'Children’s ministry', familyForm: await this.forms?.publicForm(MinistryFormKind.Family), childForm: await this.forms?.publicForm(MinistryFormKind.Child) };
  }
  async submit(token: string, d: ParentRegistrationDto) {
    const link = await this.link(token, true);
    if (d.website) return { received: true };
    validateParentSubmission(d);
    const old = await this.registrations
      .findOne({ requestKey: d.requestKey })
      .lean();
    if (old) {
      if (String(old.branchId) !== String(link.branchId))
        throw new ConflictException('Please reload this registration form.');
      return { received: true };
    }
    if (
      (await this.registrations.countDocuments({
        branchId: link.branchId,
        status: { $in: ['pending', 'processing'] },
      })) >= 500
    )
      throw new BadRequestException(
        'Please contact the welcome team to register.',
      );
    await this.registrations.create({
      branchId: link.branchId,
      requestKey: d.requestKey,
      familyName: d.familyName.trim(),
      customAnswers: await this.forms?.prepare(MinistryFormKind.Family, d, undefined, 'public'),
      adults: d.adults.map((a) => ({
        ...a,
        firstName: a.firstName.trim(),
        lastName: a.lastName.trim(),
      })),
      children: await Promise.all(d.children.map(async (child) => {
        const customAnswers = await this.forms?.prepare(MinistryFormKind.Child, child, undefined, 'public');
        const { customFields, formRevision, ...values } = child;
        return { ...values, firstName: child.firstName.trim(), lastName: child.lastName.trim(), customAnswers };
      })),
      consentAt: new Date(),
    });
    return { received: true };
  }
  async queue(u: AuthUser, q: ChildrenQueryDto) {
    const options = await this.ministry.options(u);
    const branchId = q.branchId || String(options.branches[0]?._id || '');
    if (!branchId || !options.canManage)
      throw new ForbiddenException(
        'A children’s supervisor must review registrations.',
      );
    await this.ministry.registrationAccess(u, branchId);
    const page = Math.max(1, Number(q.page) || 1),
      filter = {
        branchId: this.id(branchId),
        status: { $in: ['pending', 'processing'] },
      };
    const [items, total, link] = await Promise.all([
      this.registrations
        .find(filter)
        .select('_id familyName status createdAt revision')
        .sort({ createdAt: 1 })
        .skip((page - 1) * 20)
        .limit(20)
        .lean(),
      this.registrations.countDocuments(filter),
      this.links.findOne({ branchId: this.id(branchId) }).lean(),
    ]);
    return {
      ...options,
      branchId,
      linkEnabled: !!link?.isActive,
      items,
      pagination: {
        page,
        total,
        totalPages: Math.max(1, Math.ceil(total / 20)),
      },
    };
  }
  async detail(u: AuthUser, id: string) {
    const row = await this.registrations.findById(this.id(id)).lean();
    if (!row) throw new NotFoundException('Registration not found.');
    await this.ministry.registrationAccess(u, String(row.branchId));
    const candidates = await this.families
      .find({
        branchId: row.branchId,
        isActive: true,
        $or: row.adults.map((a) => ({
          'guardians.phone': {
            $regex:
              a.phone.replace(/\D/g, '').slice(-10).split('').join('\\D*') +
              '\\D*$',
          },
        })),
      })
      .select('_id name guardians requestKey')
      .limit(20)
      .lean();
    const phones = new Set(
      row.adults.map((a) => a.phone.replace(/\D/g, '').slice(-10)),
    );
    return {
      ...row,
      canResume:
        row.status === 'processing' &&
        !!row.processingAt &&
        row.processingAt.getTime() < Date.now() - 600000,
      possibleDuplicates: candidates
        .filter(
          (f) =>
            f.requestKey !== row.requestKey &&
            f.guardians.some((g) =>
              phones.has(g.phone.replace(/\D/g, '').slice(-10)),
            ),
        )
        .slice(0, 20)
        .map((f) => ({ _id: f._id, name: f.name })),
    };
  }
  async review(u: AuthUser, id: string, d: RegistrationReviewDto) {
    const row = await this.detail(u, id);
    if (d.note.trim().length < 10)
      throw new BadRequestException(
        'Record the review and verification details.',
      );
    if (
      row.status !== 'pending' &&
      !(
        row.status === 'processing' &&
        row.processingAt &&
        row.processingAt.getTime() < Date.now() - 600000
      )
    )
      throw new ConflictException(
        'This submission is already being handled or has been reviewed.',
      );
    if (
      row.approvalStarted &&
      (d.action !== 'approve' || d.registerAsMembers !== row.approvalAsMembers)
    )
      throw new ConflictException(
        'An approved registration is being recovered. Resume the original approval, then make any changes in the family record.',
      );
    if (d.action === 'approve' && (!d.guardianVerified || !d.duplicatesChecked))
      throw new BadRequestException(
        'Verify the guardian and check duplicates before approving.',
      );
    if (
      d.action === 'approve' &&
      row.possibleDuplicates.length &&
      !d.allowDuplicate
    )
      throw new BadRequestException(
        'A family with matching contact details already exists. Review it and use “Handled with existing family” to avoid duplicates.',
      );
    if (d.action === 'handled') {
      if (!d.existingFamilyId)
        throw new BadRequestException('Choose the existing family.');
      const family = await this.ministry.family(u, d.existingFamilyId);
      if (String(family.branchId) !== String(row.branchId))
        throw new BadRequestException('Choose a family in the same church.');
    }
    const claim = await this.registrations
      .findOneAndUpdate(
        { _id: row._id, status: row.status, revision: d.expectedRevision },
        {
          $set: {
            status: 'processing',
            processingAt: new Date(),
            ...(d.action === 'approve'
              ? {
                  approvalStarted: true,
                  approvalAsMembers: d.registerAsMembers,
                }
              : {}),
            reviewedBy: u.sub,
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean();
    if (!claim)
      throw new ConflictException(
        'Another supervisor updated this registration. Reload.',
      );
    try {
      let familyId = d.existingFamilyId;
      if (d.action === 'approve') {
        const guardians = row.adults.map((a, i) => ({
          ...a,
          id: registrationUuid(row.requestKey + ':adult:' + i),
          canCheckIn: i === 0,
        }));
        const family = await this.ministry.saveFamily(u, {
          branchId: String(row.branchId),
          name: row.familyName,
          registrationKey: row.requestKey,
          guardians,
        }, undefined, row.customAnswers ?? []);
        familyId = String(family._id);
        for (const [i, c] of row.children.entries()) {
          const pickupGuardianIds = c.pickupAdults.map((i) => guardians[i].id);
          await this.ministry.saveChild(u, {
            familyId,
            registrationKey: registrationUuid(row.requestKey + ':child:' + i),
            firstName: c.firstName,
            lastName: c.lastName,
            birthDate: c.birthDate,
            guardianIds: [...new Set([guardians[0].id, ...pickupGuardianIds])],
            pickupGuardianIds,
            careNotes: c.careNotes,
            pickupNotes: '',
            photoConsent: false,
            isMember: d.registerAsMembers,
          }, undefined, c.customAnswers ?? []);
        }
      }
      const result = await this.registrations
        .findOneAndUpdate(
          { _id: row._id, status: 'processing', revision: claim.revision },
          {
            $set: {
              status:
                d.action === 'approve'
                  ? 'approved'
                  : d.action === 'reject'
                    ? 'rejected'
                    : 'handled',
              reviewNote: d.note.trim(),
              reviewedAt: new Date(),
              ...(familyId ? { familyId: this.id(familyId) } : {}),
            },
            $inc: { revision: 1 },
          },
          { new: true },
        )
        .lean();
      if (!result)
        throw new ConflictException(
          'Another supervisor resumed this review. Reload.',
        );
      return result;
    } catch (e) {
      await this.registrations.updateOne(
        { _id: row._id, status: 'processing', revision: claim.revision },
        { $set: { status: 'pending' }, $inc: { revision: 1 } },
      );
      throw e;
    }
  }
}
