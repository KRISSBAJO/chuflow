import ExcelJS from 'exceljs';
import {
  collectExport,
  ExportError,
} from '../../../web/src/lib/exporting/data';
import { EXPORTS } from '../../../web/src/lib/exporting/catalog';
import {
  exportCsv,
  exportWorkbook,
} from '../../../web/src/lib/exporting/workbook';
import {
  formTextColor,
  validFormColor,
} from '../../../web/src/lib/form-colors';

describe('Table downloads', () => {
  it('exports all 1,000 filtered members instead of the current display page', async () => {
    const requests: string[] = [];
    const result = await collectExport(
      'members',
      new URLSearchParams({
        page: '7',
        pageSize: '25',
        status: 'active',
        search: 'Ada',
      }),
      (path) => {
        requests.push(path);
        const query = new URL('https://example.test' + path).searchParams;
        const page = Number(query.get('page'));
        return Promise.resolve({
          items: Array.from({ length: 100 }, (_, index) => ({
            _id: String((page - 1) * 100 + index),
            firstName: 'Ada',
          })),
          pagination: { page, total: 1000, totalPages: 10 },
        });
      },
    );
    expect(result.sheets[0].rows).toHaveLength(1000);
    expect(requests).toHaveLength(10);
    for (const path of requests) {
      expect(path).toContain('pageSize=100');
      expect(path).toContain('status=active');
      expect(path).toContain('search=Ada');
      expect(path).not.toContain('limit=');
    }
  });

  it('exports every matching array record after filtering, not just 25 display rows', async () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      _id: String(index).padStart(24, '0'),
      name: `Unit ${index}`,
      isActive: index % 2 === 0,
    }));
    const result = await collectExport(
      'service-units',
      new URLSearchParams({ page: '9', status: 'active' }),
      () => Promise.resolve(rows),
    );
    expect(result.sheets[0].rows).toHaveLength(500);
  });

  it('fails clearly if the result changes during export instead of returning incomplete data', async () => {
    let request = 0;
    await expect(
      collectExport('guests', new URLSearchParams(), () => {
        request++;
        return Promise.resolve({
          items: [{ _id: String(request) }],
          pagination: { total: request === 1 ? 2 : 3, totalPages: 2 },
        });
      }),
    ).rejects.toThrow('changed during export');
  });

  it('does not create a download after the source denies access', async () => {
    await expect(
      collectExport('members', new URLSearchParams(), () =>
        Promise.reject(new ExportError('Forbidden', 403)),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('does not silently truncate exports that exceed the supported size', async () => {
    await expect(
      collectExport('members', new URLSearchParams(), () =>
        Promise.resolve({
          items: [],
          pagination: { total: 100001, totalPages: 1001 },
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('writes genuine Excel files with safe text, numbers, dates and filterable headers', async () => {
    const buffer = await exportWorkbook([
      {
        title: 'Offerings',
        columns: EXPORTS.offerings.columns,
        rows: [
          {
            serviceDate: '2026-11-04T12:30:00Z',
            amount: 123.45,
            currency: 'USD',
            notes: '=HYPERLINK("bad")',
            password: 'never-export-this',
          },
        ],
      },
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet('Offerings')!;
    expect(sheet.getCell('A2').value).toBeInstanceOf(Date);
    expect(sheet.getCell('G2').value).toBe(123.45);
    expect(sheet.getCell('I2').value).toBe('=HYPERLINK("bad")');
    expect(sheet.autoFilter).toBeDefined();
    expect(JSON.stringify(sheet.getSheetValues())).not.toContain(
      'never-export-this',
    );
  });

  it('neutralizes CSV formulas while preserving negative numeric values and Unicode', () => {
    const csv = exportCsv({
      title: 'Test',
      columns: [
        { header: 'Name', value: (row) => String(row.name) },
        { header: 'Amount', value: () => -42 },
      ],
      rows: [{ name: '=1+1' }, { name: 'José, Ada' }, { name: '+16155550123' }],
    });
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+16155550123");
    expect(csv).toContain('"-42"');
    expect(csv).toContain('José, Ada');
  });

  it('keeps defaults optional and selects readable text for custom colors', () => {
    expect(validFormColor(undefined)).toBeUndefined();
    expect(validFormColor('url(bad)')).toBeUndefined();
    expect(formTextColor('#000000')).toBe('#ffffff');
    expect(formTextColor('#ffffff')).toBe('#000000');
  });
});
