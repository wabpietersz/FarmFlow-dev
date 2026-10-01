# Attendance & Payroll Module - Comprehensive Improvement Plan

## Progress Tracking

### Sprint AP-A: Leave Type Tracking & Bulk Leave Balances ✅ COMPLETED
**Completed**: 2026-02-14

**Delivered**:
- Attendance `leave_type` support end-to-end (schema, validators, CRUD logic, UI, shared types).
- Decimal precision for leave balances and payroll `attended_days` (half-day handling now preserved).
- Bulk leave balance setup endpoint + frontend bulk dialog.
- Grouped leave balance view by employee.
- Attendance + leave-balance tests updated with AP-A validation and bulk coverage.

### Sprint AP-B: Employee Compensation & Smart Payroll Generation ✅ COMPLETED
**Completed**: 2026-02-14

**Delivered**:
- `employee_compensation` table added.
- Shared types added: `PayType`, `EmployeeCompensation`, `UpsertCompensationRequest`.
- Backend:
  - `GET /employees/:id` now includes `compensation`.
  - `PUT /employees/:id/compensation` upsert endpoint.
  - `DELETE /employees/:id/compensation` endpoint.
  - Payroll generation now auto-fills `baseSalary` and `overtimeRate` from compensation profiles.
  - Payroll generation now keeps decimal `attendedDays` and returns `meta.employeesWithoutCompensation`.
- Frontend:
  - Compensation form schema + hooks.
  - Compensation card/dialog on Employee Detail.
  - Compensation section on Edit Employee.
  - Payroll generate dialog updated with compensation awareness and missing-profile warning.
- Tests added for compensation CRUD and payroll compensation calculations.

### Sprint AP-C: Allowance/Deduction Templates ✅ COMPLETED
**Completed**: 2026-02-14

**Delivered**:
- `compensation_templates` table added.
- Backend template CRUD routes added:
  - `GET /api/compensation-templates`
  - `POST /api/compensation-templates`
  - `PUT /api/compensation-templates/:id`
  - `DELETE /api/compensation-templates/:id` (soft delete)
- Frontend:
  - Template hooks in payroll data layer.
  - Template-aware Add Deduction / Add Allowance dialogs (auto-fill type + default amount).
  - Template management dialog in Payroll Detail (create + deactivate).
- New backend test suite: `compensation-templates.test.ts`.

### Sprint AP-D: Compensation Save Reliability & Diagnostics ✅ COMPLETED
**Target start**: 2026-02-15

**Update (2026-02-14)**:
- AP-D0 implemented: compensation save hotfix for `PUT /employees/:id/compensation`.
- AP-D1 implemented: backend error mapping now returns actionable `COMPENSATION_SCHEMA_NOT_READY` for missing `employee_compensation` schema and maps DB constraint failures to 400.
- AP-D2 implemented: health/readiness checks now validate DB connectivity + required HR/payroll tables and deployment doc includes readiness verification step.
- AP-D3 implemented: frontend compensation forms now surface API error details inline and through parsed toasts.
- AP-D4 implemented: backend and frontend reliability tests added for compensation error handling paths.

**Driver**:
- Compensation save currently returns `500 Failed to save compensation` from `PUT /api/employees/:id/compensation` while Employee Detail still loads.
- This pattern strongly indicates schema/version drift handling gaps (for example, missing `employee_compensation` table migration in runtime DB) and poor API error surfacing.

**Planned outcomes**:
- Save failure is diagnosed with explicit root-cause messages (no generic 500 for known cases).
- Compensation upsert endpoint handles migration drift gracefully and reports actionable remediation.
- Frontend surfaces backend error details clearly in toast and form error state.
- Add a startup/runtime DB readiness check for required HR/payroll tables and schema version.

### Sprint AP-E: Compensation Model Expansion ⏳ PLANNED
**Target start**: 2026-02-17

**Planned outcomes**:
- Move from single flat compensation record to versioned compensation profiles with effective-date history.
- Add recurring earning/deduction components at employee level (not only payroll-record level).
- Expand compensation form UX to capture policy-level details (pay schedule, standard hours/day, overtime policy, notes by revision).
- Add compensation timeline/audit view in employee profile.

### Sprint AP-F: Payroll Engine Alignment with Expanded Compensation ⏳ PLANNED
**Target start**: 2026-02-20

