import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  isDistrictRole,
  isGlobalRole,
  isNationalRole,
} from '../common/constants/roles.constants';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { AttendanceService } from '../attendance/attendance.service';
import { GuestsService } from '../guests/guests.service';
import { MembersService } from '../members/members.service';
import { ServiceTypesService } from '../service-types/service-types.service';
import { ServiceUnitsService } from '../service-units/service-units.service';
import {
  CreateBranchOverrideDto,
  CreateDistrictOverrideDto,
  CreateIntakeTemplateDto,
  UpdateIntakeTemplateDto,
} from './dto/manage-intake-template.dto';
import { PublicTemplateSubmitDto } from './dto/public-submit.dto';
import { intakeTemplateDefaults } from './intake-template.defaults';
import { IntakeSubmission, IntakeSubmissionDocument } from './schemas/intake-submission.schema';
import { IntakeTemplate, IntakeTemplateDocument } from './schemas/intake-template.schema';

@Injectable()
export class IntakeTemplatesService implements OnModuleInit {
  constructor(
    @InjectModel(IntakeTemplate.name) private readonly templateModel: Model<IntakeTemplateDocument>,
    @InjectModel(IntakeSubmission.name) private readonly submissionModel: Model<IntakeSubmissionDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    private readonly guestsService: GuestsService,
    private readonly membersService: MembersService,
    private readonly attendanceService: AttendanceService,
    private readonly serviceTypesService: ServiceTypesService,
    private readonly serviceUnitsService: ServiceUnitsService,
    private readonly accessScopeService: AccessScopeService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async onModuleInit() {
    for (const template of intakeTemplateDefaults) {
      const exists = await this.templateModel.findOne({ slug: template.slug }).lean();

      if (exists) {
        if (exists.isSeeded) {
          const shouldRefreshSeedContent =
            ['member-growth-record', 'service-attendance-summary', 'weekly-spiritual-indices'].includes(template.slug) ||
            (
              template.slug === 'winners-first-timer' &&
              !exists.fields?.some((field) => field.key === 'firstName') &&
              !exists.fields?.some((field) => field.key === 'lastName')
            );

          await this.templateModel.updateOne(
            { _id: exists._id },
            {
              $set: {
                ...(shouldRefreshSeedContent ? template : {}),
                isBranchOverride: false,
                isDistrictOverride: false,
                isSeeded: true,
                isActive: exists.isActive,
              },
              $unset: {
                branchId: 1,
                oversightRegion: 1,
                district: 1,
                baseTemplateId: 1,
              },
            },
          );
        }

        continue;
      }

      await this.templateModel.create({
        ...template,
        branchId: undefined,
        baseTemplateId: undefined,
        isBranchOverride: false,
        isDistrictOverride: false,
        isSeeded: true,
      });
    }

    const fallbackSlugsByKind = {
      guest: 'winners-first-timer',
      member: 'member-growth-record',
      attendance: 'service-attendance-summary',
      weekly_report: 'weekly-spiritual-indices',
    } as const;

    for (const kind of Object.keys(fallbackSlugsByKind) as Array<keyof typeof fallbackSlugsByKind>) {
      const activeTemplate = await this.templateModel
        .findOne({ kind, isActive: true, branchId: { $exists: false } })
        .lean();

      if (activeTemplate) {
        continue;
      }

      const fallbackTemplate =
        (await this.templateModel
          .findOne({ kind, slug: fallbackSlugsByKind[kind], branchId: { $exists: false } })
          .lean()) ??
        (await this.templateModel
          .findOne({ kind, branchId: { $exists: false } })
          .sort({ createdAt: 1 })
          .lean());

      if (!fallbackTemplate?._id) {
        continue;
      }

      await this.templateModel.updateOne({ _id: fallbackTemplate._id }, { isActive: true });
      await this.activateTemplate(String(fallbackTemplate._id), kind);
    }

    await this.submissionModel.updateMany(
      {
        templateKind: 'attendance',
        status: { $exists: false },
        attendanceId: { $exists: true },
      },
      { status: 'approved' },
    );

    await this.submissionModel.updateMany(
      {
        templateKind: 'attendance',
        status: { $exists: false },
        attendanceId: { $exists: false },
      },
      { status: 'pending' },
    );

    await this.submissionModel.updateMany(
      {
        templateKind: 'weekly_report',
        status: { $exists: false },
      },
      { status: 'pending' },
    );
  }

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private canEditGlobalTemplates(currentUser: AuthUser) {
    return currentUser.role === 'super_admin';
  }

  private canEditDistrictTemplate(
    currentUser: AuthUser,
    oversightRegion?: string,
    district?: string,
  ) {
    if (isGlobalRole(currentUser.role)) {
      return true;
    }

    if (!oversightRegion || !district) {
      return false;
    }

    if (isNationalRole(currentUser.role)) {
      return currentUser.oversightRegion === oversightRegion;
    }

    if (isDistrictRole(currentUser.role)) {
      return currentUser.oversightRegion === oversightRegion && currentUser.district === district;
    }

    return false;
  }

  private async ensureUniqueSlug(slug: string, currentId?: string) {
    const existing = await this.templateModel.findOne({ slug }).lean();

    if (existing && String(existing._id) !== currentId) {
      throw new BadRequestException('A template with this slug already exists');
    }
  }

  private async activateTemplate(
    templateId: string,
    kind: string,
    scope?: { branchId?: string; oversightRegion?: string; district?: string },
  ) {
    const branchId = this.toString(scope?.branchId);
    const district = this.toString(scope?.district);
    const oversightRegion = this.toString(scope?.oversightRegion);
    const scopeQuery = branchId
      ? { branchId }
      : district && oversightRegion
        ? { branchId: { $exists: false }, oversightRegion, district }
        : { branchId: { $exists: false }, district: { $exists: false }, oversightRegion: { $exists: false } };

    await this.templateModel.updateMany(
      {
        kind,
        _id: { $ne: templateId },
        ...scopeQuery,
      },
      { isActive: false },
    );
  }

  private buildShareUrl(slug: string, webUrl?: string) {
    const baseUrl = (webUrl || 'http://localhost:3001').replace(/\/$/, '');
    return `${baseUrl}/intake/${slug}`;
  }

  private async applyPublicBranchContext<
    T extends IntakeTemplateDocument | (IntakeTemplate & { _id?: unknown; branchId?: unknown }),
  >(template: T, requestedBranchId?: string): Promise<T> {
    const branchId = this.toString(requestedBranchId);

    if (!branchId || template.branchId) {
      return template;
    }

    if (!Types.ObjectId.isValid(branchId)) {
      throw new NotFoundException('Branch not found');
    }

    const branch = await this.branchModel.findById(branchId).select('_id').lean();

    if (!branch?._id) {
      throw new NotFoundException('Branch not found');
    }

    return {
      ...template,
      branchId: branch._id,
    };
  }

  private async hydrateDynamicFields<
    T extends IntakeTemplateDocument | (IntakeTemplate & { branchId?: unknown }),
  >(template: T): Promise<T> {
    const branchId = this.toString(template.branchId);

    if (
      !branchId ||
      (template.kind !== 'member' && template.kind !== 'attendance' && template.kind !== 'weekly_report')
    ) {
      return template;
    }

    const serviceUnitOptions =
      template.kind === 'member'
        ? await this.serviceUnitsService.findNamesByBranch(branchId)
        : [];
    const serviceTypeOptions =
      template.kind === 'attendance'
        ? await this.serviceTypesService.findNamesByBranch(branchId)
        : [];
    const weeklyReportDefaults: {
      previousAttendance?: number;
      averageLastPeriod?: number;
      averageLastYear?: number;
    } =
      template.kind === 'weekly_report'
        ? await this.attendanceService.branchSummaryDefaults(branchId)
        : {};

    return {
      ...template,
      fields: (template.fields ?? []).map((field) =>
        field.key === 'serviceUnitInterest'
          ? {
              ...field,
              type: 'select',
              options: serviceUnitOptions,
              helpText:
                field.helpText ||
                'Choose the service unit this member serves in or intends to join for this branch.',
            }
          : field.key === 'serviceType'
            ? {
                ...field,
                type: 'select',
                options: serviceTypeOptions,
                helpText:
                  field.helpText ||
                  'Choose the service type configured for this branch.',
              }
          : field.key === 'previousAttendance' && weeklyReportDefaults.previousAttendance !== undefined
            ? {
                ...field,
                defaultValue: String(weeklyReportDefaults.previousAttendance),
              }
          : field.key === 'averageLastPeriod' && weeklyReportDefaults.averageLastPeriod !== undefined
            ? {
                ...field,
                defaultValue: String(weeklyReportDefaults.averageLastPeriod),
              }
          : field.key === 'averageLastYear' && weeklyReportDefaults.averageLastYear !== undefined
            ? {
                ...field,
                defaultValue: String(weeklyReportDefaults.averageLastYear),
              }
          : field,
      ),
    };
  }

  private toResponse<T extends { _id?: unknown; slug: string; branchId?: unknown }>(
    template: T,
    webUrl?: string,
  ) {
    return {
      ...template,
      _id: String(template._id ?? ''),
      branchId: template.branchId ? String(template.branchId) : undefined,
      oversightRegion:
        'oversightRegion' in template && template.oversightRegion
          ? String(template.oversightRegion)
          : undefined,
      district:
        'district' in template && template.district
          ? String(template.district)
          : undefined,
      baseTemplateId:
        'baseTemplateId' in template && template.baseTemplateId
          ? String(template.baseTemplateId)
          : undefined,
      shareUrl: this.buildShareUrl(template.slug, webUrl),
    };
  }

  private async buildBranchOverrideSlug(baseSlug: string, branchId: string, currentId?: string) {
    const branch = await this.branchModel.findById(branchId).select('name').lean();

    if (!branch?._id) {
      throw new NotFoundException('Branch not found');
    }

    const baseValue = this.slugify(`${baseSlug}-${branch.name}`);
    let nextSlug = baseValue;
    let counter = 2;

    // Keep branch override slugs unique without forcing manual slug edits.
    while (true) {
      const existing = await this.templateModel.findOne({ slug: nextSlug }).lean();

      if (!existing || String(existing._id) === currentId) {
        return nextSlug;
      }

      nextSlug = `${baseValue}-${counter}`;
      counter += 1;
    }
  }

  private async buildDistrictOverrideSlug(baseSlug: string, oversightRegion: string, district: string, currentId?: string) {
    const baseValue = this.slugify(`${baseSlug}-${oversightRegion}-${district}`);
    let nextSlug = baseValue;
    let counter = 2;

    while (true) {
      const existing = await this.templateModel.findOne({ slug: nextSlug }).lean();

      if (!existing || String(existing._id) === currentId) {
        return nextSlug;
      }

      nextSlug = `${baseValue}-${counter}`;
      counter += 1;
    }
  }

  private async findRootTemplate(
    template: IntakeTemplateDocument | (IntakeTemplate & { _id?: unknown; baseTemplateId?: unknown }),
  ) {
    if (!template.baseTemplateId) {
      return template;
    }

    const rootTemplate = await this.templateModel.findById(template.baseTemplateId).lean();

    if (!rootTemplate) {
      throw new NotFoundException('Base template not found');
    }

    return rootTemplate;
  }

  private ensureAttendanceSubmissionViewRole(currentUser: AuthUser) {
    const allowed = [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
      'follow_up',
      'usher',
    ];

    if (!allowed.includes(currentUser.role)) {
      throw new ForbiddenException('You cannot view attendance submissions from your role');
    }
  }

  private ensureAttendanceSubmissionApprover(currentUser: AuthUser) {
    const allowed = [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
      'follow_up',
    ];

    if (!allowed.includes(currentUser.role)) {
      throw new ForbiddenException('You cannot approve attendance submissions from your role');
    }
  }

  async findAll(currentUser: AuthUser, webUrl?: string) {
    const branchFilter = await this.accessScopeService.buildBranchFilter(currentUser);
    const districtTemplateFilter =
      isGlobalRole(currentUser.role)
        ? {}
        : currentUser.oversightRegion && currentUser.district
          ? {
              $or: [
                { district: { $exists: false }, oversightRegion: { $exists: false } },
                { oversightRegion: currentUser.oversightRegion, district: currentUser.district },
              ],
            }
          : currentUser.oversightRegion
            ? {
                $or: [
                  { district: { $exists: false }, oversightRegion: { $exists: false } },
                  { oversightRegion: currentUser.oversightRegion },
                ],
              }
            : { district: { $exists: false }, oversightRegion: { $exists: false } };
    const query = Object.keys(branchFilter).length
      ? {
          $or: [
            branchFilter,
            {
              branchId: { $exists: false },
              ...districtTemplateFilter,
            },
          ],
        }
      : {};

    const templates = await this.templateModel.find(query).sort({ kind: 1, updatedAt: -1 }).lean();
    const hydratedTemplates = await Promise.all(
      templates.map(async (template) => this.hydrateDynamicFields(template)),
    );

    return hydratedTemplates.map((template) => this.toResponse(template, webUrl));
  }

  async findOne(id: string, currentUser: AuthUser, webUrl?: string) {
    const template = await this.templateModel.findById(id).lean();

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.branchId) {
      await this.accessScopeService.ensureBranchAccess(
        currentUser,
        String(template.branchId),
      );
    } else if (template.district || template.oversightRegion) {
      if (!this.canEditDistrictTemplate(currentUser, template.oversightRegion, template.district)) {
        throw new ForbiddenException('You cannot access templates outside your district scope');
      }
    } else if (!this.canEditGlobalTemplates(currentUser)) {
      // Non-site users can view global templates but not edit them.
    }

    const hydratedTemplate = await this.hydrateDynamicFields(template);
    return this.toResponse(hydratedTemplate, webUrl);
  }

