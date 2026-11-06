import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IMPORT_FIELDS, importCsvCell } from './import.logic';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LEADERSHIP_ROLES } from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ImportService } from './import.service';
import { StartImportDto, UploadImportDto, CommitImportDto } from './import.dto';
@Controller('imports')
@Roles(...LEADERSHIP_ROLES)
export class ImportController {
  constructor(private readonly service: ImportService) {}
  @Get('options') options(@CurrentUser() u: AuthUser) {
    return this.service.options(u);
  }
  @Get() list(@CurrentUser() u: AuthUser) {
    return this.service.list(u);
  }
  @Post() start(@CurrentUser() u: AuthUser, @Body() d: StartImportDto) {
    return this.service.start(u, d);
  }
  @Get(':id') detail(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('status') status?: string,
  ) {
    return this.service.detail(u, id, page, status);
  }
  @Get(':id/results.csv') async results(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.service.resultRows(u, id);
    const fields = IMPORT_FIELDS[result.kind];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="chuflow-${result.kind}-import-results.csv"`,
    );
    res.write(
      '\uFEFF' +
        ['Source row', 'Result', 'Reason', ...fields]
          .map(importCsvCell)
          .join(',') +
        '\r\n',
    );
    try {
      for await (const row of result.rows) {
        if (res.destroyed) break;
        const line =
          [
            row.sourceRow,
            row.status,
            row.reason,
            ...fields.map((f) => row.values[f] || ''),
          ]
            .map(importCsvCell)
            .join(',') + '\r\n';
        if (!res.write(line))
          await new Promise<void>((resolve) => {
            const done = () => {
              res.off('drain', done);
              res.off('close', done);
              resolve();
            };
            res.once('drain', done);
            res.once('close', done);
          });
      }
      res.end();
    } catch (error) {
      res.destroy(error instanceof Error ? error : undefined);
    } finally {
      await result.rows.close();
    }
  }
  @Post(':id/rows') upload(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: UploadImportDto,
  ) {
    return this.service.upload(u, id, d);
  }
  @Post(':id/validate') validate(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.validate(u, id);
  }
  @Post(':id/commit') commit(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: CommitImportDto,
  ) {
    return this.service.commit(u, id, d);
  }
  @Post(':id/step') step(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.step(u, id);
  }
}