**Planned outcomes**:
- Payroll generation selects the compensation revision effective for the pay period.
- Generated payroll stores a compensation snapshot + component breakdown for auditability.
- Add pre-generation validation report (missing profile, overlapping revisions, invalid component config).
- Improve payroll review UX with reasoned warnings and traceability from payroll line back to compensation revision.

### Sprint AP-G: Payroll Creation UX + Editable Bulk Generation ✅ COMPLETED
**Completed**: 2026-02-14

**Delivered**:
- Backend payroll preview endpoint added: `POST /api/payroll/preview`.
  - Inputs: `payPeriod`, optional `employeeId`.
  - Output: employee-level draft rows with compensation auto-fill, attendance-derived days, recurring allowance/deduction defaults, warnings, and gross/net preview totals.
- Backend `POST /api/payroll` expanded:
  - Supports editable row payload (`attendedDays`, `allowances[]`, `deductions[]`, `notes`, `compensationRevisionId`) to match dialog behavior.
  - Retains attendance-derived fallback values when optional fields are omitted.
- Backend `POST /api/payroll/generate` expanded:
  - Supports selected editable entries (`entries[]`) for true bulk table generation.
  - Keeps legacy path (`payPeriod + workingDays`) for compatibility.
  - Missing compensation is warning-first so records can still be generated with manual values.
- Backend payroll list (`GET /api/payroll`) enhanced:
  - Supports period filtering via `payPeriodMonth=YYYY-MM`.
  - Returns `totalAllowances` and `totalDeductions` aggregates for list view.
- Frontend Payroll page redesigned:
  - Bulk Generate dialog now uses an editable employee table (selection checkbox, base salary, working days, overtime hours/rate, allowances include/exclude, notes, live gross/net).
  - Single Create dialog now follows the same defaults + editable behavior as bulk generate.
  - Payroll list includes period filter and richer per-row payroll details.
- Frontend Payroll detail expanded with a dedicated breakdown card (prorated base, attendance, overtime, allowance/deduction totals).
- Shared HR/payroll request types and validation schemas updated to reflect new payload shapes.

### Verification ✅
- `npm run build --workspace=packages/shared` passed.
- `npm run build --workspace=packages/backend` passed.
- `npm run build --workspace=packages/frontend` passed.
- `npm test --workspace=packages/backend` passed (`262` tests).
- Drizzle migration generated:
  - `0006_soft_wraith.sql` (AP-A)
  - `0007_parallel_the_professor.sql` (AP-B + AP-C tables)

### Note
- AP-B and AP-C schema changes were generated together in `0007_parallel_the_professor.sql` to keep schema and snapshots consistent with the current codebase state.

---

## Context
The FarmFlow attendance and payroll modules have several critical gaps that reduce usability and data integrity:
1. **Leave type tracking bug**: When marking attendance as `on_leave`, the system always deducts from casual leave balance (hardcoded in `adjustLeaveBalance()` at `attendance.ts:34`). There's no way to specify which leave type is being taken.
2. **No bulk leave balance setup**: Admins must set leave balances one employee + one type at a time. No way to allocate annual leave for all employees at once.
3. **Flat leave balance view**: Leave balances display as a flat table — hard to see one employee's complete leave picture.
4. **No employee compensation rates**: `baseSalary` is entered per payroll period. When batch generating, it's set to 0.00 (`payroll.ts:412`), requiring manual entry for every employee every month.
5. **Half-day precision loss**: `attendedDays` is stored as integer in payroll, but half-days produce fractional values. `Math.round()` at `payroll.ts:414` loses precision. `usedDays`/`totalDays` on leave balances are also integer, blocking 0.5 increments.

This plan addresses all 5 issues in 3 focused sprints.

---

## Sprint AP-A: Leave Type Tracking & Bulk Leave Balances

**Goal**: Fix leave balance deduction to use the correct leave type. Add bulk leave balance setup. Improve leave balance view with employee grouping. Support half-day leave with decimal precision.

### Database Changes (Migration 0006)
1. Add `leave_type` column to attendance table (nullable — existing records stay valid):
   ```sql
   ALTER TABLE "attendance" ADD COLUMN "leave_type" varchar(50);
   ```
2. Change `leave_balances` columns from integer to decimal (backward-compatible):
   ```sql
   ALTER TABLE "leave_balances" ALTER COLUMN "total_days" TYPE numeric(6, 1);
   ALTER TABLE "leave_balances" ALTER COLUMN "used_days" TYPE numeric(6, 1);
   ```
