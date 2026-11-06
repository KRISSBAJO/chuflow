import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID, randomBytes } from 'node:crypto';
import { AccessScopeService } from '../access-scope/access-scope.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { Branch } from '../branches/schemas/branch.schema';
import { Member } from '../members/schemas/member.schema';
import { ChildrenRegistration } from './registration.schema';
import { User } from '../users/schemas/user.schema';
import {
  ChildFamily,
  ChildProfile,
  ChildSession,
  ChildKiosk,
  type ChildEvent,
  type ChildVisit,
} from './children.schema';
import {
  FamilyDto,
  ChildDto,
  SessionDto,
  CheckInDto,
  CheckoutDto,
  SessionActionDto,
  ChildrenQueryDto,
  ChildrenSummaryDto,
} from './children.dto';
import {
  ageMonths,
  cardToken,
  tokenHash,
  pickupToken,
  pickupDisplay,
  checkRoom,
  requireUnique,
  validatePickup,
} from './children.logic';
@Injectable()
export class ChildrenService {
  constructor(
    @InjectModel(ChildFamily.name)
    private readonly families: Model<ChildFamily>,
    @InjectModel(ChildProfile.name)
    private readonly children: Model<ChildProfile>,
    @InjectModel(ChildSession.name)
    private readonly sessions: Model<ChildSession>,
    @InjectModel(ChildKiosk.name) private readonly kiosks: Model<ChildKiosk>,
    @InjectModel(Branch.name) private readonly branches: Model<Branch>,
    @InjectModel(Member.name) private readonly members: Model<Member>,
    private readonly scope: AccessScopeService,
    @Optional()
    @InjectModel(ChildrenRegistration.name)
    private readonly registrations?: Model<ChildrenRegistration>,
    @Optional()
    @InjectModel(User.name)
    private readonly users?: Model<User>,
  ) {}
  private id(v: string) {
    if (!Types.ObjectId.isValid(v))
      throw new BadRequestException('Invalid children’s ministry record.');
    return new Types.ObjectId(v);
  }
  private manager(u: AuthUser) {
    return [
      'super_admin',
      'national_admin',
      'district_admin',
      'branch_admin',
      'resident_pastor',
      'children_supervisor',
    ].includes(u.role);
  }
  private event(
    actorId: string,
    action: string,
    note: string,
    childIds?: string[],
    guardianId?: string,
  ): ChildEvent {
    return { actorId, action, note, childIds, guardianId, at: new Date() };
  }
  private async access(u: AuthUser, branchId: string, manage = false) {
    if (
      (!this.manager(u) && u.role !== 'children_worker') ||
      (manage && !this.manager(u))
    )
      throw new ForbiddenException('Children’s ministry access is required.');
    const branch = await this.branches
      .findOne({
        $and: [
          { _id: this.id(branchId), status: 'active' },
          await this.scope.getBranchDocumentQuery(u),
        ],
      })
      .select('_id name')
      .lean();
    if (!branch)
      throw new ForbiddenException(
        'This church is outside your children’s ministry access.',
      );
    return branch;
  }
  registrationAccess(u: AuthUser, branchId: string) {
    return this.access(u, branchId, true);
  }
  async memberFamilies(u: AuthUser, memberId: string) {
    const member = await this.members
      .findById(this.id(memberId))
      .select('branchId')
      .lean();
    if (!member) throw new NotFoundException('Member not found');
    await this.access(u, String(member.branchId), true);
    const families = await this.families
      .find({
        branchId: member.branchId,
        isActive: true,
        'guardians.memberId': memberId,
      })
      .select('_id name')
      .lean();
    const children = await this.children
      .find({ familyId: { $in: families.map((f) => f._id) }, isActive: true })
      .select('_id firstName lastName familyId')
      .lean();
    return { families, children };
  }
  async options(u: AuthUser) {
    if (!this.manager(u) && u.role !== 'children_worker')
      return { branches: [], canManage: false };
    const branches = await this.branches
      .find({
        $and: [
          await this.scope.getBranchDocumentQuery(u),
          { status: 'active' },
        ],
      })
      .select('_id name')
      .sort({ name: 1 })
      .lean();
    return {
      branches,
      canManage: this.manager(u),
      dedicated: ['children_worker', 'children_supervisor'].includes(u.role),
    };
  }
  async summary(u: AuthUser, q: ChildrenSummaryDto) {
    const own = await this.scope.getBranchDocumentQuery(u);
    const filters = {
      ...(q.branchId ? { _id: this.id(q.branchId) } : {}),
      ...(q.oversightRegion ? { oversightRegion: q.oversightRegion } : {}),
      ...(q.district ? { district: q.district } : {}),
    };
    const branches = await this.branches
      .find({ $and: [own, filters, { status: 'active' }] })
      .select('_id')
      .lean();
    const ids = branches.map((b) => b._id),
      days = Math.min(365, Math.max(1, Number(q.days) || 30)),
      start = new Date(Date.now() - days * 86400000);
    const [registered, live, attendance] = await Promise.all([
      this.children.countDocuments({ branchId: { $in: ids }, isActive: true }),
      this.sessions.aggregate<{ present: number }>([
        { $match: { branchId: { $in: ids }, status: 'open' } },
        {
          $project: {
            present: {
              $size: {
                $filter: {
                  input: '$visits',
                  as: 'visit',
                  cond: { $eq: ['$$visit.status', 'checked_in'] },
                },
              },
            },
          },
        },
        { $group: { _id: null, present: { $sum: '$present' } } },
      ]),
      this.sessions.aggregate<{ attended: number }>([
        {
          $match: {
            branchId: { $in: ids },
            startsAt: { $gte: start, $lte: new Date() },
          },
        },
        { $project: { attended: { $size: '$visits' } } },
        { $group: { _id: null, attended: { $sum: '$attended' } } },
      ]),
    ]);
    return {
      registered,
      present: live[0]?.present || 0,
      attended: attendance[0]?.attended || 0,
      days,
    };
  }
  /** Age bucket in completed months; invalid dates fall into the last bucket so one bad record never breaks the page. */
  private ageBucket(birthDate: string, at: Date) {
    try {
      const months = ageMonths(birthDate, at);
      if (months < 36) return 'under3';
      if (months < 72) return '3to5';
      if (months < 120) return '6to9';
      if (months < 156) return '10to12';
      return 'teens';
    } catch {
      return 'teens';
    }
  }
  private liveSnapshot(
    s: (ChildSession & { _id: Types.ObjectId }) | null,
    now: Date,
    kiosks: number,
  ) {
    if (!s) return null;
    const present = s.visits.filter((v) => v.status === 'checked_in');
    return {
      _id: s._id,
      name: s.name,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: s.status,
      phase:
        s.startsAt > now
          ? 'upcoming'
          : s.endsAt < now && present.length > 0
            ? 'overdue'
            : s.endsAt < now
              ? 'ending'
              : 'live',
      present: present.length,
      attended: s.visits.length,
      collected: s.visits.length - present.length,
      kiosks,
      rooms: s.rooms.map((r) => ({
        ...r,
        present: present.filter((v) => v.roomId === r.id).length,
      })),
      recent: s.events
        .slice(-8)
        .reverse()
        .map((e) => ({
          action: e.action,
          at: e.at,
          count: e.childIds?.length || 0,
          kiosk: String(e.actorId).startsWith('kiosk:'),
        })),
    };
  }
  async latestRooms(u: AuthUser, branchId: string) {
    await this.access(u, branchId, true);
    const last = await this.sessions
      .findOne({ branchId: this.id(branchId) })
      .sort({ startsAt: -1 })
      .select('name rooms startsAt endsAt')
      .lean();
    if (!last) return null;
    return {
      name: last.name,
      startsAt: last.startsAt,
      endsAt: last.endsAt,
      rooms: last.rooms.map(({ name, minMonths, maxMonths, capacity }) => ({
        name,
        minMonths,
        maxMonths,
        capacity,
      })),
    };
  }
  async overview(u: AuthUser, q: ChildrenQueryDto) {
    const opts = await this.options(u);
    const branchId = q.branchId || String(opts.branches[0]?._id || '');
    if (!branchId)
      return {
        ...opts,
        branchId: null,
        families: [],
        sessions: [],
        live: null,
        trend: [],
        stats: null,
        pagination: { page: 1, total: 0, totalPages: 1 },
        sessionPagination: { page: 1, total: 0, totalPages: 1 },
      };
    await this.access(u, branchId);
    const bid = this.id(branchId),
      now = new Date(),
      manage = this.manager(u);
    const filter: Record<string, unknown> = { branchId: bid, isActive: true };
    if (q.search?.trim())
      filter.name = {
        $regex: q.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
    const page = Math.max(1, Number(q.page) || 1),
      limit = 20;
    const sessionPage = Math.max(1, Number(q.sessionPage) || 1);
    const sessionFilter = { branchId: bid, ...(manage ? {} : { status: 'open' }) };
    const [
      families,
      total,
      sessions,
      sessionTotal,
      open,
      recentSessions,
      roster,
      familyTotal,
      newChildren,
      pendingRegistrations,
    ] = await Promise.all([
      manage
        ? this.families
            .find(filter)
            .select('_id name guardians revision updatedAt')
            .sort({ name: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
        : [],
      manage ? this.families.countDocuments(filter) : 0,
      this.sessions
        .find(sessionFilter)
        .sort({ startsAt: -1 })
        .skip((sessionPage - 1) * 20)
        .limit(20)
        .lean(),
      this.sessions.countDocuments(sessionFilter),
      this.sessions.findOne({ branchId: bid, status: 'open' }).lean(),
      this.sessions
        .find({ branchId: bid, startsAt: { $lte: now } })
        .sort({ startsAt: -1 })
        .limit(10)
        .select('_id name startsAt status visits rooms')
        .lean(),
      this.children
        .find({ branchId: bid, isActive: true })
        .select('_id firstName lastName birthDate isMember familyId')
        .lean(),
      this.families.countDocuments({ branchId: bid, isActive: true }),
      this.children.countDocuments({
        branchId: bid,
        isActive: true,
        createdAt: { $gte: new Date(now.getTime() - 30 * 86400000) },
      }),
      manage && this.registrations
        ? this.registrations.countDocuments({
            branchId: bid,
            status: { $in: ['pending', 'processing'] },
          })
        : 0,
    ]);
    const kiosks = open
      ? await this.kiosks.countDocuments({
          sessionId: open._id,
          revoked: false,
          expiresAt: { $gt: now },
        })
      : 0;
    const perFamily = new Map<string, number>();
    const ageMix: Record<string, number> = {
      under3: 0,
      '3to5': 0,
      '6to9': 0,
      '10to12': 0,
      teens: 0,
    };
    const birthdays: {
      _id: Types.ObjectId;
      name: string;
      familyId: Types.ObjectId;
      date: string;
      turning: number;
    }[] = [];
    const weekAhead = new Date(now.getTime() + 7 * 86400000);
    for (const c of roster) {
      const key = String(c.familyId);
      perFamily.set(key, (perFamily.get(key) || 0) + 1);
      ageMix[this.ageBucket(c.birthDate, now)]++;
      const born = new Date(c.birthDate + 'T00:00:00Z');
      if (Number.isFinite(born.getTime())) {
        const next = new Date(
          Date.UTC(now.getUTCFullYear(), born.getUTCMonth(), born.getUTCDate()),
        );
        if (next < new Date(now.toDateString()))
          next.setUTCFullYear(next.getUTCFullYear() + 1);
        if (next <= weekAhead)
          birthdays.push({
            _id: c._id,
            name: `${c.firstName} ${c.lastName}`,
            familyId: c.familyId,
            date: next.toISOString().slice(0, 10),
            turning: next.getUTCFullYear() - born.getUTCFullYear(),
          });
      }
    }
    birthdays.sort((a, b) => a.date.localeCompare(b.date));
    return {
      ...opts,
      branchId,
      families: families.map((f) => ({
        _id: f._id,
        name: f.name,
        childCount: perFamily.get(String(f._id)) || 0,
        guardianCount: f.guardians?.length || 0,
      })),
      sessions: sessions.map((s) => ({
        _id: s._id,
        name: s.name,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: s.status,
        rooms: s.rooms.length,
        present: s.visits.filter((v) => v.status === 'checked_in').length,
        attended: s.visits.length,
      })),
      live: this.liveSnapshot(open, now, kiosks),
      trend: recentSessions
        .slice()
        .reverse()
        .map((s) => ({
          _id: s._id,
          name: s.name,
          startsAt: s.startsAt,
          status: s.status,
          attended: s.visits.length,
          capacity: s.rooms.reduce((sum, r) => sum + r.capacity, 0),
        })),
      stats: {
        children: roster.length,
        families: familyTotal,
        visiting: roster.filter((c) => !c.isMember).length,
        newChildren,
        ageMix,
        birthdays: manage ? birthdays.slice(0, 12) : [],
        pendingRegistrations,
      },
      sessionPagination: {
        page: sessionPage,
        total: sessionTotal,
        totalPages: Math.max(1, Math.ceil(sessionTotal / 20)),
      },
      pagination: {
        page,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
  async memberSearch(u: AuthUser, branchId: string, search: string) {
    await this.access(u, branchId, true);
    if (search.trim().length < 2) return [];
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.members
      .find({
        branchId: this.id(branchId),
        recordType: { $ne: 'child' },
        $or: [
          { firstName: { $regex: escaped, $options: 'i' } },
          { lastName: { $regex: escaped, $options: 'i' } },
        ],
      })
      .select('_id firstName lastName phone email')
      .limit(20)
      .lean();
  }
  async family(u: AuthUser, id: string) {
    const f = await this.families.findById(this.id(id)).lean();
    if (!f) throw new NotFoundException('Family not found.');
    await this.access(u, String(f.branchId), true);
    const children = await this.children
      .find({ familyId: f._id })
      .sort({ firstName: 1 })
      .lean();
    return { ...f, children };
  }
  async saveFamily(u: AuthUser, d: FamilyDto, id?: string) {
    await this.access(u, d.branchId, true);
    const guardians = d.guardians.map((g) => ({
      ...g,
      id: g.id || randomUUID(),
      firstName: g.firstName.trim(),
      lastName: g.lastName.trim(),
    }));
    if (
      !d.name.trim() ||
      guardians.some((g) => !g.firstName || !g.lastName || !g.phone.trim())
    )
      throw new BadRequestException('Enter family and guardian details.');
    requireUnique(
      guardians.map((g) => g.id),
      'guardian',
    );
    for (const g of guardians)
      if (
        g.memberId &&
        !(await this.members.exists({
          _id: this.id(g.memberId),
          branchId: this.id(d.branchId),
          recordType: { $ne: 'child' },
        }))
      )
        throw new BadRequestException(
          'Linked guardian must be an adult member of this church.',
        );
    if (!id) {
      if (!d.registrationKey)
        throw new BadRequestException('Reload the form before registering.');
      const old = await this.families
        .findOne({ requestKey: d.registrationKey })
        .lean();
      if (old) {
        if (String(old.branchId) !== d.branchId)
          throw new ConflictException(
            'Registration belongs to another church.',
          );
        return old;
      }
      return this.families.create({
        requestKey: d.registrationKey,
        branchId: this.id(d.branchId),
        name: d.name.trim(),
        guardians,
        events: [this.event(u.sub, 'family_registered', 'Family registered.')],
      });
    }
    const f = await this.family(u, id);
    if (String(f.branchId) !== d.branchId)
      throw new BadRequestException(
        'A family cannot be moved to another church here.',
      );
    const linked = f.children.flatMap((c) => [
      ...c.guardianIds,
      ...c.pickupGuardianIds,
    ]);
    if (linked.some((g) => !guardians.some((a) => a.id === g)))
      throw new BadRequestException(
        'Update each child’s guardian links before removing an adult.',
      );
    const r = await this.families
      .findOneAndUpdate(
        { _id: f._id, revision: d.expectedRevision },
        {
          $set: { name: d.name.trim(), guardians },
          $inc: { revision: 1 },
          $push: {
            events: this.event(
              u.sub,
              'family_updated',
              'Guardian details and permissions updated.',
            ),
          },
        },
        { new: true },
      )
      .lean();
    if (!r)
      throw new ConflictException('Family changed. Reload before saving.');
    return r;
  }
  private async memberProjection(c: ChildProfile & { _id: Types.ObjectId }) {
    if (c.isMember)
      await this.members.updateOne(
        { _id: c._id },
        {
          $set: {
            branchId: c.branchId,
            firstName: c.firstName,
            lastName: c.lastName,
            membershipStatus: c.isActive ? 'active' : 'inactive',
            recordType: 'child',
          },
        },
        { upsert: true },
      );
    else
      await this.members.updateOne(
        { _id: c._id, recordType: 'child' },
        { $set: { membershipStatus: 'inactive' } },
      );
  }
  async saveChild(u: AuthUser, d: ChildDto, id?: string) {
    const f = await this.family(u, d.familyId);
    ageMonths(d.birthDate);
    if (ageMonths(d.birthDate) >= 216)
      throw new BadRequestException(
        'Use an adult record for people aged 18 or older.',
      );
    requireUnique(d.guardianIds, 'guardian');
    requireUnique(d.pickupGuardianIds, 'pickup adult');
    if (
      d.guardianIds.some((g) => !f.guardians.some((a) => a.id === g)) ||
      d.pickupGuardianIds.some((g) => !d.guardianIds.includes(g))
    )
      throw new BadRequestException(
        'Pickup adults must be linked guardians in this family.',
      );
    if (
      !d.guardianIds.some((id) =>
        f.guardians.some((g) => g.id === id && g.canCheckIn),
      )
    )
      throw new BadRequestException(
        'At least one linked guardian must be allowed to check in this child.',
      );
    if (d.photoUrl && !d.photoConsent)
      throw new BadRequestException(
        'Record photo permission before adding a photograph.',
      );
    const values = {
      branchId: f.branchId,
      familyId: f._id,
      firstName: d.firstName.trim(),
      lastName: d.lastName.trim(),
      birthDate: d.birthDate,
      guardianIds: d.guardianIds,
      pickupGuardianIds: d.pickupGuardianIds,
      careNotes: d.careNotes.trim(),
      pickupNotes: d.pickupNotes.trim(),
      photoConsent: d.photoConsent,
      photoUrl: d.photoUrl,
      isMember: d.isMember,
      isActive: d.isActive ?? true,
    };
    if (!values.firstName || !values.lastName)
      throw new BadRequestException('Enter the child’s name.');
    let result: (ChildProfile & { _id: Types.ObjectId }) | null;
    if (id) {
      const old = await this.children.findById(this.id(id)).lean();
      if (!old || String(old.familyId) !== d.familyId)
        throw new BadRequestException('Child does not belong to this family.');
      if (
        d.isActive === false &&
        (await this.sessions.exists({
          status: 'open',
          visits: { $elemMatch: { childId: id, status: 'checked_in' } },
        }))
      )
        throw new BadRequestException(
          'Check the child out before deactivating their record.',
        );
      result = await this.children
        .findOneAndUpdate(
          { _id: old._id, revision: d.expectedRevision },
          {
            $set: values,
            ...(!d.photoUrl ? { $unset: { photoUrl: 1 } } : {}),
            $inc: { revision: 1 },
            $push: {
              events: this.event(
                u.sub,
                'child_updated',
                'Child details or guardian permissions updated.',
              ),
            },
          },
          { new: true },
        )
        .lean();
    } else {
      if (!d.registrationKey)
        throw new BadRequestException('Reload the registration form.');
      const old = await this.children
        .findOne({ requestKey: d.registrationKey })
        .lean();
      if (old) {
        if (String(old.familyId) !== d.familyId)
          throw new ConflictException(
            'Registration belongs to another family.',
          );
        result = old;
      } else {
        const created = await this.children.create({
          ...values,
          requestKey: d.registrationKey,
          events: [this.event(u.sub, 'child_registered', 'Child registered.')],
        });
        result = created.toObject();
      }
    }
    if (!result)
      throw new ConflictException(
        'Child record changed. Reload before saving.',
      );
    await this.memberProjection(result);
    return result;
  }
  async rotateCard(u: AuthUser, kind: 'family' | 'child', id: string) {
    const row =
      kind === 'family'
        ? await this.families.findById(this.id(id)).lean()
        : await this.children.findById(this.id(id)).lean();
    if (!row) throw new NotFoundException('Record not found.');
    await this.access(u, String(row.branchId), true);
    const code = cardToken();
    const update = {
      $set: { cardHash: tokenHash(code) },
      $inc: { revision: 1 },
      $push: {
        events: this.event(
          u.sub,
          'card_replaced',
          'Previous identification card disabled.',
        ),
      },
    };
    if (kind === 'family')
      await this.families.updateOne({ _id: row._id }, update);
    else await this.children.updateOne({ _id: row._id }, update);
    return {
      code,
      name:
        kind === 'family'
          ? (row as ChildFamily).name
          : `${(row as ChildProfile).firstName} ${(row as ChildProfile).lastName}`,
    };
  }
  async createSession(u: AuthUser, d: SessionDto) {
    await this.access(u, d.branchId, true);
    if (!d.registrationKey)
      throw new BadRequestException('Reload the session form.');
    if (
      new Date(d.endsAt) <= new Date(d.startsAt) ||
      new Date(d.endsAt) <= new Date()
    )
      throw new BadRequestException(
        'The session must end after its start and in the future.',
      );
    if (d.rooms.some((r) => r.maxMonths < r.minMonths))
      throw new BadRequestException('Classroom age ranges are invalid.');
    requireUnique(
      d.rooms.map((r) => r.name.trim().toLowerCase()),
      'classroom name',
    );
    const old = await this.sessions
      .findOne({ requestKey: d.registrationKey })
      .lean();
    if (old) {
      if (String(old.branchId) !== d.branchId)
        throw new ConflictException('Session belongs to another church.');
      return old;
    }
    if (
      await this.sessions.exists({
        branchId: this.id(d.branchId),
        status: 'open',
      })
    )
      throw new ConflictException(
        'This church already has an open children’s session. Close it after every child has been collected before opening another.',
      );
    return this.sessions.create({
      requestKey: d.registrationKey,
      branchId: this.id(d.branchId),
      name: d.name.trim(),
      startsAt: new Date(d.startsAt),
      endsAt: new Date(d.endsAt),
      rooms: d.rooms.map((r) => ({ ...r, id: randomUUID() })),
      events: [this.event(u.sub, 'session_created', 'Session opened.')],
    });
  }
  private async session(id: string) {
    const s = await this.sessions.findById(this.id(id)).lean();
    if (!s) throw new NotFoundException('Session not found.');
    return s;
  }
  async roster(u: AuthUser, id: string) {
    const s = await this.session(id);
    await this.access(u, String(s.branchId));
    if (s.status === 'closed' && !this.manager(u))
      throw new ForbiddenException(
        'Closed rosters are available to supervisors.',
      );
    const children = await this.children
      .find({ _id: { $in: s.visits.map((v) => this.id(v.childId)) } })
      .lean();
    const families = await this.families
      .find({
        _id: {
          $in: [...new Set(s.visits.map((v) => v.familyId))].map((id) =>
            this.id(id),
          ),
        },
      })
      .select('_id guardians')
      .lean();
    const actorIds = [
      ...new Set(
        s.events
          .map((e) => String(e.actorId))
          .filter((id) => Types.ObjectId.isValid(id)),
      ),
    ];
    const staff =
      this.users && actorIds.length
        ? await this.users
            .find({ _id: { $in: actorIds.map((id) => new Types.ObjectId(id)) } })
            .select('_id firstName lastName')
            .lean()
        : [];
    const actorName = (id: string) => {
      const u = staff.find((row) => String(row._id) === id);
      return u ? `${u.firstName} ${u.lastName}`.trim() : undefined;
    };
    return {
      ...s,
      events: s.events.map((e) => ({
        ...e,
        actorName: actorName(String(e.actorId)),
      })),
      visits: s.visits.map((v) => {
        const child = children.find((c) => String(c._id) === v.childId);
        const family = families.find((f) => String(f._id) === v.familyId);
        const { pickupHash, ...safe } = v;
        void pickupHash;
        return {
          ...safe,
          careNotes: child?.careNotes || '',
          pickupNotes: child?.pickupNotes || '',
          photoUrl: child?.photoConsent ? child.photoUrl : undefined,
          authorizedPickup:
            family?.guardians
              .filter((g) => child?.pickupGuardianIds.includes(g.id))
              .map((g) => ({
                id: g.id,
                name: `${g.firstName} ${g.lastName}`,
                phone: g.phone,
                relationship: g.relationship,
              })) || [],
        };
      }),
      canManage: this.manager(u),
    };
  }
  async findFamily(u: AuthUser, sessionId: string, search: string) {
    const s = await this.session(sessionId);
    await this.access(u, String(s.branchId));
    if (s.status !== 'open')
      throw new BadRequestException('This session is closed.');
    if (search.trim().length < 2) return [];
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rows = await this.families
      .find({
        branchId: s.branchId,
        isActive: true,
        $or: [
          { name: { $regex: escaped, $options: 'i' } },
          { 'guardians.phone': { $regex: escaped, $options: 'i' } },
          { 'guardians.firstName': { $regex: escaped, $options: 'i' } },
          { 'guardians.lastName': { $regex: escaped, $options: 'i' } },
        ],
      })
      .select('_id name')
      .sort({ name: 1 })
      .limit(20)
      .lean();
    return rows;
  }
  private async familySelection(
    sessionId: string,
    familyId: string,
    onlyChildId?: string,
    kiosk = false,
  ) {
    const s = await this.session(sessionId);
    if (s.status !== 'open')
      throw new BadRequestException('This session is closed.');
    const f = await this.families
      .findOne({ _id: this.id(familyId), branchId: s.branchId, isActive: true })
      .lean();
    if (!f)
      throw new NotFoundException(
        'This family is not available at this church.',
      );
    const children = await this.children
      .find({
        familyId: f._id,
        isActive: true,
        ...(onlyChildId ? { _id: this.id(onlyChildId) } : {}),
      })
      .select('_id firstName lastName birthDate guardianIds')
      .lean();
    return {
      familyId: String(f._id),
      name: kiosk ? 'Your family' : f.name,
      guardians: f.guardians
        .filter((g) => g.canCheckIn)
        .map((g) => ({
          id: g.id,
          name: kiosk ? g.firstName : `${g.firstName} ${g.lastName}`,
        })),
      children: children.map((c) => ({
        id: String(c._id),
        name: kiosk
          ? `${c.firstName} ${c.lastName.slice(0, 1)}.`
          : `${c.firstName} ${c.lastName}`,
        guardianIds: c.guardianIds,
        checkedIn: s.visits.some((v) => v.childId === String(c._id)),
        rooms: s.rooms
          .filter((r) => {
            const age = ageMonths(c.birthDate, s.startsAt);
            return age >= r.minMonths && age <= r.maxMonths;
          })
          .map((r) => ({
            id: r.id,
            name: r.name,
            remaining:
              r.capacity -
              s.visits.filter(
                (v) => v.roomId === r.id && v.status === 'checked_in',
              ).length,
          })),
      })),
    };
  }
  async selectFamily(u: AuthUser, sessionId: string, familyId: string) {
    const s = await this.session(sessionId);
    await this.access(u, String(s.branchId));
    return this.familySelection(sessionId, familyId);
  }
  private async scanCard(sessionId: string, code: string, kiosk = false) {
    const s = await this.session(sessionId);
    if (!/^cfc_[A-Za-z0-9_-]{32}$/.test(code))
      throw new BadRequestException(
        'Scan a valid family or child identification card.',
      );
    const hash = tokenHash(code);
    const f = await this.families
      .findOne({ branchId: s.branchId, cardHash: hash, isActive: true })
      .select('_id')
      .lean();
    if (f)
      return {
        selection: await this.familySelection(
          sessionId,
          String(f._id),
          undefined,
          kiosk,
        ),
        childId: undefined,
      };
    const c = await this.children
      .findOne({ branchId: s.branchId, cardHash: hash, isActive: true })
      .select('_id familyId')
      .lean();
    if (!c)
      throw new NotFoundException(
        'Card unavailable. Please ask the welcome team.',
      );
    return {
      selection: await this.familySelection(
        sessionId,
        String(c.familyId),
        String(c._id),
        kiosk,
      ),
      childId: String(c._id),
    };
  }
  async scan(u: AuthUser, sessionId: string, code: string) {
    const s = await this.session(sessionId);
    await this.access(u, String(s.branchId));
    return (await this.scanCard(sessionId, code)).selection;
  }
  private async checkin(
    sessionId: string,
    d: CheckInDto,
    actorId: string,
    onlyChildId?: string,
  ) {
    const s = await this.session(sessionId);
    const now = new Date();
    if (s.status !== 'open' || now < s.startsAt || now > s.endsAt)
      throw new BadRequestException('This session is not open for check-in.');
    if (!d.adultConfirmed)
      throw new BadRequestException(
        'Confirm that the selected adult is bringing these children.',
      );
    requireUnique(
      d.children.map((c) => c.childId),
      'child',
    );
    if (onlyChildId && d.children.some((c) => c.childId !== onlyChildId))
      throw new ForbiddenException('This card identifies one child only.');
    const f = await this.families
      .findOne({
        _id: this.id(d.familyId),
        branchId: s.branchId,
        isActive: true,
      })
      .lean();
    if (!f) throw new BadRequestException('Family is unavailable.');
    const guardian = f.guardians.find(
      (g) => g.id === d.guardianId && g.canCheckIn,
    );
    if (!guardian)
      throw new BadRequestException(
        'Select an adult who can check in this family.',
      );
    const children = await this.children
      .find({
        _id: { $in: d.children.map((c) => this.id(c.childId)) },
        familyId: f._id,
        isActive: true,
      })
      .lean();
    if (children.length !== d.children.length)
      throw new BadRequestException('One or more children are unavailable.');
    if (s.visits.length + d.children.length > 1000)
      throw new BadRequestException(
        'This session has reached its registration limit. Contact a supervisor.',
      );
    const token = pickupToken(),
      display = pickupDisplay();
    const additions: ChildVisit[] = [];
    for (const placement of d.children) {
      const c = children.find((c) => String(c._id) === placement.childId)!;
      if (!c.guardianIds.includes(guardian.id))
        throw new BadRequestException(
          'This guardian is not linked to this child.',
        );
      if (s.visits.some((v) => v.childId === placement.childId))
        throw new ConflictException(
          `${c.firstName} already has an attendance record for this session. Check the roster.`,
        );
      const room = s.rooms.find((r) => r.id === placement.roomId);
      if (!room)
        throw new BadRequestException('Choose a classroom in this session.');
      checkRoom(
        room,
        c.birthDate,
        s.visits,
        additions.filter((v) => v.roomId === room.id).length + 1,
        s.startsAt,
      );
      additions.push({
        id: randomUUID(),
        childId: placement.childId,
        familyId: String(f._id),
        childName: `${c.firstName} ${c.lastName}`,
        roomId: room.id,
        broughtById: guardian.id,
        broughtByName: `${guardian.firstName} ${guardian.lastName}`,
        checkedInAt: now,
        status: 'checked_in',
        pickupHash: tokenHash(token),
        pickupDisplay: display,
      });
    }
    const saved = await this.sessions.updateOne(
      { _id: s._id, revision: s.revision, status: 'open' },
      {
        $push: {
          visits: { $each: additions },
          events: this.event(
            actorId,
            'check_in',
            'Children checked in.',
            additions.map((v) => v.childId),
            guardian.id,
          ),
        },
        $inc: { revision: 1 },
      },
    );
    if (!saved.modifiedCount)
      throw new ConflictException(
        'The roster changed. Check the current roster before retrying.',
      );
    return {
      sessionName: s.name,
      code: token,
      display,
      children: additions.map((v) => ({
        name: v.childName,
        room: s.rooms.find((r) => r.id === v.roomId)!.name,
        careAlert: !!children.find((c) => String(c._id) === v.childId)
          ?.careNotes,
      })),
    };
  }
  async checkIn(u: AuthUser, sessionId: string, d: CheckInDto) {
    const s = await this.session(sessionId);
    await this.access(u, String(s.branchId));
    return this.checkin(sessionId, d, u.sub);
  }
  async pickup(u: AuthUser, sessionId: string, code: string) {
    const s = await this.session(sessionId);
    await this.access(u, String(s.branchId));
    if (!/^cfp_[A-Za-z0-9_-]{32}$/.test(code))
      throw new BadRequestException(
        'Scan the guardian’s pickup receipt, not the permanent membership card.',
      );
    const rows = s.visits.filter(
      (v) => v.pickupHash === tokenHash(code) && v.status === 'checked_in',
    );
    if (!rows.length)
      throw new NotFoundException(
        'No checked-in children match this pickup receipt.',
      );
    return { visitIds: rows.map((v) => v.id) };
  }
  async checkout(u: AuthUser, sessionId: string, d: CheckoutDto) {
    const s = await this.session(sessionId);
    await this.access(u, String(s.branchId));
    if (s.status !== 'open')
      throw new BadRequestException('Session is closed.');
    if (s.revision !== d.expectedRevision)
      throw new ConflictException('Refresh the roster before checkout.');
    requireUnique(d.visitIds, 'child');
    const selected = s.visits.filter((v) => d.visitIds.includes(v.id));
    if (
      selected.length !== d.visitIds.length ||
      selected.some((v) => v.status !== 'checked_in')
    )
      throw new ConflictException(
        'One of these children is no longer checked in.',
      );
    if (d.exceptionReason && d.exceptionReason.trim().length < 10)
      throw new BadRequestException(
        'Record how the adult’s identity was verified.',
      );
    if (d.exceptionReason && !this.manager(u))
      throw new ForbiddenException(
        'Only a supervisor can handle a lost-receipt exception.',
      );
    if (!d.pickupCode && !d.exceptionReason)
      throw new BadRequestException(
        'Scan the pickup receipt or request a supervisor.',
      );
    for (const v of selected) {
      if (!d.exceptionReason && v.pickupHash !== tokenHash(d.pickupCode || ''))
        throw new ForbiddenException(
          'Pickup receipt does not match every selected child.',
        );
      const c = await this.children.findById(this.id(v.childId)).lean();
      if (!c) throw new BadRequestException('Child record unavailable.');
      validatePickup(c, d.guardianId, d.identityConfirmed);
    }
    const families = await this.families
      .find({
        _id: {
          $in: [...new Set(selected.map((v) => v.familyId))].map((id) =>
            this.id(id),
          ),
        },
        isActive: true,
      })
      .lean();
    const adult = families
      .flatMap((f) => f.guardians)
      .find((g) => g.id === d.guardianId);
    if (!adult)
      throw new BadRequestException('Collecting adult is unavailable.');
    const visits = s.visits.map((v) =>
      d.visitIds.includes(v.id)
        ? {
            ...v,
            status: 'checked_out' as const,
            checkedOutAt: new Date(),
            collectedById: adult.id,
            collectedByName: `${adult.firstName} ${adult.lastName}`,
            pickupHash: '',
          }
        : v,
    );
    const result = await this.sessions.updateOne(
      { _id: s._id, revision: d.expectedRevision, status: 'open' },
      {
        $set: { visits },
        $inc: { revision: 1 },
        $push: {
          events: this.event(
            u.sub,
            d.exceptionReason ? 'checkout_exception' : 'check_out',
            d.exceptionReason || 'Pickup receipt and adult identity confirmed.',
            selected.map((v) => v.childId),
            adult.id,
          ),
        },
      },
    );
    if (!result.modifiedCount)
      throw new ConflictException(
        'Another worker changed the roster. Verify the child’s status before continuing.',
      );
    return { checkedOut: selected.length };
  }
  async sessionAction(u: AuthUser, id: string, d: SessionActionDto) {
    const s = await this.session(id);
    await this.access(u, String(s.branchId), true);
    if (s.revision !== d.expectedRevision)
      throw new ConflictException('Roster changed. Reload.');
    if (d.action === 'close') {
      if (s.visits.some((v) => v.status === 'checked_in'))
        throw new BadRequestException(
          'Every child must be checked out before closing.',
        );
      const r = await this.sessions.updateOne(
        { _id: s._id, revision: d.expectedRevision, status: 'open' },
        {
          $set: { status: 'closed' },
          $inc: { revision: 1 },
          $push: { events: this.event(u.sub, 'session_closed', d.reason) },
        },
      );
      if (!r.modifiedCount) throw new ConflictException('Session changed.');
      await this.kiosks.updateMany(
        { sessionId: s._id },
        { $set: { revoked: true } },
      );
      return { closed: true };
    }
    const visit = s.visits.find(
      (v) => v.id === d.visitId && v.status === 'checked_in',
    );
    if (!visit || s.status !== 'open')
      throw new BadRequestException(
        'Select a checked-in child in an open session.',
      );
    let code: string | undefined;
    const visits = s.visits.map((v) => ({ ...v }));
    const target = visits.find((v) => v.id === visit.id)!;
    if (d.action === 'transfer') {
      const room = s.rooms.find((r) => r.id === d.roomId);
      const c = await this.children.findById(this.id(visit.childId)).lean();
      if (!room || !c)
        throw new BadRequestException('Classroom or child unavailable.');
      if (room.id === visit.roomId)
        throw new BadRequestException('The child is already in this room.');
      checkRoom(room, c.birthDate, s.visits, 1, s.startsAt);
      target.roomId = room.id;
    } else {
      code = pickupToken();
      target.pickupHash = tokenHash(code);
      target.pickupDisplay = pickupDisplay();
    }
    const r = await this.sessions.updateOne(
      { _id: s._id, revision: d.expectedRevision, status: 'open' },
      {
        $set: { visits },
        $inc: { revision: 1 },
        $push: {
          events: this.event(u.sub, d.action, d.reason, [visit.childId]),
        },
      },
    );
    if (!r.modifiedCount)
      throw new ConflictException('Roster changed. Reload.');
    return code
      ? {
          code,
          display: target.pickupDisplay,
          sessionName: s.name,
          children: [
            {
              name: target.childName,
              room: s.rooms.find((r) => r.id === target.roomId)!.name,
            },
          ],
        }
      : { transferred: true };
  }
  async createKiosk(u: AuthUser, sessionId: string, label: string) {
    const s = await this.session(sessionId);
    await this.access(u, String(s.branchId), true);
    if (s.status !== 'open' || s.endsAt <= new Date())
      throw new BadRequestException('Choose an open session.');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Math.min(s.endsAt.getTime(), Date.now() + 8 * 3600000),
    );
    const kiosk = await this.kiosks.create({
      tokenHash: tokenHash(token),
      sessionId: s._id,
      branchId: s.branchId,
      createdBy: u.sub,
      label,
      expiresAt,
    });
    return { id: kiosk._id, token, expiresAt };
  }
  async revokeKiosks(u: AuthUser, sessionId: string) {
    const s = await this.session(sessionId);
    await this.access(u, String(s.branchId), true);
    await this.kiosks.updateMany(
      { sessionId: s._id },
      { $set: { revoked: true } },
    );
    return { revoked: true };
  }
  private async kiosk(token: string, consume = false) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token || ''))
      throw new ForbiddenException(
        'Kiosk unavailable. Ask a supervisor to reopen it.',
      );
    const k = await this.kiosks
      .findOne({
        tokenHash: tokenHash(token),
        revoked: false,
        expiresAt: { $gt: new Date() },
      })
      .lean();
    if (!k) throw new ForbiddenException('Kiosk session expired or revoked.');
    if (consume) {
      const slot = new Date(Math.floor(Date.now() / 60000) * 60000);
      await this.kiosks.updateOne(
        { _id: k._id, windowAt: { $ne: slot } },
        { $set: { windowAt: slot, attempts: 0 } },
      );
      const updated = await this.kiosks.updateOne(
        { _id: k._id, windowAt: slot, attempts: { $lt: 30 } },
        { $inc: { attempts: 1 } },
      );
      if (!updated.modifiedCount)
        throw new BadRequestException(
          'Please pause and ask the welcome team for help.',
        );
    }
    const s = await this.session(String(k.sessionId));
    if (s.status !== 'open')
      throw new ForbiddenException('This kiosk is closed.');
    return { k, s };
  }
  async kioskInfo(token: string) {
    const { k, s } = await this.kiosk(token);
    const branch = await this.branches
      .findById(k.branchId)
      .select('name')
      .lean();
    return {
      churchName: branch?.name || 'Children’s ministry',
      sessionName: s.name,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
    };
  }
  async kioskScan(token: string, code: string) {
    const { s } = await this.kiosk(token, true);
    return (await this.scanCard(String(s._id), code, true)).selection;
  }
  async kioskCheckIn(token: string, d: CheckInDto & { code: string }) {
    const { k, s } = await this.kiosk(token, true);
    const card = await this.scanCard(String(s._id), d.code, true);
    if (card.selection.familyId !== d.familyId)
      throw new ForbiddenException('Scan the family card again.');
    return this.checkin(
      String(s._id),
      d,
      'kiosk:' + String(k._id),
      card.childId,
    );
  }
}
