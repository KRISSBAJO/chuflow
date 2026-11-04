import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CaptureOutreachDto,
  OutreachListQueryDto,
  UpdateOutreachDto,
} from './evangelism.dto';

describe('Evangelism request boundaries', () => {
  const capture = {
    firstName: 'Ada',
    lastName: 'Okoro',
    phone: '+16155550123',
    preferredContactMethod: 'phone_call',
    consentToContact: true,
  };
  const options = { whitelist: true, forbidNonWhitelisted: true };
  it('accepts the public form without internal branch or assignment fields', async () => {
    expect(
      await validate(plainToInstance(CaptureOutreachDto, capture), options),
    ).toHaveLength(0);
  });
  it('rejects public attempts to override branch, link ownership, or workflow stage', async () => {
    const errors = await validate(
      plainToInstance(CaptureOutreachDto, {
        ...capture,
        branchId: 'other',
        assignedTo: 'attacker',
        stage: 'visited',
      }),
      options,
    );
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['branchId', 'assignedTo', 'stage']),
    );
  });
  it('rejects object values and invalid queue filters', async () => {
    const errors = await validate(
      plainToInstance(OutreachListQueryDto, {
        search: { $ne: '' },
        queue: 'anything',
        page: '-2',
      }),
      options,
    );
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['search', 'queue', 'page']),
    );
  });
  it('bounds private notes and rejects unsupported progress states', async () => {
    const errors = await validate(
      plainToInstance(UpdateOutreachDto, {
        note: 'a'.repeat(2001),
        stage: 'member_automatically',
        contactMethod: 'phone_call',
      }),
      options,
    );
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['note', 'stage']),
    );
  });
});