3. Change `payroll.attended_days` from integer to decimal (fixes rounding loss):
   ```sql
   ALTER TABLE "payroll" ALTER COLUMN "attended_days" TYPE numeric(6, 1);
   ```

**Schema file**: `packages/backend/src/db/schema/attendance.ts`
* Add: `leaveType: varchar('leave_type', { length: 50 })`
* Change: `totalDays: decimal('total_days', { precision: 6, scale: 1 }).notNull()`
* Change: `usedDays: decimal('used_days', { precision: 6, scale: 1 }).default('0').notNull()`

**Schema file**: `packages/backend/src/db/schema/payroll.ts`
* Change: `attendedDays: decimal('attended_days', { precision: 6, scale: 1 }).notNull()`

### Shared Type Changes
**File**: `packages/shared/src/types/hr.ts`
* Add `leaveType?: LeaveType | null` to `Attendance` interface
* Add `leaveType?: LeaveType` to `CreateAttendanceRequest`
* Add `leaveType?: LeaveType` to each record in `BulkAttendanceRequest`
* Add new interface:
  ```typescript
  export interface BulkSetLeaveBalanceRequest {
    year: number;
    balances: Array<{
      employeeId: number;
      leaveType: LeaveType;
      totalDays: number;
    }>;
  }
  ```

### Backend Validator Changes
**File**: `packages/backend/src/validators/attendance.ts`
* Add `leaveType` field to `createAttendanceSchema` with `.refine()` — required when status is `on_leave` or `half_day`
* Same for `bulkAttendanceSchema` per-record
* Add `leaveType` to `updateAttendanceSchema`
* Change `totalDays` in `setLeaveBalanceSchema` to allow decimals (remove `.int()`)
* Add new `bulkSetLeaveBalanceSchema`

### Backend Route Changes
**File**: `packages/backend/src/routes/attendance.ts`
* Fix `adjustLeaveBalance()` (lines 19-46): Add `leaveType: string` parameter, use it in the query instead of hardcoded 'casual'. Support fractional delta (0.5 for half-days).
* `POST /attendance`: Store `leaveType` in insert. Pass it to `adjustLeaveBalance`. Delta = 0.5 for `half_day`, 1 for `on_leave`.
* `POST /attendance/bulk`: Same — store `leaveType` per record, pass to `adjustLeaveBalance`.
* `PUT /attendance/:id`: Handle leave type changes. When old status was leave, rollback old balance; when new status is leave, deduct from new balance.
* `DELETE /attendance/:id`: Read `leaveType` from existing record to rollback correct balance.
* `GET /attendance`: Include `leaveType` in select and response.

**File**: `packages/backend/src/routes/leave-balances.ts`
* Add `POST /leave-balances/bulk`: Accept array of `{employeeId, leaveType, totalDays} + year`. Upsert each in a transaction. Return created/updated counts.
* Update `GET /leave-balances`: Order by `employees.firstName`, `employees.lastName`, `leaveBalances.leaveType` for consistent grouping.

**File**: `packages/backend/src/routes/payroll.ts`
* Update generate endpoint (line 414): Remove `Math.round()` — store decimal `attendedDays` directly.
* Update individual create endpoint: Same — don't round `attendedDays`.

### Frontend Changes
**File**: `packages/frontend/src/lib/validations/attendance.ts`
* Add `leaveType` to `attendanceFormSchema` with conditional `.refine()`
* Allow decimal `totalDays` in `leaveBalanceFormSchema`
* Add `bulkLeaveBalanceFormSchema`

**File**: `packages/frontend/src/hooks/useAttendance.ts`
* Update mutation types to include `leaveType`
* Add `useBulkSetLeaveBalance()` hook → `POST /leave-balances/bulk`

**File**: `packages/frontend/src/pages/AttendancePage.tsx`
1. **Attendance tab — Record dialog**: Add conditional leaveType select (appears when status is `on_leave` or `half_day`). Use `form.watch('status')` to toggle visibility.
2. **Attendance tab — Table**: Add "Leave Type" column showing the type when applicable.
3. **Leave Balances tab — Grouped view**: Group `leaveBalancesList` by employeeId. Render employee name as a spanning header row, individual leave type rows beneath (Total, Used, Balance columns). Use `useMemo` for grouping.
4. **Leave Balances tab — Bulk Set Balance dialog**: Multi-select employees (checkboxes), leave type dropdown, total days input, year input. Submits to bulk endpoint.

