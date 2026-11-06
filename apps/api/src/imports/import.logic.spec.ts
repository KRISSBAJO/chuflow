import {
  checkValues,
  identityKeys,
  importCsvCell,
  importDate,
  normalizeImport,
  recordId,
  rowHash,
} from './import.logic';
const names = { firstName: ' Test ', lastName: 'Person' };
const groups = new Map([
  ['ushering', '507f1f77bcf86cd799439011'],
  ['media', '507f1f77bcf86cd799439012'],
]);
describe('Spreadsheet migration rules', () => {
  it('rejects privilege, scope and record-id injection', () => {
    for (const key of ['branchId', 'role', '_id', 'importBatchId', '__proto__'])
      expect(() =>
        checkValues('members', Object.fromEntries([[key, 'x']])),
      ).toThrow();
  });
  it('requires valid names and guest phone, without requiring member contact details', () => {
    expect(() => normalizeImport('guests', names, 'iso', groups)).toThrow(
      'phone',
    );
    expect(normalizeImport('members', names, 'iso', groups)).toMatchObject({
      firstName: 'Test',
      lastName: 'Person',
      membershipStatus: 'active',
    });
  });
  it('preserves text phone numbers and rejects scientific notation', () => {
    expect(
      normalizeImport(
        'guests',
        { ...names, phone: '00123456789' },
        'iso',
        groups,
      ).phone,
    ).toBe('00123456789');
    expect(() =>
      normalizeImport('guests', { ...names, phone: '1.23E+11' }, 'iso', groups),
    ).toThrow();
  });
  it('does not manufacture attendance or consent for migrated guests', () => {
    const row = normalizeImport(
      'guests',
      { ...names, phone: '1234567890' },
      'iso',
      groups,
    );
    expect(row).not.toHaveProperty('visitDate');
    expect(row.wantsPastoralCall).toBe(false);
  });
  it('validates leap days and explicit date formats', () => {
    expect(importDate('29/02/2024', 'dmy')).toBe('2024-02-29');
    expect(importDate('02/03/2024', 'mdy')).toBe('2024-02-03');
    for (const date of ['2023-02-29', '2024-13-01', '2099-01-01', '01/02/2024'])
      expect(() => importDate(date, 'iso')).toThrow();
  });
  it('links multiple existing groups once and rejects unknown groups', () => {
    const row = normalizeImport(
      'members',
      { ...names, serviceGroups: 'Ushering;Media;ushering' },
      'iso',
      groups,
    );
    expect(row.serviceUnitIds).toHaveLength(2);
    expect(() =>
      normalizeImport(
        'members',
        { ...names, serviceGroups: 'Unknown' },
        'iso',
        groups,
      ),
    ).toThrow('Unknown');
  });
  it('matches normalized contacts without merging unrelated people by name', () => {
    expect(
      identityKeys(
        { email: ' TEST@EXAMPLE.COM ', phone: '+1 (615) 555-0100' },
        'members',
      ),
    ).toEqual([
      'email:test@example.com',
      'phone:16155550100',
      'phone:6155550100',
    ]);
    expect(
      identityKeys({ ...names, email: 'a@example.com' }, 'members'),
    ).not.toContain('name:test person');
  });
  it('creates stable retry identities and detects changed uploads', () => {
    expect(String(recordId('batch', 1))).toBe(String(recordId('batch', 1)));
    expect(String(recordId('batch', 2))).not.toBe(String(recordId('batch', 1)));
    expect(rowHash(2, { a: 'x', b: 'y' })).toBe(rowHash(2, { b: 'y', a: 'x' }));
    expect(rowHash(2, { a: 'x' })).not.toBe(rowHash(3, { a: 'x' }));
  });
  it('escapes formulas and quotes in downloaded results', () => {
    expect(importCsvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(importCsvCell('normal')).toBe('"normal"');
  });
});
