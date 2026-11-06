import { BadRequestException } from '@nestjs/common';
export type CareEventFilters = {
  search?: string;
  kind?: string;
  dateFrom?: string;
  dateTo?: string;
};
export function careEventFilters(filters: CareEventFilters) {
  const query: Record<string, unknown> = {};
  if (typeof filters.search === 'string' && filters.search.trim()) {
    const term = filters.search
      .trim()
      .slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.text = { $regex: term, $options: 'i' };
  }
  if (typeof filters.kind === 'string' && filters.kind)
    query.kind = filters.kind.slice(0, 50);
  const range: Record<string, Date> = {};
  for (const [key, value] of [
    ['$gte', filters.dateFrom],
    ['$lte', filters.dateTo],
  ] as const) {
    if (!value) continue;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new BadRequestException('Choose a valid activity date.');
    const date = new Date(
      `${value}T${key === '$gte' ? '00:00:00.000' : '23:59:59.999'}Z`,
    );
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('Choose a valid activity date.');
    range[key] = date;
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte)
    throw new BadRequestException('The end date must follow the start date.');
  if (Object.keys(range).length) query.createdAt = range;
  return query;
}