### Test Changes
**File**: `packages/backend/src/__tests__/attendance.test.ts`
* Update existing `on_leave` tests to include `leaveType`
* Add: `on_leave` + `leaveType='medical'` deducts from medical balance (not casual)
* Add: `half_day` + `leaveType='casual'` deducts 0.5
* Add: bulk attendance with mixed leave types
* Add: update from `on_leave` to present restores correct balance
* Add: `POST /leave-balances/bulk` creates/updates multiple
* Add: bulk validation errors

---

## Sprint AP-B: Employee Compensation & Smart Payroll Generation

**Goal**: Store compensation rates (monthly/daily/hourly) on employees. Auto-populate `baseSalary` and `overtimeRate` when generating payroll.

### Database Changes (Migration 0007)
New table: `employee_compensation` (follows bankDetails pattern — one-to-one with cascade delete)
```sql
CREATE TABLE employee_compensation (
  id              serial PK,
  employee_id     integer FK→employees.id UNIQUE CASCADE NOT NULL,
  pay_type        varchar(20) NOT NULL, -- 'monthly', 'daily', 'hourly'
  base_rate       decimal(12,2) NOT NULL,
  overtime_rate   decimal(10,2) DEFAULT '0',
  effective_from  date NOT NULL,
  notes           text,
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);
```

**Schema file**: `packages/backend/src/db/schema/employees.ts` — add `employeeCompensation` table definition.
**Schema index file**: `packages/backend/src/db/schema/index.ts` — export new table.

### Shared Type Changes
**File**: `packages/shared/src/types/employee.ts`
* Add `PayType` enum: `Monthly = 'monthly'`, `Daily = 'daily'`, `Hourly = 'hourly'`
* Add `EmployeeCompensation` interface
* Add `UpsertCompensationRequest` interface

### Backend Changes
**File**: `packages/backend/src/validators/employee.ts`
* Add `upsertCompensationSchema`: payType enum, baseRate positive, overtimeRate >= 0, effectiveFrom date, notes optional

**File**: `packages/backend/src/routes/employees.ts`
* `GET /employees/:id`: Include compensation in detail response (same pattern as emergencyContacts and bankDetails)
* `PUT /employees/:id/compensation`: Upsert compensation record
* `DELETE /employees/:id/compensation`: Delete compensation record

**File**: `packages/backend/src/routes/payroll.ts`
* Update `POST /payroll/generate` (lines 374-423): For each employee, look up compensation. Calculate `baseSalary` based on `payType`:
   * monthly → baseSalary = baseRate
   * daily → baseSalary = baseRate * workingDays
   * hourly → baseSalary = baseRate * workingDays * 8 (standard 8h day)
   * No compensation → baseSalary = 0 (backward-compatible)
* Set `overtimeRate` from compensation record
* Calculate `proRatedBase` and `grossSalary` properly before insert

### Frontend Changes
**File**: `packages/frontend/src/lib/validations/employee.ts`
* Add `compensationFormSchema`

**File**: `packages/frontend/src/hooks/useEmployees.ts`
* Add `useUpsertCompensation(employeeId)` hook
* Add `useDeleteCompensation(employeeId)` hook

**File**: `packages/frontend/src/pages/EmployeeDetailPage.tsx`
* Add **Compensation card** (below Bank Details, same visual pattern):
   * Shows: Pay Type badge, Base Rate, Overtime Rate, Effective From
   * Add/Edit button → opens form dialog
   * Delete button to remove

**File**: `packages/frontend/src/pages/EditEmployeePage.tsx`
* Add compensation section to the edit form (pay type, base rate, OT rate, effective date)

**File**: `packages/frontend/src/pages/PayrollPage.tsx`
* Update "Generate Payroll" dialog description to note rates are pulled from employee compensation profiles
* Show info message if some employees lack compensation setup

### Test Changes
**File**: `packages/backend/src/__tests__/employees.test.ts`
* Add: `PUT compensation` creates record
* Add: `PUT compensation` upserts existing
* Add: `GET detail` includes compensation
* Add: `DELETE compensation` removes record

