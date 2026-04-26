import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateExpenseCategoryDto, UpdateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { CreateExpenseEntryDto, ReviewExpenseEntryDto, UpdateExpenseEntryDto } from './dto/create-expense-entry.dto';
import { CreateFinanceAccountDto, UpdateFinanceAccountDto } from './dto/create-finance-account.dto';
import { CreateFinanceLockDto } from './dto/create-finance-lock.dto';
import { CreateOfferingEntryDto, UpdateOfferingEntryDto } from './dto/create-offering-entry.dto';
import { CreateOfferingTypeDto, UpdateOfferingTypeDto } from './dto/create-offering-type.dto';
import { FinanceService } from './finance.service';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('accounts')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
    'usher',
  )
  listAccounts(@CurrentUser() user: AuthUser) {
    return this.financeService.listFinanceAccounts(user);
  }

  @Post('accounts')
  @Roles('super_admin')
  createAccount(@CurrentUser() user: AuthUser, @Body() dto: CreateFinanceAccountDto) {
    return this.financeService.createFinanceAccount(dto, user);
  }

  @Patch('accounts/:id')
  @Roles('super_admin')
  updateAccount(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateFinanceAccountDto,
  ) {
    return this.financeService.updateFinanceAccount(id, dto, user);
  }

  @Get('expense-categories')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
    'usher',
  )
  listExpenseCategories(@CurrentUser() user: AuthUser) {
    return this.financeService.listExpenseCategories(user);
  }

  @Post('expense-categories')
  @Roles('super_admin')
  createExpenseCategory(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseCategoryDto) {
    return this.financeService.createExpenseCategory(dto, user);
  }

  @Patch('expense-categories/:id')
  @Roles('super_admin')
  updateExpenseCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.financeService.updateExpenseCategory(id, dto, user);
  }

  @Get('offering-types')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
    'usher',
  )
  listOfferingTypes(@CurrentUser() user: AuthUser) {
    return this.financeService.listOfferingTypes(user);
  }

  @Post('offering-types')
  @Roles('super_admin')
  createOfferingType(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOfferingTypeDto,
  ) {
    return this.financeService.createOfferingType(dto, user);
  }

  @Patch('offering-types/:id')
  @Roles('super_admin')
  updateOfferingType(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOfferingTypeDto,
  ) {
    return this.financeService.updateOfferingType(id, dto, user);
  }

  @Get('offerings')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
    'usher',
  )
  listOfferings(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('oversightRegion') oversightRegion?: string,
    @Query('district') district?: string,
    @Query('offeringTypeId') offeringTypeId?: string,
    @Query('accountId') accountId?: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.financeService.listOfferingEntries(user, {
      branchId,
      oversightRegion,
      district,
      offeringTypeId,
      accountId,
      search,
      date,
      dateFrom,
      dateTo,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('expenses')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
    'usher',
  )
  listExpenses(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('oversightRegion') oversightRegion?: string,
    @Query('district') district?: string,
    @Query('expenseCategoryId') expenseCategoryId?: string,
    @Query('accountId') accountId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.financeService.listExpenseEntries(user, {
      branchId,
      oversightRegion,
      district,
      expenseCategoryId,
      accountId,
      status,
      search,
      dateFrom,
      dateTo,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('expenses/:id')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
    'usher',
  )
  findExpense(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.financeService.findExpenseEntry(id, user);
  }

  @Post('expenses')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
  )
  createExpense(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseEntryDto) {
    return this.financeService.createExpenseEntry(dto, user);
  }

  @Patch('expenses/:id')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
  )
  updateExpense(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseEntryDto,
  ) {
    return this.financeService.updateExpenseEntry(id, dto, user);
  }

  @Patch('expenses/:id/approve')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
  )
  approveExpense(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewExpenseEntryDto,
  ) {
    return this.financeService.approveExpenseEntry(id, dto, user);
  }

  @Patch('expenses/:id/reject')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
  )
  rejectExpense(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewExpenseEntryDto,
  ) {
    return this.financeService.rejectExpenseEntry(id, dto, user);
  }

  @Get('ledger')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
    'usher',
  )
  listLedger(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('oversightRegion') oversightRegion?: string,
    @Query('district') district?: string,
    @Query('accountId') accountId?: string,
    @Query('sourceType') sourceType?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.financeService.listLedger(user, {
      branchId,
      oversightRegion,
      district,
      accountId,
      sourceType,
      status,
      search,
      dateFrom,
      dateTo,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('locks')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
  )
  listLocks(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('oversightRegion') oversightRegion?: string,
    @Query('district') district?: string,
  ) {
    return this.financeService.listFinanceLocks(user, { branchId, oversightRegion, district });
  }

  @Post('locks')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
  )
  createLock(@CurrentUser() user: AuthUser, @Body() dto: CreateFinanceLockDto) {
    return this.financeService.createFinanceLock(dto, user);
  }

  @Delete('locks/:id')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
  )
  removeLock(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.financeService.removeFinanceLock(id, user);
  }

  @Get('offerings/:id')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
    'usher',
  )
  findOffering(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.financeService.findOfferingEntry(id, user);
  }

  @Post('offerings')
  @Roles('resident_pastor', 'associate_pastor', 'usher')
  createOffering(@CurrentUser() user: AuthUser, @Body() dto: CreateOfferingEntryDto) {
    return this.financeService.createOfferingEntry(dto, user);
  }

  @Patch('offerings/:id')
  @Roles(
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
    'associate_pastor',
    'usher',
  )
  updateOffering(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOfferingEntryDto,
  ) {
    return this.financeService.updateOfferingEntry(id, dto, user);
  }
}