  async create(dto: CreateIntakeTemplateDto, currentUser: AuthUser, webUrl?: string) {
    const slug = this.slugify(dto.slug || dto.name);
    const branchId = await this.accessScopeService.resolveScopedBranchId(currentUser, dto.branchId);

     if (!branchId && !this.canEditGlobalTemplates(currentUser)) {
      throw new ForbiddenException('Only the site admin can create global base templates');
    }

    await this.ensureUniqueSlug(slug);

    const template = await this.templateModel.create({
      ...dto,
      slug,
      branchId,
      baseTemplateId: undefined,
      isBranchOverride: false,
      isDistrictOverride: !!dto.oversightRegion && !!dto.district && !branchId,
      isActive: dto.isActive ?? false,
      isSeeded: false,
    });

    if (template.isActive) {
      await this.activateTemplate(template.id, template.kind, {
        branchId,
        oversightRegion: dto.oversightRegion,
        district: dto.district,
      });
    }

    return this.findOne(template.id, currentUser, webUrl);
  }

  async update(id: string, dto: UpdateIntakeTemplateDto, currentUser: AuthUser, webUrl?: string) {
    const existing = await this.templateModel.findById(id);

    if (!existing) {
      throw new NotFoundException('Template not found');
    }

    if (existing.branchId) {
      await this.accessScopeService.ensureBranchAccess(
        currentUser,
        String(existing.branchId),
      );
    } else if (existing.district || existing.oversightRegion) {
      if (!this.canEditDistrictTemplate(currentUser, existing.oversightRegion, existing.district)) {
        throw new ForbiddenException('You cannot edit templates outside your district scope');
      }
    } else if (!this.canEditGlobalTemplates(currentUser)) {
      throw new ForbiddenException('Only the site admin can edit global base templates');
    }

    const slug = dto.slug ? this.slugify(dto.slug) : existing.slug;
    const branchId = await this.accessScopeService.resolveScopedBranchId(
      currentUser,
      dto.branchId ??
        (existing.branchId ? String(existing.branchId) : undefined),
    );
    await this.ensureUniqueSlug(slug, id);

    await this.templateModel.findByIdAndUpdate(id, {
      ...dto,
      slug,
      branchId,
      isActive: dto.isActive ?? existing.isActive,
    });

    if (dto.isActive) {
      await this.activateTemplate(id, dto.kind ?? existing.kind, {
        branchId,
        oversightRegion: dto.oversightRegion ?? existing.oversightRegion,
        district: dto.district ?? existing.district,
      });
    }

    return this.findOne(id, currentUser, webUrl);
  }