**File**: `packages/backend/src/__tests__/payroll.test.ts`
* Add: generate payroll with monthly compensation → correct baseSalary
* Add: generate with daily compensation → baseSalary = rate * workingDays
* Add: generate with hourly compensation → baseSalary = rate * workingDays * 8
* Add: generate without compensation → baseSalary = 0 (backward-compatible)
* Add: generate populates `overtimeRate` from compensation

---

## Sprint AP-C: Allowance/Deduction Templates

**Goal**: Add reusable allowance/deduction templates so users don't type free-text each time. Templates provide suggestions with default amounts.

### Database Changes (Migration 0008)
New table: `compensation_templates`
```sql
CREATE TABLE compensation_templates (
  id              serial PK,
  name            varchar(100) NOT NULL,
  category        varchar(20) NOT NULL, -- 'allowance' or 'deduction'
  default_amount  decimal(12,2),
  description     text,
  is_active       boolean DEFAULT true,
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);
```

### Backend Changes
**New file**: `packages/backend/src/routes/compensation-templates.ts`
* `GET /api/compensation-templates` — list (filter by category, active)
* `POST /api/compensation-templates` — create
* `PUT /api/compensation-templates/:id` — update
* `DELETE /api/compensation-templates/:id` — soft-delete (isActive = false)

**New file**: `packages/backend/src/validators/compensation-template.ts`
Register in main app router.

### Frontend Changes
**File**: `packages/frontend/src/hooks/usePayroll.ts`
* Add `useCompensationTemplates(category?)` hook

**File**: `packages/frontend/src/pages/PayrollDetailPage.tsx`
* Update "Add Deduction" and "Add Allowance" dialogs:
   * Add a combobox/dropdown that lists templates as suggestions
   * Selecting a template auto-fills type name + default amount
   * User can still type custom values (free-text remains supported)

**Template management UI**: Add to System Config page as a new tab, or as a sub-section within the Payroll page.

### Test Changes
* Template CRUD tests (4-5 tests)
* Verify templates used as suggestions don't break existing payroll tests

---

## AP-D/AP-E/AP-F Addendum (Compensation + Payroll Expansion)

### Problem Statement (Current)
1. **Compensation save instability**: `PUT /api/employees/:id/compensation` returns generic 500 ("Failed to save compensation"), making root cause opaque for users and support.
2. **Compensation model is too flat**: one row (`employee_compensation`) cannot express revision history, future-dated changes, or multiple recurring pay components.
3. **Payroll generation is not effective-date aware**: current logic joins one compensation row without selecting by period-effective revision.
4. **UI is minimal/vague for real payroll policy**: current modal captures pay type/rates only and lacks context, validation guidance, and history.

### Scope
- Stabilize compensation save flow first (production blocker).
- Expand compensation domain model to support realistic payroll operations.
- Align payroll generation, review, and audit trails to the expanded model.

### Out of Scope
- Tax engine and statutory filing automation.
- Bank transfer disbursement integrations.
- Multi-currency settlement and FX conversion.

---

## Sprint AP-D: Compensation Save Reliability & Diagnostics

**Goal**: Make compensation save dependable and diagnosable.

### Backend Changes
**Files**:
- `packages/backend/src/routes/employees.ts`
- `packages/backend/src/lib/logger.ts`
- `packages/backend/src/routes/health.ts` (or equivalent health route)

**Work items**:
1. Add explicit DB error mapping in compensation upsert:
   - Missing table (`42P01`) -> 503/500 with actionable message: "Compensation schema is not migrated. Run DB migrations."
   - Constraint/invalid payload errors -> 400 with field-level details where possible.
2. Add structured log context for compensation upsert failures:
   - `employeeId`, `userId`, `payType`, `effectiveFrom`, DB error code.
3. Add HR/payroll schema readiness check endpoint or extend health response:
   - Validate required tables: `employee_compensation`, `payroll`, `payroll_deductions`, `payroll_allowances`, `compensation_templates`.
4. Add migration-readiness check to deployment runbook/startup verification.

### Frontend Changes
**Files**:
- `packages/frontend/src/pages/EmployeeDetailPage.tsx`
- `packages/frontend/src/pages/EditEmployeePage.tsx`
- `packages/frontend/src/lib/api.ts`

**Work items**:
1. Parse and display API error details from compensation upsert (avoid generic toast only).
2. Show inline form message for known migration/runtime errors with operator guidance.
3. Add optimistic UX guard: disable save while request is pending and preserve entered values on failure.

