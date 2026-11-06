import { BadRequestException } from '@nestjs/common';
import { careEventFilters } from './event-filters';
describe('care activity history filters', () => {
  it('escapes search text so special characters are literal', () => {
    expect(careEventFilters({ search: 'prayer (family).*' })).toEqual({
      text: { $regex: 'prayer \\(family\\)\\.\\*', $options: 'i' },
    });
  });
  it('includes the whole end day', () => {
    const result = careEventFilters({
      dateFrom: '2026-11-01',
      dateTo: '2026-11-05',
      kind: 'contact',
    });
    expect(result).toEqual({
      kind: 'contact',
      createdAt: {
        $gte: new Date('2026-11-01T00:00:00Z'),
        $lte: new Date('2026-11-05T23:59:59.999Z'),
      },
    });
  });
  it.each([
    { dateFrom: '2026-02-30' },
    { dateTo: 'garbage' },
    { dateFrom: '2026-11-05', dateTo: '2026-11-01' },
  ])('rejects invalid date filters %j', (filters) => {
    expect(() => careEventFilters(filters)).toThrow(BadRequestException);
  });
  it('does not introduce visibility or case filters from user input', () => {
    expect(careEventFilters({ search: '', kind: '' })).toEqual({});
  });
});
