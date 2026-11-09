import { BadRequestException, ConflictException, Injectable, NotFoundException, HttpException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import type { Connection, Model } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { intakeTemplateDefaults } from '../intake-templates/intake-template.defaults';
import { AppSetting, AppSettingDocument } from '../settings/schemas/app-setting.schema';

const PUBLIC_OPTIONAL = intakeTemplateDefaults[0].fields.filter(
  (field) => !['visitDate', 'firstName', 'lastName', 'phone'].includes(field.key),
);
const STAFF_OPTIONAL = ['email', 'invitedBy', 'heardAboutChurch', 'prayerRequest', 'assignedFollowUpUserId', 'wantsPastoralCall'];
const MEMBER_PUBLIC = intakeTemplateDefaults.find(({ kind }) => kind === 'member')!.fields
  .filter(({ key }) => !['firstName', 'lastName', 'membershipStatus'].includes(key));
const MEMBER_STAFF = ['email', 'phone', 'title', 'familyDetails', 'dateJoinedChurch', 'formation'];
export const MEMBER_FORMATION_KEYS = MEMBER_PUBLIC.map(({ key }) => key).filter(
  (key) => /^(believerFoundationClass|bcc|lcc|lcd|holySpiritBaptism|waterBaptism)/.test(key),
);
export enum FinanceFormKind {
  Offering = 'offering',
  Expense = 'expense',
}
export enum MinistryFormKind {
  Child = 'child',
  Family = 'family',
  Outreach = 'outreach',
  ServiceUnit = 'service-unit',
  Meeting = 'meeting',
}
type FormKind = 'guest' | 'member' | FinanceFormKind | MinistryFormKind;
const defaultFields: Record<FormKind, { public: { key: string; label: string; labelEs?: string }[]; staff: string[] }> = {
  guest: { public: PUBLIC_OPTIONAL, staff: STAFF_OPTIONAL },
  member: { public: MEMBER_PUBLIC, staff: MEMBER_STAFF },
  offering: { public: [], staff: ['notes'] },
  expense: { public: [], staff: ['payee', 'receiptUrl', 'notes'] },
  child: { public: [], staff: [] },
  family: { public: [], staff: [] },
  outreach: { public: [
    { key: 'city', label: 'City' }, { key: 'prayerRequest', label: 'Prayer request' },
    { key: 'preferredContactTime', label: 'Preferred contact time' },
  ], staff: ['city', 'prayerRequest', 'preferredContactTime'] },
  'service-unit': { public: [], staff: ['notes'] },
  meeting: { public: [], staff: ['agenda', 'location', 'joinUrl'] },
};
const TYPES = ['text', 'textarea', 'number', 'select', 'email', 'tel'] as const;
type Surface = 'public' | 'staff';
type FieldType = (typeof TYPES)[number];

type CustomField = {
  key: string;
  label: string;
  labelEs?: string;
  labelFr?: string;
  labelPt?: string;
  type: FieldType;
  options: string[];
  required: boolean;
  public: boolean;
  staff: boolean;
  guestFieldKey?: string;
};
type Definition = {
  revision: number;
  hiddenPublic: string[];
  hiddenStaff: string[];
  fields: CustomField[];
};
export type GuestAnswer = { key: string; label: string; value: string | number };

const DEFAULTS: Definition = { revision: 0, hiddenPublic: [], hiddenStaff: [], fields: [] };
const BRANCH_REVISION_RANGE = 2 ** 20;

function invalid() {
  return new BadRequestException('Invalid form settings.');
}

@Injectable()
export class GuestFieldsService {
  private readonly attempts = new Map<string, number>();
  private resetsAt = 0;
  private total = 0;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(AppSetting.name) private readonly settings: Model<AppSettingDocument>,
    private readonly audit: AuditLogsService,
  ) {}

  private get definitions() {
    return this.connection.db!.collection<Definition & { _id: string }>('guest_form_settings');
  }

  private async readDefinition(id: string) {
    const stored = await this.definitions.findOne({ _id: id });
    const { revision, hiddenPublic, hiddenStaff, fields } = stored ?? DEFAULTS;
    return { revision, hiddenPublic, hiddenStaff, fields };
  }

  private branchRevision(workspace: Definition, branch: Definition) {
    return branch.revision === 0 ? workspace.revision :
      2 ** 40 + workspace.revision * BRANCH_REVISION_RANGE + branch.revision;
  }

  async get(kind: FormKind = 'guest', branchId?: string) {
    const workspace = await this.readDefinition(kind);
    if (!branchId) return workspace;
    const branch = await this.readDefinition(`${kind}:${branchId.toLowerCase()}`);
    return {
      revision: this.branchRevision(workspace, branch),
      hiddenPublic: [...new Set([...workspace.hiddenPublic, ...branch.hiddenPublic])],
      hiddenStaff: [...new Set([...workspace.hiddenStaff, ...branch.hiddenStaff])],
      fields: [...workspace.fields, ...branch.fields],
    };
  }

  async overview(kind: FormKind = 'guest', branchId?: string) {
    const defaults = defaultFields[kind];
    const workspace = await this.readDefinition(kind);
    const branch = branchId ? await this.readDefinition(`${kind}:${branchId.toLowerCase()}`) : null;
    return {
      ...(branch ?? workspace),
      ...(branch ? {
        revision: this.branchRevision(workspace, branch),
        inheritedHiddenPublic: workspace.hiddenPublic,
        inheritedHiddenStaff: workspace.hiddenStaff,
        inheritedFields: workspace.fields,
      } : {}),
      defaultPublic: defaults.public.map(({ key, label, labelEs }) => ({ key, label, labelEs })),
      defaultStaff: defaults.staff,
      ...(kind === 'member' ? { guestFields: (await this.get()).fields.map(({ key, label, type }) => ({ key, label, type })) } : {}),
    };
  }

  async publish(input: unknown, actor: AuthUser, kind: FormKind = 'guest', branchId?: string) {
    if (!input || typeof input !== 'object') throw invalid();
    const dto = input as Partial<Definition>;
    const id = branchId ? `${kind}:${branchId.toLowerCase()}` : kind;
    const current = await this.readDefinition(id);
    const revision = branchId ? this.branchRevision(await this.readDefinition(kind), current) : current.revision;
    const defaults = defaultFields[kind];
    const sources = kind === 'member' ? (await this.get()).fields : [];
    if (dto.revision !== revision || (branchId && current.revision >= BRANCH_REVISION_RANGE - 1)) {
      throw new ConflictException('Form settings changed. Reload settings before publishing.');
    }
    const hidden = (values: unknown, allowed: string[]) => {
      if (!Array.isArray(values) || values.some((value) => !allowed.includes(value))) throw invalid();
      return [...new Set<string>(values)];
    };
    if (!Array.isArray(dto.fields) || dto.fields.length > 20) throw invalid();
    const seen = new Set<string>();
    const fields = dto.fields.map((field): CustomField => {
      if (!field || typeof field !== 'object' || typeof field.label !== 'string' ||
          !field.label.trim() || field.label.length > 100 || !TYPES.includes(field.type) ||
          typeof field.public !== 'boolean' || typeof field.staff !== 'boolean' || typeof field.required !== 'boolean') {
        throw invalid();
      }
      const existing = current.fields.find(({ key }) => key === field.key);
      if (!['guest', 'member', 'outreach', 'child', 'family'].includes(kind) && field.public) throw invalid();
      if (field.key && (!existing || existing.type !== field.type || seen.has(field.key))) throw invalid();
      const key = existing?.key ?? 'custom_' + randomUUID().replace(/-/g, '');
      seen.add(key);
      const translations = Object.fromEntries(
        (['labelEs', 'labelFr', 'labelPt'] as const).flatMap((locale) => {
          const value = field[locale];
          if (value === undefined) return [];
          if (typeof value !== 'string' || value.length > 100) throw invalid();
          return value.trim() ? [[locale, value.trim()]] : [];
        }),
      );
      if (field.type === 'select' && (!Array.isArray(field.options) || field.options.length < 2 ||
          field.options.length > 20 || field.options.some((option) => typeof option !== 'string' || !option.trim() || option.length > 100))) {
        throw invalid();
      }
      const options = field.type === 'select' ? [...new Set(field.options.map((option) => option.trim()))] : [];
      if (field.type === 'select' && options.length < 2) throw invalid();
      if (field.guestFieldKey && !sources.some((source) => source.key === field.guestFieldKey && source.type === field.type)) throw invalid();
      return { key, label: field.label.trim(), ...translations, type: field.type,
        public: field.public, staff: field.staff, required: field.required, options,
        ...(field.guestFieldKey ? { guestFieldKey: field.guestFieldKey } : {}) };
    });
    const next = {
      revision: current.revision + 1,
      hiddenPublic: hidden(dto.hiddenPublic, defaults.public.map(({ key }) => key)),
      hiddenStaff: hidden(dto.hiddenStaff, defaults.staff),
      fields,
    };
    try {
      const saved = await this.definitions.updateOne(
        { _id: id, revision: current.revision }, { $set: next },
        { upsert: current.revision === 0 },
      );
      if (!saved.matchedCount && !saved.upsertedCount) throw new ConflictException('Form settings changed. Reload settings before publishing.');
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new ConflictException('Form settings changed. Reload settings before publishing.');
      throw error;
    }
    await this.audit.record({
      entityType: `${kind}_form_settings`, entityId: id, action: 'publish',
      summary: `Published ${kind} form settings`, actor, metadata: { branchId, before: current, after: next },
    });
    return this.overview(kind, branchId);
  }

  async staff(kind: FormKind, branchId?: string) {
    const { revision, hiddenStaff, fields } = await this.get(kind, branchId);
    return {
      revision, hiddenStaff,
      fields: fields.filter((field) => field.staff).map(({ guestFieldKey, ...field }) => field),
    };
  }

  async publicForm(kind: FormKind) {
    const { revision, hiddenPublic, fields } = await this.get(kind);
    return {
      revision, hiddenStaff: hiddenPublic,
      fields: fields.filter((field) => field.public).map(({ guestFieldKey, ...field }) => field),
    };
  }

  async prepare(kind: FormKind, input: { formRevision?: number; customFields?: Record<string, unknown> }, existing?: GuestAnswer[], surface: Surface = 'staff') {
    const definition = await this.get(kind);
    this.checkRevision(definition, input.formRevision);
    const hidden = surface === 'public' ? definition.hiddenPublic : definition.hiddenStaff;
    for (const key of hidden) delete (input as Record<string, unknown>)[key];
    if (existing && !input.customFields) return undefined;
    const active = new Set(definition.fields.filter((field) => field[surface]).map(({ key }) => key));
    return [
      ...(existing ?? []).filter(({ key }) => !active.has(key)),
      ...this.collect(definition, surface, {
        ...Object.fromEntries((existing ?? []).map(({ key, value }) => [key, value])),
        ...input.customFields,
      }),
    ];
  }

  mappedAnswers(definition: Definition, answers: GuestAnswer[] = []) {
    return Object.fromEntries(definition.fields.flatMap((field) => {
      const source = answers.find(({ key }) => key === field.guestFieldKey);
      if (!field.staff || !source || (field.type === 'select' && !field.options.includes(String(source.value)))) return [];
      return [[field.key, source.value]];
    }));
  }

  async assertPublicEnabled() {
    const settings = await this.settings.findOne({ scopeKey: 'global' }).select('publicConnectEnabled').lean();
    if (settings?.publicConnectEnabled === false) throw new NotFoundException('Public guest registration is unavailable.');
  }

  checkRevision(definition: Definition, revision?: number) {
    if (revision !== undefined && revision !== definition.revision) {
      throw new ConflictException('The form has changed. Refresh the page before submitting.');
    }
  }

  limitPublicSubmission(ip: string) {
    const now = Date.now();
    if (now >= this.resetsAt) {
      this.attempts.clear();
      this.total = 0;
      this.resetsAt = now + 60_000;
    }
    const attempts = this.attempts.get(ip) ?? 0;
    if (attempts >= 30 || this.total >= 300) throw new HttpException('Please try again in a minute.', 429);
    this.attempts.set(ip, attempts + 1);
    this.total += 1;
  }

  collect(definition: Definition, surface: Surface, answers: Record<string, unknown> = {}): GuestAnswer[] {
    const values: GuestAnswer[] = [];
    for (const field of definition.fields.filter((item) => item[surface])) {
      const raw = Object.hasOwn(answers, field.key) ? answers[field.key] : undefined;
      const value = typeof raw === 'string' ? raw.trim() : raw;
      if (value === undefined || value === '') {
        if (field.required) throw new BadRequestException(`${field.label} is required`);
        continue;
      }
      if (field.type === 'number' ? typeof value !== 'number' || !Number.isFinite(value) || value < 0 :
        typeof value !== 'string' || value.length > (field.type === 'textarea' ? 2000 : 250) ||
        (field.type === 'select' && !field.options.includes(value)) ||
        (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) ||
        (field.type === 'tel' && !/^\d{7,15}$/.test(value.replace(/\D/g, '')))) {
        throw new BadRequestException(`${field.label} has an invalid answer`);
      }
      values.push({ key: field.key, label: field.label, value: value as string | number });
    }
    return values;
  }
}