  async createBranchOverride(
    templateId: string,
    dto: CreateBranchOverrideDto,
    currentUser: AuthUser,
    webUrl?: string,
  ) {
    const sourceTemplate = await this.templateModel.findById(templateId).lean();

    if (!sourceTemplate) {
      throw new NotFoundException('Template not found');
    }

    if (sourceTemplate.branchId) {
      await this.accessScopeService.ensureBranchAccess(
        currentUser,
        String(sourceTemplate.branchId),
      );
    }

    const rootTemplate = await this.findRootTemplate(sourceTemplate);
    const branchId = await this.accessScopeService.resolveScopedBranchId(
      currentUser,
      dto.branchId,
    );

    if (!branchId) {
      throw new BadRequestException('A branch is required to create a branch override');
    }

    const existingOverride = await this.templateModel
      .findOne({
        baseTemplateId: rootTemplate._id,
        branchId,
      })
      .lean();

    if (existingOverride?._id) {
      return this.findOne(String(existingOverride._id), currentUser, webUrl);
    }

    const slug = await this.buildBranchOverrideSlug(rootTemplate.slug, branchId);
    const overrideTemplate = await this.templateModel.create({
      kind: rootTemplate.kind,
      name: rootTemplate.name,
      slug,
      branchId,
      baseTemplateId: rootTemplate._id,
      isBranchOverride: true,
      isActive: rootTemplate.isActive,
      isSeeded: false,
      badge: rootTemplate.badge,
      title: rootTemplate.title,
      subtitle: rootTemplate.subtitle,
      introTitle: rootTemplate.introTitle,
      introBody: rootTemplate.introBody,
      closingText: rootTemplate.closingText,
      submitLabel: rootTemplate.submitLabel,
      successTitle: rootTemplate.successTitle,
      successMessage: rootTemplate.successMessage,
      logoPath: rootTemplate.logoPath,
      theme: rootTemplate.theme,
      fields: rootTemplate.fields,
    });

    if (overrideTemplate.isActive) {
      await this.activateTemplate(overrideTemplate.id, overrideTemplate.kind, { branchId });
    }

    return this.findOne(overrideTemplate.id, currentUser, webUrl);
  }

  async createDistrictOverride(
    templateId: string,
    dto: CreateDistrictOverrideDto,
    currentUser: AuthUser,
    webUrl?: string,
  ) {
    const sourceTemplate = await this.templateModel.findById(templateId).lean();

    if (!sourceTemplate) {
      throw new NotFoundException('Template not found');
    }

    if (sourceTemplate.branchId) {
      await this.accessScopeService.ensureBranchAccess(
        currentUser,
        String(sourceTemplate.branchId),
      );
    }

    const rootTemplate = await this.findRootTemplate(sourceTemplate);
    const oversightRegion = dto.oversightRegion?.trim() || currentUser.oversightRegion;
    const district = dto.district?.trim() || currentUser.district;

    if (!oversightRegion || !district) {
      throw new BadRequestException('An oversight region and district are required to create a district template');
    }

    if (!this.canEditDistrictTemplate(currentUser, oversightRegion, district)) {
      throw new ForbiddenException('You cannot create templates outside your district scope');
    }

    const existingOverride = await this.templateModel
      .findOne({
        baseTemplateId: rootTemplate._id,
        branchId: { $exists: false },
        oversightRegion,
        district,
      })
      .lean();

    if (existingOverride?._id) {
      return this.findOne(String(existingOverride._id), currentUser, webUrl);
    }

    const slug = await this.buildDistrictOverrideSlug(rootTemplate.slug, oversightRegion, district);
    const overrideTemplate = await this.templateModel.create({
      kind: rootTemplate.kind,
      name: rootTemplate.name,
      slug,
      branchId: undefined,
      oversightRegion,
      district,
      baseTemplateId: rootTemplate._id,
      isBranchOverride: false,
      isDistrictOverride: true,
      isActive: rootTemplate.isActive,
      isSeeded: false,
      badge: rootTemplate.badge,
      title: rootTemplate.title,
      subtitle: rootTemplate.subtitle,
      introTitle: rootTemplate.introTitle,
      introBody: rootTemplate.introBody,
      closingText: rootTemplate.closingText,
      submitLabel: rootTemplate.submitLabel,
      successTitle: rootTemplate.successTitle,
      successMessage: rootTemplate.successMessage,
      logoPath: rootTemplate.logoPath,
      theme: rootTemplate.theme,
      fields: rootTemplate.fields,
    });

    if (overrideTemplate.isActive) {
      await this.activateTemplate(overrideTemplate.id, overrideTemplate.kind, {
        oversightRegion,
        district,
      });
    }

    return this.findOne(overrideTemplate.id, currentUser, webUrl);
  }

  async getActivePublicTemplate(kind: string, webUrl?: string) {
    const template =
      (await this.templateModel
        .findOne({ kind, isActive: true, branchId: { $exists: false } })
        .sort({ updatedAt: -1 })
        .lean()) ??
      (await this.templateModel
        .findOne({ kind, isActive: true })
      .sort({ branchId: -1, updatedAt: -1 })
      .lean());

    if (!template) {
      throw new NotFoundException('No active public template was found');
    }

    const hydratedTemplate = await this.hydrateDynamicFields(template);
    return this.toResponse(hydratedTemplate, webUrl);
  }

  async listActivePublicTemplates(
    kind: string,
    webUrl?: string,
  ): Promise<Record<string, unknown>[]> {
    const templates = await this.templateModel
      .find({ kind, isActive: true })
      .sort({ updatedAt: -1 })
      .lean();

    const hydratedTemplates = await Promise.all(
      templates.map(async (template) => this.hydrateDynamicFields(template)),
    );

    const branchIds = hydratedTemplates
      .map((template) => this.toString(template.branchId))
      .filter((value): value is string => !!value);

    const branches = await this.branchModel
      .find({ _id: { $in: branchIds } })
      .select('name address city state country contactInfo serviceTimes status')
      .lean();

    const branchMap = new Map(branches.map((branch) => [String(branch._id), branch]));

    return hydratedTemplates.map((template) => {
      const branchId = this.toString(template.branchId);

      return {
        ...this.toResponse(template, webUrl),
        branch: branchId
          ? {
              _id: branchId,
              name: branchMap.get(branchId)?.name,
              address: branchMap.get(branchId)?.address,
              city: branchMap.get(branchId)?.city,
              state: branchMap.get(branchId)?.state,
              country: branchMap.get(branchId)?.country,
              contactInfo: branchMap.get(branchId)?.contactInfo,
              serviceTimes: branchMap.get(branchId)?.serviceTimes,
              status: branchMap.get(branchId)?.status,
            }
          : undefined,
      } as Record<string, unknown>;
    });
  }

  async getPublicTemplateBySlug(slug: string, webUrl?: string, requestedBranchId?: string) {
    let template = await this.templateModel.findOne({ slug, isActive: true }).lean();

    if (!template) {
      throw new NotFoundException('Public template not found');
    }

    const requestedBranch = this.toString(requestedBranchId);

    if (requestedBranch && !template.branchId) {
      const branchOverride = await this.templateModel
        .findOne({
          baseTemplateId: template._id,
          branchId: requestedBranch,
          isActive: true,
        })
        .lean();

      if (branchOverride) {
        template = branchOverride;
      } else {
        const branch = await this.branchModel
          .findById(requestedBranch)
          .select('oversightRegion district')
          .lean();

        if (branch?.oversightRegion && branch.district) {
          const districtOverride = await this.templateModel
            .findOne({
              baseTemplateId: template._id,
              branchId: { $exists: false },
              oversightRegion: branch.oversightRegion,
              district: branch.district,
              isActive: true,
            })
            .lean();

          if (districtOverride) {
            template = districtOverride;
          }
        }
      }
    }

    const hydratedTemplate = await this.hydrateDynamicFields(
      await this.applyPublicBranchContext(
        template,
        requestedBranchId,
      ),
    );
    return this.toResponse(hydratedTemplate, webUrl);
  }

  private getFieldMap(template: IntakeTemplateDocument | (IntakeTemplate & { _id?: unknown })) {
    return new Map((template.fields ?? []).map((field) => [field.key, field]));
  }