### Test Changes
**Files**:
- `packages/backend/src/__tests__/employees.test.ts`
- `packages/frontend/src/pages/__tests__/EmployeeDetailPage.test.tsx` (if frontend test harness exists)

**Cases**:
- Upsert compensation with healthy schema -> 200/201.
- Upsert compensation with missing table -> mapped actionable error response.
- Frontend shows detailed error message (not generic "Failed to save compensation").

**Exit Criteria**:
- Compensation save no longer fails silently.
- On schema drift, operator can identify remediation from API response + logs in one attempt.

---

## Sprint AP-E: Compensation Model Expansion

**Goal**: Replace "single flat compensation row" with a structured, extensible compensation profile.

### Data Model Changes
1. New table: `employee_compensation_revisions`
   - `id`, `employee_id`, `pay_type`, `base_rate`, `overtime_rate`, `effective_from`, `effective_to`, `standard_hours_per_day`, `notes`, `is_active`, timestamps.
2. New table: `employee_compensation_components`
   - Recurring items linked to revision (`revision_id`), `component_type` (`earning`/`deduction`), `name`, `calculation_type` (`fixed`/`percentage`), `value`, `is_taxable`, `is_active`.
3. Keep `employee_compensation` as compatibility view/table during migration window (deprecation path).

### API Changes
1. `GET /employees/:id/compensation` -> returns active revision + recurring components + revision metadata.
2. `GET /employees/:id/compensation/history` -> paginated revision timeline.
3. `POST /employees/:id/compensation/revisions` -> create future/current revision.
4. `PUT /employees/:id/compensation/revisions/:revisionId` -> edit draft/future revision.
5. `POST /employees/:id/compensation/revisions/:revisionId/activate` -> controlled activation with overlap validation.

### Frontend Changes
1. Replace vague modal with structured dialog sections:
   - Basic rates
   - Effective period
   - Recurring components
   - Notes + preview summary
2. Employee detail compensation card adds:
   - "Current profile" summary
   - "History" drawer/timeline
   - "Upcoming change" badge when a future revision exists.

### Validation Rules
- No overlapping effective periods per employee.
- At most one active revision at any point in time.
- Percentage-based components capped by configurable threshold.

### Exit Criteria
- Compensation supports real-world changes over time without overwriting history.
- Payroll can consume deterministic revision data for any pay period.

---

## Sprint AP-F: Payroll Engine Alignment

**Goal**: Make payroll generation deterministic, traceable, and compensation-aware by period.

### Backend Changes
**Files**:
- `packages/backend/src/routes/payroll.ts`
- `packages/backend/src/validators/payroll.ts`
- `packages/backend/src/db/schema/payroll.ts`

**Work items**:
1. During `POST /payroll/generate`, resolve compensation revision where:
   - `effective_from <= payPeriodEnd`
   - `effective_to IS NULL OR effective_to >= payPeriodStart`
2. Add payroll snapshot fields/tables:
   - `compensation_revision_id`
   - `compensation_snapshot` JSON (pay type/rates/components used at generation time)
3. Expand payroll gross/net calculation to include recurring components with clear formula ordering.
4. Add generation pre-check endpoint/report:
   - Employees missing active compensation
   - Overlapping/invalid revision windows
   - Suspicious values (negative base, outlier overtime rate)
5. Return richer generate response metadata with warnings and per-employee reason codes.

### Frontend Changes
**Files**:
- `packages/frontend/src/pages/PayrollPage.tsx`
- `packages/frontend/src/pages/PayrollDetailPage.tsx`
- `packages/frontend/src/hooks/usePayroll.ts`

**Work items**:
1. Pre-generation validation panel before final "Generate" action.
2. Post-generation summary with:
   - generated count
   - skipped count
   - warning count
   - downloadable exception list (CSV).
3. Payroll detail displays compensation snapshot and breakdown source.

### Test Changes
**Files**:
- `packages/backend/src/__tests__/payroll.test.ts`

**Cases**:
- Picks correct compensation revision by pay period.
- Handles future-dated revision without affecting past payroll.
- Includes recurring component calculations in gross/net.
- Returns structured warning metadata for missing/invalid compensation.

### Exit Criteria
- Payroll generation is period-correct and auditable.
- Finance/admin can explain every generated number from stored snapshot data.