  private getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = `${today.getMonth() + 1}`.padStart(2, '0');
    const day = `${today.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private validateDateField(label: string, value: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      if (value > this.getTodayDateString()) {
        throw new BadRequestException(`${label} cannot be in the future`);
      }

      return value;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${label} must be a valid date`);
    }

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    if (parsed.getTime() > endOfToday.getTime()) {
      throw new BadRequestException(`${label} cannot be in the future`);
    }

    return value;
  }

  private validateFieldValue(
    field: IntakeTemplateDocument['fields'][number] | (IntakeTemplate['fields'][number] & { _id?: unknown }),
    value: unknown,
  ) {
    if (field.type === 'checkbox') {
      if (!Array.isArray(value)) {
        throw new BadRequestException(`${field.label} must be a list of selected options`);
      }

      const options = field.options || [];
      const selected = value.map((item) => String(item).trim()).filter(Boolean);

      if (field.required && selected.length === 0) {
        throw new BadRequestException(`${field.label} is required`);
      }

      if (options.length > 0 && selected.some((item) => !options.includes(item))) {
        throw new BadRequestException(`${field.label} contains an invalid option`);
      }

      return selected.length > 0 ? selected : undefined;
    }

    const normalized = typeof value === 'string' ? value.trim() : value;

    if (normalized === undefined || normalized === null || normalized === '') {
      return undefined;
    }

    if (field.type === 'date') {
      return this.validateDateField(field.label, String(normalized));
    }

    if (field.type === 'email') {
      const email = String(normalized).toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException(`${field.label} must be a valid email address`);
      }

      return email;
    }

    if (field.type === 'tel') {
      const phone = String(normalized);
      const digits = phone.replace(/\D/g, '');

      if (digits.length < 7 || digits.length > 15) {
        throw new BadRequestException(`${field.label} must be a valid phone number`);
      }

      return phone;
    }

    if (field.type === 'number') {
      const parsed = Number(normalized);

      if (Number.isNaN(parsed)) {
        throw new BadRequestException(`${field.label} must be a valid number`);
      }

      if (parsed < 0) {
        throw new BadRequestException(`${field.label} cannot be negative`);
      }

      return parsed;
    }

    if (field.type === 'radio' || field.type === 'select') {
      const selected = String(normalized);
      const options = field.options || [];

      if (options.length > 0 && !options.includes(selected)) {
        throw new BadRequestException(`${field.label} contains an invalid option`);
      }

      return selected;
    }

    return normalized;
  }

  private normalizeAnswers(template: IntakeTemplateDocument | (IntakeTemplate & { _id?: unknown }), answers: Record<string, unknown>) {
    const fieldMap = this.getFieldMap(template);
    const normalized: Record<string, unknown> = {};

    for (const [key, field] of fieldMap.entries()) {
      const rawValue = this.findAnswerValue(template, answers, [key], []);
      const value =
        field.type === 'checkbox'
          ? Array.isArray(rawValue)
            ? rawValue
            : rawValue !== undefined && rawValue !== null && rawValue !== ''
              ? [rawValue]
              : []
          : typeof rawValue === 'string'
            ? rawValue.trim()
            : rawValue;

      if (
        field.required &&
        (value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0))
      ) {
        throw new BadRequestException(`${field.label} is required`);
      }

      const validatedValue = this.validateFieldValue(field, value);

      if (
        validatedValue !== undefined &&
        validatedValue !== null &&
        validatedValue !== '' &&
        (!Array.isArray(validatedValue) || validatedValue.length > 0)
      ) {
        normalized[key] = validatedValue;
      }
    }

    return normalized;
  }

  private toString(value: unknown) {
    return typeof value === 'string' ? value.trim() : value !== undefined && value !== null ? String(value) : undefined;
  }

  private normalizeLookupValue(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private findAnswerValue(
    template: IntakeTemplateDocument | (IntakeTemplate & { _id?: unknown }),
    answers: Record<string, unknown>,
    keys: string[],
    labelTerms: string[] = [],
  ) {
    const normalizedCandidates = keys.map((key) => this.normalizeLookupValue(key));

    for (const [key, value] of Object.entries(answers)) {
      const normalizedKey = this.normalizeLookupValue(key);

      if (
        normalizedCandidates.includes(normalizedKey) ||
        normalizedCandidates.some(
          (candidate) => normalizedKey.includes(candidate) || candidate.includes(normalizedKey),
        )
      ) {
        return value;
      }
    }

    if (labelTerms.length === 0) {
      return undefined;
    }

    const matchingField = (template.fields ?? []).find((field) => {
      const normalizedFieldText = this.normalizeLookupValue(`${field.key} ${field.label}`);
      return labelTerms.every((term) =>
        normalizedFieldText.includes(this.normalizeLookupValue(term)),
      );
    });

    if (!matchingField) {
      return undefined;
    }

    return answers[matchingField.key];
  }

  private getAnswerString(
    template: IntakeTemplateDocument | (IntakeTemplate & { _id?: unknown }),
    answers: Record<string, unknown>,
    keys: string[],
    labelTerms: string[] = [],
  ) {
    return this.toString(this.findAnswerValue(template, answers, keys, labelTerms));
  }

  private getAnswerNumber(
    template: IntakeTemplateDocument | (IntakeTemplate & { _id?: unknown }),
    answers: Record<string, unknown>,
    keys: string[],
    labelTerms: string[] = [],
  ) {
    return this.toNumber(this.findAnswerValue(template, answers, keys, labelTerms));
  }

  private extractPersonName(
    template: IntakeTemplateDocument | (IntakeTemplate & { _id?: unknown }),
    answers: Record<string, unknown>,
  ) {
    let firstName = this.getAnswerString(
      template,
      answers,
      ['firstName', 'first_name', 'firstname', 'nameFirst'],
      ['first', 'name'],
    );
    let lastName = this.getAnswerString(
      template,
      answers,
      ['lastName', 'last_name', 'lastname', 'surname', 'familyName', 'nameLast'],
      ['last', 'name'],
    );

    const fullName = this.getAnswerString(
      template,
      answers,
      ['fullName', 'full_name', 'name'],
      ['full', 'name'],
    );

    if ((!firstName || !lastName) && fullName) {
      const parts = fullName.split(/\s+/).filter(Boolean);

      if (!firstName) {
        firstName = parts[0];
      }

      if (!lastName) {
        lastName = parts.slice(1).join(' ');
      }
    }

    if (!firstName || !lastName) {
      const candidateFields = (template.fields ?? []).filter((field) => {
        const normalizedFieldText = this.normalizeLookupValue(`${field.key} ${field.label}`);

        return (
          normalizedFieldText.includes('name') &&
          !normalizedFieldText.includes('invite') &&
          !normalizedFieldText.includes('heard') &&
          !normalizedFieldText.includes('church') &&
          field.type !== 'textarea' &&
          field.type !== 'radio' &&
          field.type !== 'checkbox' &&
          field.type !== 'select'
        );
      });

      const candidateValues = candidateFields
        .map((field) => this.toString(answers[field.key]))
        .filter((value): value is string => !!value);

      if ((!firstName || !lastName) && candidateValues.length >= 2) {
        firstName = firstName || candidateValues[0];
        lastName = lastName || candidateValues[1];
      } else if ((!firstName || !lastName) && candidateValues.length === 1) {
        const parts = candidateValues[0].split(/\s+/).filter(Boolean);

        if (!firstName) {
          firstName = parts[0];
        }

        if (!lastName) {
          lastName = parts.slice(1).join(' ');
        }
      }
    }

    if (!firstName || !lastName) {
      throw new BadRequestException(
        'This intake template must provide both first name and last name before submission.',
      );
    }

    return { firstName, lastName };
  }

  private toNumber(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private buildAttendanceCreatePayload(
    template: IntakeTemplateDocument | (IntakeTemplate & { _id?: unknown; branchId?: unknown }),
    answers: Record<string, unknown>,
    branchId: string,
  ) {
    return {
      branchId,
      serviceDate: this.getAnswerString(template, answers, ['serviceDate', 'dayOfService'], ['service', 'date'])!,
      serviceType:
        this.getAnswerString(template, answers, ['serviceType'], ['service', 'type']) ?? 'Service',
      serviceName: this.getAnswerString(template, answers, ['serviceName'], ['service', 'name']),
      entryMode: 'summary',
      personType: 'summary',
      menCount: this.getAnswerNumber(template, answers, ['menCount'], ['men']),
      womenCount: this.getAnswerNumber(template, answers, ['womenCount'], ['women']),
      childrenCount: this.getAnswerNumber(template, answers, ['childrenCount'], ['children']),
      adultsCount: this.getAnswerNumber(template, answers, ['adultsCount'], ['adults']),
      firstTimersCount: this.getAnswerNumber(template, answers, ['firstTimersCount'], ['first', 'timer']),
      newConvertsCount: this.getAnswerNumber(template, answers, ['newConvertsCount'], ['new', 'convert']),
      holySpiritBaptismCount: this.getAnswerNumber(
        template,
        answers,
        ['holySpiritBaptismCount'],
        ['holy', 'spirit'],
      ),
    };
  }

  private buildAttendanceSubmissionSnapshot(
    template: IntakeTemplateDocument | (IntakeTemplate & { _id?: unknown; branchId?: unknown }),
    answers: Record<string, unknown>,
    branchId: string,
  ) {
    const payload = this.buildAttendanceCreatePayload(template, answers, branchId);

    return {
      branchId,
      serviceDate: payload.serviceDate ? new Date(payload.serviceDate) : undefined,
      serviceType: payload.serviceType,
      serviceName: payload.serviceName,
      menCount: payload.menCount,
      womenCount: payload.womenCount,
      childrenCount: payload.childrenCount,
      adultsCount: payload.adultsCount,
      firstTimersCount: payload.firstTimersCount,
      newConvertsCount: payload.newConvertsCount,
      holySpiritBaptismCount: payload.holySpiritBaptismCount,
    };
  }

  private buildWeeklyReportSubmissionSnapshot(
    template: IntakeTemplateDocument | (IntakeTemplate & { _id?: unknown; branchId?: unknown }),
    answers: Record<string, unknown>,
    branchId: string,
  ) {
    const currentAttendance = this.getAnswerNumber(template, answers, ['currentAttendance'], ['current', 'attendance']);
    const previousAttendance = this.getAnswerNumber(template, answers, ['previousAttendance'], ['previous', 'attendance']);
    const growth =
      currentAttendance !== undefined && previousAttendance !== undefined
        ? currentAttendance - previousAttendance
        : undefined;
    const growthPercent =
      growth !== undefined && previousAttendance !== undefined && previousAttendance > 0
        ? Number(((growth / previousAttendance) * 100).toFixed(2))
        : undefined;

    return {
      branchId,
      serviceDate: new Date(
        this.getAnswerString(template, answers, ['reportWeek', 'weekEnding'], ['report', 'week']) ??
          new Date().toISOString(),
      ),
      serviceType: 'weekly_spiritual_indices',
      serviceName: 'Weekly spiritual indices',
      currentAttendance,
      previousAttendance,
      growth,
      growthPercent,
      averageLastYear: this.getAnswerNumber(template, answers, ['averageLastYear'], ['avg', 'last', 'year']),
      averageLastPeriod: this.getAnswerNumber(template, answers, ['averageLastPeriod'], ['avg', 'recent']),
      firstTimersCount: this.getAnswerNumber(template, answers, ['firstTimersCount'], ['first', 'timer']),
      newConvertsCount: this.getAnswerNumber(template, answers, ['newConvertsCount'], ['new', 'convert']),
      believersFoundationClassCount: this.getAnswerNumber(
        template,
        answers,
        ['believersFoundationClassCount'],
        ['believers', 'foundation'],
      ),
      holySpiritBaptismCount: this.getAnswerNumber(template, answers, ['holySpiritBaptismCount'], ['holy', 'ghost']),
      waterBaptismCount: this.getAnswerNumber(template, answers, ['waterBaptismCount'], ['water', 'baptism']),
      covenantHourOfPrayerAttendance: this.getAnswerNumber(
        template,
        answers,
        ['covenantHourOfPrayerAttendance'],
        ['covenant', 'hour'],
      ),
      winnersSatelliteFellowshipAverage: this.getAnswerNumber(
        template,
        answers,
        ['winnersSatelliteFellowshipAverage'],
        ['satellite', 'fellowship'],
      ),
      cellCount: this.getAnswerNumber(template, answers, ['cellCount'], ['cells']),
      newCellCount: this.getAnswerNumber(template, answers, ['newCellCount'], ['new', 'cells']),
      wofbiAttendance: this.getAnswerNumber(template, answers, ['wofbiAttendance'], ['wofbi']),
      remarks: this.getAnswerString(template, answers, ['remarks'], ['remarks']),
    };
  }

  private getAttendanceSubmissionStatus(
    submission: IntakeSubmission & {
      status?: string;
      attendanceId?: unknown;
      templateKind?: string;
    },
  ) {
    if (submission.status) {
      return submission.status;
    }

    if (submission.templateKind === 'attendance') {
      return submission.attendanceId ? 'approved' : 'pending';
    }

    return 'completed';
  }

  private toAttendanceSubmissionResponse(
    submission: Record<string, unknown>,
    duplicateSummaryCount: number,
  ) {
    const branchValue =
      typeof submission.branchId === 'object' && submission.branchId !== null
        ? {
            _id: String((submission.branchId as { _id?: unknown })._id ?? ''),
            name: (submission.branchId as { name?: string }).name,
            oversightRegion: (submission.branchId as { oversightRegion?: string }).oversightRegion,
            district: (submission.branchId as { district?: string }).district,
          }
        : undefined;

    const approvedByValue =
      typeof submission.approvedBy === 'object' && submission.approvedBy !== null
        ? {
            _id: String((submission.approvedBy as { _id?: unknown })._id ?? ''),
            firstName: (submission.approvedBy as { firstName?: string }).firstName,
            lastName: (submission.approvedBy as { lastName?: string }).lastName,
            email: (submission.approvedBy as { email?: string }).email,
            role: (submission.approvedBy as { role?: string }).role,
          }
        : undefined;

    const rejectedByValue =
      typeof submission.rejectedBy === 'object' && submission.rejectedBy !== null
        ? {
            _id: String((submission.rejectedBy as { _id?: unknown })._id ?? ''),
            firstName: (submission.rejectedBy as { firstName?: string }).firstName,
            lastName: (submission.rejectedBy as { lastName?: string }).lastName,
            email: (submission.rejectedBy as { email?: string }).email,
            role: (submission.rejectedBy as { role?: string }).role,
          }
        : undefined;

    return {
      _id: String(submission._id),
      templateName: String(submission.templateName ?? ''),
      templateKind: String(submission.templateKind ?? ''),
      status: this.getAttendanceSubmissionStatus(submission as unknown as IntakeSubmission),
      branchId: branchValue,
      serviceDate: submission.serviceDate ? new Date(String(submission.serviceDate)) : undefined,
      serviceType: typeof submission.serviceType === 'string' ? submission.serviceType : undefined,
      serviceName: typeof submission.serviceName === 'string' ? submission.serviceName : undefined,
      menCount: this.toNumber(submission.menCount),
      womenCount: this.toNumber(submission.womenCount),
      childrenCount: this.toNumber(submission.childrenCount),
      adultsCount: this.toNumber(submission.adultsCount),
      firstTimersCount: this.toNumber(submission.firstTimersCount),
      newConvertsCount: this.toNumber(submission.newConvertsCount),
      holySpiritBaptismCount: this.toNumber(submission.holySpiritBaptismCount),
      currentAttendance: this.toNumber(submission.currentAttendance),
      previousAttendance: this.toNumber(submission.previousAttendance),
      growth: this.toNumber(submission.growth),
      growthPercent: this.toNumber(submission.growthPercent),
      averageLastYear: this.toNumber(submission.averageLastYear),
      averageLastPeriod: this.toNumber(submission.averageLastPeriod),
      believersFoundationClassCount: this.toNumber(submission.believersFoundationClassCount),
      waterBaptismCount: this.toNumber(submission.waterBaptismCount),
      covenantHourOfPrayerAttendance: this.toNumber(submission.covenantHourOfPrayerAttendance),
      winnersSatelliteFellowshipAverage: this.toNumber(submission.winnersSatelliteFellowshipAverage),
      cellCount: this.toNumber(submission.cellCount),
      newCellCount: this.toNumber(submission.newCellCount),
      wofbiAttendance: this.toNumber(submission.wofbiAttendance),
      remarks: typeof submission.remarks === 'string' ? submission.remarks : undefined,
      answers:
        typeof submission.answers === 'object' && submission.answers !== null
          ? submission.answers
          : {},
      attendanceId: submission.attendanceId ? String(submission.attendanceId) : undefined,
      duplicateSummaryCount,
      approvedAt: submission.approvedAt ? new Date(String(submission.approvedAt)) : undefined,
      rejectedAt: submission.rejectedAt ? new Date(String(submission.rejectedAt)) : undefined,
      approvedBy: approvedByValue,
      rejectedBy: rejectedByValue,
      createdAt: submission.createdAt ? new Date(String(submission.createdAt)) : undefined,
    };
  }

  private async createDomainRecord(
    template: IntakeTemplateDocument | (IntakeTemplate & { _id?: unknown; branchId?: unknown }),
    answers: Record<string, unknown>,
  ) {
    const branchId = this.toString(template.branchId) || this.toString(answers.branchId);

    if (template.kind === 'guest') {
      if (!branchId) {
        throw new BadRequestException('Guest intake template must be linked to a branch');
      }

      const { firstName, lastName } = this.extractPersonName(template, answers);

      const guest = await this.guestsService.create({
        branchId,
        firstName,
        lastName,
        phone: this.getAnswerString(template, answers, ['phone', 'phoneNumber', 'mobile'], ['phone'])!,
        email: this.getAnswerString(template, answers, ['email'], ['email']),
        address: this.getAnswerString(template, answers, ['address', 'streetAddress', 'street'], ['address']),
        city: this.getAnswerString(template, answers, ['city'], ['city']),
        state: this.getAnswerString(template, answers, ['state'], ['state']),
        zipCode: this.getAnswerString(template, answers, ['zipCode', 'zip', 'postalCode'], ['zip']),
        gender: this.getAnswerString(template, answers, ['gender'], ['gender']),
        invitedBy: this.getAnswerString(template, answers, ['invitedBy', 'inviter'], ['invite']),
        heardAboutChurch: this.getAnswerString(
          template,
          answers,
          ['heardAboutChurch', 'heardAboutUs', 'howDidYouHearAboutUs'],
          ['hear', 'about'],
        ),
        prayerRequest: this.getAnswerString(template, answers, ['prayerRequest'], ['prayer']),
        serviceType:
          this.getAnswerString(template, answers, ['serviceType', 'serviceName'], ['service', 'type']) ??
          'Sunday service',
        visitDate: this.getAnswerString(template, answers, ['visitDate', 'serviceDate'], ['date']),
      });

      return { guestId: guest._id };
    }

    if (template.kind === 'member') {
      if (!branchId) {
        throw new BadRequestException('Member intake template must be linked to a branch');
      }

      const member = await this.membersService.create({
        branchId,
        title: this.getAnswerString(template, answers, ['title'], ['title']),
        firstName: this.extractPersonName(template, answers).firstName,
        lastName: this.extractPersonName(template, answers).lastName,
        phone: this.getAnswerString(template, answers, ['phone', 'phoneNumber', 'mobile'], ['phone']),
        email: this.getAnswerString(template, answers, ['email'], ['email']),
        familyDetails: this.getAnswerString(template, answers, ['familyDetails'], ['family']),
        membershipStatus: this.getAnswerString(template, answers, ['membershipStatus'], ['membership', 'status']) ?? 'active',
        serviceUnitInterest: this.getAnswerString(template, answers, ['serviceUnitInterest'], ['service', 'unit']),
        dateJoinedChurch: this.getAnswerString(template, answers, ['dateJoinedChurch'], ['date', 'joined']),
        believerFoundationClassStatus: this.getAnswerString(template, answers, ['believerFoundationClassStatus']),
        believerFoundationClassDate: this.getAnswerString(template, answers, ['believerFoundationClassDate']),
        believerFoundationClassLocation: this.getAnswerString(template, answers, ['believerFoundationClassLocation']),
        bccStatus: this.getAnswerString(template, answers, ['bccStatus']),
        bccDate: this.getAnswerString(template, answers, ['bccDate']),
        bccLocation: this.getAnswerString(template, answers, ['bccLocation']),
        lccStatus: this.getAnswerString(template, answers, ['lccStatus']),
        lccDate: this.getAnswerString(template, answers, ['lccDate']),
        lccLocation: this.getAnswerString(template, answers, ['lccLocation']),
        lcdStatus: this.getAnswerString(template, answers, ['lcdStatus']),
        lcdDate: this.getAnswerString(template, answers, ['lcdDate']),
        lcdLocation: this.getAnswerString(template, answers, ['lcdLocation']),
        holySpiritBaptismStatus: this.getAnswerString(template, answers, ['holySpiritBaptismStatus']),
        waterBaptismStatus: this.getAnswerString(template, answers, ['waterBaptismStatus']),
      });

      return { memberId: member._id };
    }

    if (template.kind === 'weekly_report') {
      if (!branchId) {
        throw new BadRequestException('Weekly report template must be linked to a branch');
      }

      return this.buildWeeklyReportSubmissionSnapshot(template, answers, branchId);
    }

    if (!branchId) {
      throw new BadRequestException('Attendance template must be linked to a branch');
    }

    return this.buildAttendanceSubmissionSnapshot(template, answers, branchId);
  }

  async listAttendanceSubmissions(
    currentUser: AuthUser,
    filters: {
      branchId?: string;
      status?: string;
    } = {},
  ) {
    this.ensureAttendanceSubmissionViewRole(currentUser);

    const branchFilter = await this.accessScopeService.buildBranchObjectIdFilter(
      currentUser,
      filters.branchId,
    );
    const normalizedStatus = this.toString(filters.status);
    const query: Record<string, unknown> = {
      templateKind: { $in: ['attendance', 'weekly_report'] },
      ...branchFilter,
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
    };

    const submissions = await this.submissionModel
      .find(query)
      .populate('branchId', 'name oversightRegion district')
      .populate('approvedBy', 'firstName lastName email role')
      .populate('rejectedBy', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .lean();

    const duplicateSummaryCounts = await Promise.all(
      submissions.map(async (submission) => {
        if (
          submission.templateKind !== 'attendance' ||
          !submission.branchId ||
          !submission.serviceDate ||
          !submission.serviceType
        ) {
          return 0;
        }

        const submittedDate = new Date(String(submission.serviceDate));
        const startOfDay = new Date(submittedDate);
        const endOfDay = new Date(submittedDate);
        startOfDay.setHours(0, 0, 0, 0);
        endOfDay.setHours(23, 59, 59, 999);

        return this.attendanceService.list(currentUser, {
          branchId:
            typeof submission.branchId === 'object' && submission.branchId !== null
              ? String((submission.branchId as { _id?: unknown })._id ?? '')
              : String(submission.branchId),
          entryMode: 'summary',
          serviceType: String(submission.serviceType),
          serviceName: typeof submission.serviceName === 'string' ? submission.serviceName : undefined,
          dateFrom: startOfDay.toISOString(),
          dateTo: endOfDay.toISOString(),
        }).then((records) => records.length);
      }),
    );

    const items = submissions.map((submission, index) =>
      this.toAttendanceSubmissionResponse(submission, duplicateSummaryCounts[index] ?? 0),
    );

    return {
      items,
      summary: {
        pending: items.filter((item) => item.status === 'pending').length,
        approved: items.filter((item) => item.status === 'approved').length,
        rejected: items.filter((item) => item.status === 'rejected').length,
      },
    };
  }

  private normalizeDateBoundary(value: string | undefined, fallback: Date, endOfDay = false) {
    const parsed = value ? new Date(value) : fallback;

    if (Number.isNaN(parsed.getTime())) {
      return fallback;
    }

    parsed.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    return parsed;
  }

  private numberValue(value: unknown) {
    return this.toNumber(value) ?? 0;
  }

  private buildCsvValue(value: unknown) {
    const text = value === undefined || value === null ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  private async resolveWeeklyReportBranches(
    currentUser: AuthUser,
    filters: {
      branchId?: string;
      oversightRegion?: string;
      district?: string;
    },
  ) {
    const baseQuery = await this.accessScopeService.getBranchDocumentQuery(currentUser);
    const query: Record<string, unknown> = { ...baseQuery };

    if (filters.branchId) {
      await this.accessScopeService.ensureBranchAccess(currentUser, filters.branchId);
      query._id = new Types.ObjectId(filters.branchId);
    } else {
      if (filters.oversightRegion) {
        query.oversightRegion = filters.oversightRegion;
      }

      if (filters.district) {
        query.district = filters.district;
      }
    }

    return this.branchModel
      .find(query)
      .select('name oversightRegion district city state status')
      .sort({ oversightRegion: 1, district: 1, name: 1 })
      .lean();
  }

  private weeklyItemFromSubmission(submission: Record<string, unknown>) {
    const branch =
      typeof submission.branchId === 'object' && submission.branchId !== null
        ? (submission.branchId as {
            _id?: unknown;
            name?: string;
            oversightRegion?: string;
            district?: string;
            city?: string;
            state?: string;
          })
        : {};
    const answers =
      typeof submission.answers === 'object' && submission.answers !== null
        ? (submission.answers as Record<string, unknown>)
        : {};

    return {
      _id: String(submission._id),
      status: this.getAttendanceSubmissionStatus(submission as unknown as IntakeSubmission),
      templateName: String(submission.templateName ?? ''),
      branch: {
        _id: String(branch._id ?? ''),
        name: branch.name || 'Unassigned',
        oversightRegion: branch.oversightRegion || '',
        district: branch.district || '',
        city: branch.city,
        state: branch.state,
      },
      reportWeek: submission.serviceDate ? new Date(String(submission.serviceDate)).toISOString() : undefined,
      currentAttendance: this.numberValue(submission.currentAttendance),
      previousAttendance: this.numberValue(submission.previousAttendance),
      growth: this.numberValue(submission.growth),
      growthPercent: this.numberValue(submission.growthPercent),
      averageLastYear: this.numberValue(submission.averageLastYear),
      averageLastPeriod: this.numberValue(submission.averageLastPeriod),
      firstTimersCount: this.numberValue(submission.firstTimersCount),
      newConvertsCount: this.numberValue(submission.newConvertsCount),
      believersFoundationClassCount: this.numberValue(submission.believersFoundationClassCount),
      holySpiritBaptismCount: this.numberValue(submission.holySpiritBaptismCount),
      waterBaptismCount: this.numberValue(submission.waterBaptismCount),
      covenantHourOfPrayerAttendance: this.numberValue(submission.covenantHourOfPrayerAttendance),
      winnersSatelliteFellowshipAverage: this.numberValue(submission.winnersSatelliteFellowshipAverage),
      cellCount: this.numberValue(submission.cellCount),
      newCellCount: this.numberValue(submission.newCellCount),
      wofbiAttendance: this.numberValue(submission.wofbiAttendance),
      remarks: typeof submission.remarks === 'string' ? submission.remarks : String(answers.remarks ?? ''),
      createdAt: submission.createdAt ? new Date(String(submission.createdAt)).toISOString() : undefined,
      approvedAt: submission.approvedAt ? new Date(String(submission.approvedAt)).toISOString() : undefined,
    };
  }

  async listWeeklyReports(
    currentUser: AuthUser,
    filters: {
      branchId?: string;
      oversightRegion?: string;
      district?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {},
  ) {
    this.ensureAttendanceSubmissionViewRole(currentUser);

    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 83);
    const defaultEnd = new Date();
    const startDate = this.normalizeDateBoundary(filters.dateFrom, defaultStart);
    const endDate = this.normalizeDateBoundary(filters.dateTo, defaultEnd, true);
    const branches = await this.resolveWeeklyReportBranches(currentUser, filters);
    const branchIds = branches.map((branch) => new Types.ObjectId(String(branch._id)));

    if (branchIds.length === 0) {
      return {
        filters: {
          dateFrom: startDate.toISOString(),
          dateTo: endDate.toISOString(),
        },
        items: [],
        totals: {},
        branchTotals: [],
        districtTotals: [],
        trends: [],
      };
    }

    const query: Record<string, unknown> = {
      templateKind: 'weekly_report',
      branchId: { $in: branchIds },
      serviceDate: { $gte: startDate, $lte: endDate },
      ...(filters.status ? { status: filters.status } : {}),
    };

    const submissions = await this.submissionModel
      .find(query)
      .populate('branchId', 'name oversightRegion district city state')
      .sort({ serviceDate: -1, createdAt: -1 })
      .lean();
    const items = submissions.map((submission) => this.weeklyItemFromSubmission(submission));

    const emptyTotals = {
      reports: 0,
      currentAttendance: 0,
      previousAttendance: 0,
      growth: 0,
      averageGrowthPercent: 0,
      firstTimersCount: 0,
      newConvertsCount: 0,
      believersFoundationClassCount: 0,
      holySpiritBaptismCount: 0,
      waterBaptismCount: 0,
      covenantHourOfPrayerAttendance: 0,
      winnersSatelliteFellowshipAverage: 0,
      cellCount: 0,
      newCellCount: 0,
      wofbiAttendance: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    const totals = items.reduce(
      (acc, item) => {
        acc.reports += 1;
        acc.currentAttendance += item.currentAttendance;
        acc.previousAttendance += item.previousAttendance;
        acc.growth += item.growth;
        acc.firstTimersCount += item.firstTimersCount;
        acc.newConvertsCount += item.newConvertsCount;
        acc.believersFoundationClassCount += item.believersFoundationClassCount;
        acc.holySpiritBaptismCount += item.holySpiritBaptismCount;
        acc.waterBaptismCount += item.waterBaptismCount;
        acc.covenantHourOfPrayerAttendance += item.covenantHourOfPrayerAttendance;
        acc.winnersSatelliteFellowshipAverage += item.winnersSatelliteFellowshipAverage;
        acc.cellCount += item.cellCount;
        acc.newCellCount += item.newCellCount;
        acc.wofbiAttendance += item.wofbiAttendance;
        if (item.status === 'approved') acc.approved += 1;
        else if (item.status === 'rejected') acc.rejected += 1;
        else acc.pending += 1;
        return acc;
      },
      { ...emptyTotals },
    );
    totals.averageGrowthPercent =
      totals.previousAttendance > 0 ? Number(((totals.growth / totals.previousAttendance) * 100).toFixed(2)) : 0;

    const summarizeGroup = (groupItems: typeof items, key: string, label: string, extra: Record<string, unknown> = {}) => {
      const groupTotals = groupItems.reduce(
        (acc, item) => {
          acc.reports += 1;
          acc.currentAttendance += item.currentAttendance;
          acc.previousAttendance += item.previousAttendance;
          acc.growth += item.growth;
          acc.firstTimersCount += item.firstTimersCount;
          acc.newConvertsCount += item.newConvertsCount;
          acc.cellCount += item.cellCount;
          acc.newCellCount += item.newCellCount;
          return acc;
        },
        {
          key,
          label,
          reports: 0,
          currentAttendance: 0,
          previousAttendance: 0,
          growth: 0,
          growthPercent: 0,
          firstTimersCount: 0,
          newConvertsCount: 0,
          cellCount: 0,
          newCellCount: 0,
          ...extra,
        },
      );
      groupTotals.growthPercent =
        groupTotals.previousAttendance > 0
          ? Number(((groupTotals.growth / groupTotals.previousAttendance) * 100).toFixed(2))
          : 0;
      return groupTotals;
    };

    const branchTotals = branches.map((branch) => {
      const branchId = String(branch._id);
      return summarizeGroup(
        items.filter((item) => item.branch._id === branchId),
        branchId,
        branch.name,
        {
          oversightRegion: branch.oversightRegion,
          district: branch.district,
        },
      );
    });
    const districtKeys = Array.from(
      new Set(branches.map((branch) => `${branch.oversightRegion}::${branch.district}`)),
    );
    const districtTotals = districtKeys.map((key) => {
      const [oversightRegion, district] = key.split('::');
      return summarizeGroup(
        items.filter((item) => item.branch.oversightRegion === oversightRegion && item.branch.district === district),
        key,
        district,
        { oversightRegion, district },
      );
    });
    const trendKeys = Array.from(
      new Set(
        items
          .map((item) => item.reportWeek?.slice(0, 10))
          .filter((value): value is string => !!value),
      ),
    ).sort();
    const trends = trendKeys.map((date) =>
      summarizeGroup(
        items.filter((item) => item.reportWeek?.slice(0, 10) === date),
        date,
        date,
      ),
    );

    return {
      filters: {
        dateFrom: startDate.toISOString(),
        dateTo: endDate.toISOString(),
        branchId: filters.branchId,
        oversightRegion: filters.oversightRegion,
        district: filters.district,
        status: filters.status,
      },
      scope: {
        branchCount: branches.length,
        branches: branches.map((branch) => ({
          _id: String(branch._id),
          name: branch.name,
          oversightRegion: branch.oversightRegion,
          district: branch.district,
          city: branch.city,
          state: branch.state,
          hasReport: items.some((item) => item.branch._id === String(branch._id)),
        })),
      },
      items,
      totals,
      branchTotals,
      districtTotals,
      trends,
    };
  }

  async exportWeeklyReportsCsv(
    currentUser: AuthUser,
    filters: {
      branchId?: string;
      oversightRegion?: string;
      district?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {},
  ) {
    const report = await this.listWeeklyReports(currentUser, filters);
    const headers = [
      'Week',
      'National Area',
      'District',
      'Branch',
      'Status',
      'Current Attendance',
      'Previous Attendance',
      'Growth',
      'Growth %',
      'Avg Last Year',
      'Avg Recent',
      'FT',
      'NC',
      'BFC',
      'HGB',
      'WB',
      'CHOP',
      'WSF Avg',
      '# Cells',
      '# New Cells',
      'WOFBI',
      'Remarks',
    ];
    const rows = report.items.map((item: ReturnType<typeof this.weeklyItemFromSubmission>) => [
      item.reportWeek ? item.reportWeek.slice(0, 10) : '',
      item.branch.oversightRegion,
      item.branch.district,
      item.branch.name,
      item.status,
      item.currentAttendance,
      item.previousAttendance,
      item.growth,
      item.growthPercent,
      item.averageLastYear,
      item.averageLastPeriod,
      item.firstTimersCount,
      item.newConvertsCount,
      item.believersFoundationClassCount,
      item.holySpiritBaptismCount,
      item.waterBaptismCount,
      item.covenantHourOfPrayerAttendance,
      item.winnersSatelliteFellowshipAverage,
      item.cellCount,
      item.newCellCount,
      item.wofbiAttendance,
      item.remarks,
    ]);

    return [headers, ...rows].map((row) => row.map((value) => this.buildCsvValue(value)).join(',')).join('\n');
  }

  async approveAttendanceSubmission(id: string, currentUser: AuthUser) {
    this.ensureAttendanceSubmissionApprover(currentUser);

    const submission = await this.submissionModel.findById(id).lean();

    if (!submission || !['attendance', 'weekly_report'].includes(submission.templateKind)) {
      throw new NotFoundException('Attendance submission not found');
    }

    const status = this.getAttendanceSubmissionStatus(submission);

    if (status === 'approved' && (submission.attendanceId || submission.templateKind === 'weekly_report')) {
      throw new BadRequestException('This submission has already been approved');
    }

    if (status === 'rejected') {
      throw new BadRequestException('Rejected attendance submissions cannot be approved again');
    }

    const branchId = this.toString(submission.branchId);

    if (!branchId) {
      throw new BadRequestException('Submission is missing a branch');
    }

    await this.accessScopeService.ensureBranchAccess(currentUser, branchId);

    const template = await this.templateModel.findById(submission.templateId).lean();

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const attendance =
      submission.templateKind === 'attendance'
        ? await this.attendanceService.create(
            this.buildAttendanceCreatePayload(
              template as IntakeTemplate & { _id?: unknown; branchId?: unknown },
              submission.answers,
              branchId,
            ),
            currentUser,
          )
        : undefined;

    await this.submissionModel.findByIdAndUpdate(id, {
      status: 'approved',
      attendanceId: attendance?._id,
      approvedAt: new Date(),
      approvedBy: new Types.ObjectId(currentUser.sub),
      rejectedAt: undefined,
      rejectedBy: undefined,
    });

    await this.auditLogsService.record({
      entityType: 'attendance_submission',
      entityId: id,
      action: 'approved',
      summary: `${submission.templateKind === 'weekly_report' ? 'Weekly report' : 'Attendance submission'} approved for ${
        submission.serviceType || submission.templateName
      }`,
      actor: currentUser,
      branchId,
      metadata: {
        attendanceId: attendance ? String(attendance._id) : undefined,
        serviceDate: submission.serviceDate,
        serviceType: submission.serviceType,
      },
    });

    const updated = await this.submissionModel
      .findById(id)
      .populate('branchId', 'name oversightRegion district')
      .populate('approvedBy', 'firstName lastName email role')
      .populate('rejectedBy', 'firstName lastName email role')
      .lean();

    if (!updated) {
      throw new NotFoundException('Attendance submission not found');
    }

    return this.toAttendanceSubmissionResponse(updated, 0);
  }

  async rejectAttendanceSubmission(id: string, currentUser: AuthUser) {
    this.ensureAttendanceSubmissionApprover(currentUser);

    const submission = await this.submissionModel.findById(id).lean();

    if (!submission || !['attendance', 'weekly_report'].includes(submission.templateKind)) {
      throw new NotFoundException('Attendance submission not found');
    }

    const status = this.getAttendanceSubmissionStatus(submission);

    if (status === 'approved') {
      throw new BadRequestException('Approved attendance submissions cannot be rejected here');
    }

    if (status === 'rejected') {
      throw new BadRequestException('This attendance submission has already been rejected');
    }

    const branchId = this.toString(submission.branchId);

    if (!branchId) {
      throw new BadRequestException('Attendance submission is missing a branch');
    }

    await this.accessScopeService.ensureBranchAccess(currentUser, branchId);

    await this.submissionModel.findByIdAndUpdate(id, {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectedBy: new Types.ObjectId(currentUser.sub),
    });

    await this.auditLogsService.record({
      entityType: 'attendance_submission',
      entityId: id,
      action: 'rejected',
      summary: `Attendance submission rejected for ${submission.serviceType || submission.templateName}`,
      actor: currentUser,
      branchId,
      metadata: {
        serviceDate: submission.serviceDate,
        serviceType: submission.serviceType,
      },
    });

    const updated = await this.submissionModel
      .findById(id)
      .populate('branchId', 'name oversightRegion district')
      .populate('approvedBy', 'firstName lastName email role')
      .populate('rejectedBy', 'firstName lastName email role')
      .lean();

    if (!updated) {
      throw new NotFoundException('Attendance submission not found');
    }

    return this.toAttendanceSubmissionResponse(updated, 0);
  }

  async submitPublic(
    slug: string,
    dto: PublicTemplateSubmitDto,
    webUrl?: string,
    requestedBranchId?: string,
  ) {
    const templateDocument = await this.templateModel.findOne({ slug, isActive: true });

    if (!templateDocument) {
      throw new NotFoundException('Public template not found');
    }

    const template = await this.hydrateDynamicFields(
      await this.applyPublicBranchContext(
        templateDocument.toObject(),
        requestedBranchId,
      ),
    );
    const answers = this.normalizeAnswers(template, dto.answers);
    let domainRecord: Record<string, unknown>;

    try {
      domainRecord = await this.createDomainRecord(template, answers);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error as { name?: string }).name === 'ValidationError'
      ) {
        const validationMessages =
          'errors' in error && typeof (error as { errors?: unknown }).errors === 'object'
            ? Object.values((error as { errors?: Record<string, { message?: string }> }).errors ?? {})
                .map((item) => item?.message)
                .filter((message): message is string => !!message)
            : [];

        throw new BadRequestException(
          validationMessages[0] || 'The public intake submission is missing a required field.',
        );
      }

      throw error;
    }

    const submission =
      await this.submissionModel.create({
      templateId: template._id,
      templateName: template.name,
      templateKind: template.kind,
      branchId: template.branchId,
      answers,
      status: ['attendance', 'weekly_report'].includes(template.kind) ? 'pending' : 'completed',
      ...domainRecord,
    });

    const successTitle =
      template.kind === 'attendance'
        ? 'Attendance summary received'
        : template.kind === 'weekly_report'
          ? 'Weekly report received'
        : template.successTitle;
    const successMessage =
      template.kind === 'attendance'
        ? 'This service attendance summary has been submitted and is awaiting branch approval.'
        : template.kind === 'weekly_report'
          ? 'This weekly spiritual indices report has been submitted and is awaiting district review.'
        : template.successMessage;

    return {
      successTitle,
      successMessage,
      template: this.toResponse(template, webUrl),
      submissionId: String(submission._id),
      ...domainRecord,
    };
  }
}
