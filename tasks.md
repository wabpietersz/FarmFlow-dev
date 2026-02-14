# FarmFlow Development Task Tracker

> Last updated: 2026-02-14
> Plan doc: `FarmFlow-Implementation-Plan-Final.md`
> Total weeks: 24 (Phase 1: Weeks 1-12 MVP, Phase 2: Weeks 13-24 Enhancements)

---

## Attendance & Payroll Improvement Sprints (AP-A/AP-B/AP-C)

Reference doc: `docs/Attendance-Payroll-Improvement-Plan.md`

- [x] Sprint AP-A: DB schema changes (`attendance.leave_type`, decimal leave balances, decimal payroll attended days)
- [x] Sprint AP-A: Shared types (`Attendance.leaveType`, `BulkSetLeaveBalanceRequest`)
- [x] Sprint AP-A: Backend validators (`leaveType` conditional validation, bulk leave schema)
- [x] Sprint AP-A: Backend routes (leaveType-aware attendance CRUD, `/leave-balances/bulk`, leave-balance ordering, payroll attendedDays precision)
- [x] Sprint AP-A: Frontend validations/hooks/UI (leave type picker, grouped leave balances, bulk leave dialog)
- [x] Sprint AP-A: Backend tests updated/expanded for attendance + leave balance bulk flow
- [x] Sprint AP-B: DB schema (`employee_compensation`)
- [x] Sprint AP-B: Shared types (`PayType`, `EmployeeCompensation`, `UpsertCompensationRequest`)
- [x] Sprint AP-B: Backend compensation CRUD + payroll generate auto-fill logic
- [x] Sprint AP-B: Frontend compensation card/form/hooks + payroll generate messaging
- [x] Sprint AP-B: Backend tests for compensation CRUD + payroll compensation calculations
- [x] Sprint AP-C: DB schema (`compensation_templates`)
- [x] Sprint AP-C: Backend template CRUD routes + validators
- [x] Sprint AP-C: Frontend template-aware allowance/deduction dialogs + template management UI
- [x] Sprint AP-C: Backend template tests
- [x] Final verification: `shared`/`backend`/`frontend` builds passed, backend Jest suite passed (`262` tests), migration generated (`0007_parallel_the_professor.sql`)

## Attendance & Payroll Expansion Sprints (AP-D/AP-E/AP-F)

Reference doc: `docs/Attendance-Payroll-Improvement-Plan.md` (AP-D/AP-E/AP-F addendum)

- [x] Sprint AP-D0 (Hotfix): Diagnose and fix `PUT /employees/:id/compensation` save failure (500)
- [x] Sprint AP-D1: Backend error mapping for compensation upsert (missing table, constraint, validation)
- [x] Sprint AP-D2: Add HR/payroll schema readiness health check + deployment migration verification step
- [x] Sprint AP-D3: Frontend compensation save UX hardening (detailed API errors, inline failure messaging, retry-safe form behavior)
- [x] Sprint AP-D4: Compensation save reliability tests (backend + frontend)
- [x] Sprint AP-E1: DB migration for versioned compensation revisions (`employee_compensation_revisions`)
- [x] Sprint AP-E2: DB migration for recurring compensation components (`employee_compensation_components`)
- [x] Sprint AP-E3: Shared types update for revision history + components
- [x] Sprint AP-E4: Backend compensation revision/history endpoints
- [x] Sprint AP-E5: Frontend compensation UX expansion (profile summary, history timeline, recurring components editor)
- [x] Sprint AP-E6: Validation rules for overlapping effective periods and component bounds
- [x] Sprint AP-F1: Payroll generation selects compensation revision by pay-period window
- [x] Sprint AP-F2: Payroll compensation snapshot persistence (`compensation_revision_id` + snapshot payload)
- [x] Sprint AP-F3: Payroll gross/net engine alignment with recurring components
- [x] Sprint AP-F4: Payroll pre-generation validation report and warning reason codes
- [x] Sprint AP-F5: Payroll UI updates (pre-check panel, generation exception summary, snapshot visibility in detail)
- [x] Sprint AP-F6: Backend payroll tests for revision selection, period correctness, and warning metadata

## Attendance & Payroll UX Sprint (AP-G)

Reference doc: `docs/Attendance-Payroll-Improvement-Plan.md` (AP-G addendum)

- [x] Sprint AP-G1: Backend payroll preview endpoint (`POST /api/payroll/preview`) with month-based attendance + compensation defaults
- [x] Sprint AP-G2: Backend payroll create/generate payload expansion for editable row inputs (allowances include/exclude, overtime, notes, attended days)
- [x] Sprint AP-G3: Payroll generation compatibility mode retained (`workingDays` legacy path) with warning-first handling for missing compensation
- [x] Sprint AP-G4: Payroll list enhancements (period filter support + allowances/deductions totals in list response)
- [x] Sprint AP-G5: Frontend bulk generate dialog redesigned to editable employee table with inline calculations and selection controls
- [x] Sprint AP-G6: Frontend single payroll creation aligned to same editable defaults flow as bulk generation
- [x] Sprint AP-G7: Payroll detail view expanded with explicit breakdown (prorated base, attendance, overtime, totals)
- [x] Sprint AP-G8: Backend/frontend type and validation updates for new payroll request shapes

## Navigation UX Improvement Sprint (NAV-A/NAV-B/NAV-C/NAV-D)

Reference doc:
- `docs/Navigation-UX-Plan.md`

- [x] NAV-PLAN-1: Define target IA and module grouping requirements in functional plan doc
- [x] NAV-PLAN-2: Define implementation sequence, file targets, acceptance criteria, and QA matrix
- [x] NAV-A1: Grouped main navigator model (Dashboard, People, Operational, Feed, Reports) with top-level icons
- [x] NAV-A2: Active-route helper behavior for top-level links and grouped child links
- [x] NAV-B1: Desktop sidebar refactor to grouped sections without separator lines
- [x] NAV-B2: Desktop fixed-size behavior (no expand/collapse resize shifts while navigating)
- [x] NAV-C1: Mobile bottom tabs updated to Dashboard / People / Operational / Feed / Reports
- [x] NAV-C2: Mobile grouped flow via animated bottom slate expanding from selected icon
- [x] NAV-C3: Admin pages (`Users`, `Settings`) moved to profile dropdown path on mobile/desktop
- [x] NAV-D1: Accessibility hardening (`aria-current`, `aria-expanded`, focus visibility, touch targets)
- [x] NAV-D2: RBAC navigator visibility filtering retained per permission
- [x] NAV-D3: Build/test + runtime smoke checks completed for responsive nav behavior
- [x] NAV-REL-1: Final single-cutover implementation pass after explicit go-ahead

---

## Phase 1: MVP (Weeks 1-12)

### Week 1: Project Setup & Infrastructure (46 hours)

- [x] Task 1.1: Repository & Monorepo Setup (8h)
  - [x] Initialize npm workspaces monorepo structure
  - [x] Create `packages/shared`, `packages/backend`, `packages/frontend`
  - [x] Configure TypeScript for all packages
  - [x] Set up `@farmflow/shared` package with cross-package types
- [x] Task 1.2: Backend Scaffolding (10h)
  - [x] Express + TypeScript setup
  - [x] Winston structured logging
  - [x] Health check endpoint
  - [x] Environment configuration
  - [x] Drizzle ORM integration with PostgreSQL
- [x] Task 1.3: Frontend Scaffolding (10h)
  - [x] React 19 + Vite 7 setup
  - [x] TailwindCSS v4 integration (`@import "tailwindcss"`)
  - [x] Zustand auth store
  - [x] TanStack Query provider
  - [x] Base routing with React Router
- [x] Task 1.4: CI/CD Pipeline Setup (12h)
  - [x] GitHub Actions workflow
  - [x] Lint, type-check, test on push
  - [x] Docker Compose for local development
- [x] Task 1.5: Development Environment & Documentation (6h)
  - [x] Docker Compose (PostgreSQL 15)
  - [x] Local dev startup script (`npm start`)
  - [x] Environment variable templates

### Week 2: Database Schema & Migrations (30 hours)

- [x] Task 2.1: Schema Design & Implementation (16h)
  - [x] Access Control: `users`, `audit_logs`
  - [x] Employees: `employees`, `emergency_contacts`, `bank_details`, `documents`
  - [x] Infrastructure: `sites`, `cages`
  - [x] Production: `batches`, `daily_records`, `daily_record_photos`, `vaccinations`
  - [x] Feed: `suppliers`, `feed_recipes`, `feed_recipe_ingredients`, `feed_inventory`
  - [x] Sales: `buyers`, `sales`, `payments`
  - [x] Attendance: `attendance`, `shifts`, `leave_balances`
  - [x] Payroll: `payroll`, `payroll_deductions`, `payroll_allowances`
  - [x] System: `system_config`, `notifications`
  - [x] Total: 27 tables across 11 schema files
- [x] Task 2.2: Migration System & Seed Data (6h)
  - [x] Initial migration (`0000_harsh_screwball.sql`)
  - [x] Seed data (8 records)
  - [x] Migration journal tracking
- [x] Task 2.3: Indexes & Performance Validation (4h)
  - [x] 31 indexes across all tables
  - [x] Composite indexes for common queries
- [x] Task 2.4: Migration & Rollback Procedures (4h)
  - [x] Drizzle migration tooling configured
  - [x] Additional migrations: `0001_sales_weight_pricing.sql`, `0002_feed_production_distribution.sql`

### Week 3: Authentication Backend (40 hours)

- [x] Task 3.1: Firebase Authentication Setup (8h)
  - [x] Firebase Admin SDK integration
  - [x] Firebase Client SDK configuration
  - [x] Project: farmflow-dev (ID: farmflow-dev)
- [x] Task 3.2: Authentication Middleware (8h)
  - [x] Token verification middleware
  - [x] Request user injection (`req.user`)
  - [x] Express type augmentation (`express.d.ts`)
- [x] Task 3.3: RBAC Middleware (10h)
  - [x] 7-role permission system (system_admin → viewer)
  - [x] `hasPermission()` check function
  - [x] Permission matrix for all resources
  - [x] `requirePermission()` middleware
- [x] Task 3.4: User Management Routes (8h)
  - [x] Auth routes: login, signup, password reset, token refresh
  - [x] User management routes: list, detail, role update
- [x] Task 3.5: Security Hardening (6h)
  - [x] Input validation with Zod schemas
  - [x] Rate limiting considerations
  - [x] CORS configuration

### Week 4: Authentication Frontend & Dashboard (40 hours)

- [x] Task 4.1: Login Page (10h)
  - [x] Firebase client auth integration
  - [x] Login form with email/password
  - [x] Error handling and toast notifications
- [x] Task 4.2: Protected Routes (8h)
  - [x] Auth guard component
  - [x] Redirect to login when unauthenticated
  - [x] Unauthorized page for insufficient permissions
- [x] Task 4.3: Auth Store (Zustand) (8h)
  - [x] Auth state management
  - [x] Token persistence
  - [x] Auto-refresh on app load
- [x] Task 4.4: Logout & Session Management (8h)
  - [x] Logout handler
  - [x] Session cleanup
- [x] Task 4.5: Role-Based Navigation (6h)
  - [x] Navigation config with permission mapping
  - [x] 11 nav items with RBAC filtering
  - [x] Shadcn UI components (16 components)
  - [x] AppLayout with sidebar navigation

### Weeks 5-6: Employee Management (80 hours)

- [x] Task 5.1: Employee CRUD Backend (14h)
  - [x] 10 endpoints in `employees.ts`
  - [x] List with pagination, search, filters
  - [x] Detail view with related data
  - [x] Create/Update with validation
  - [x] Soft delete
- [x] Task 5.2: Emergency Contacts & Bank Details (8h)
  - [x] Emergency contact CRUD (add, update, delete)
  - [x] Bank details CRUD (add, update, delete)
- [x] Task 5.3: File Upload Setup (12h)
  - [x] Document upload routes
  - [x] File storage integration
  - [x] Document download endpoint
- [x] Task 5.4: Testing & Documentation (6h)
  - [x] 18 employee tests passing
- [x] Task 6.1: Employee List Page (10h)
  - [x] `EmployeesPage.tsx` with search & filters
  - [x] Pagination support
- [x] Task 6.2: Create/Edit Employee Form (12h)
  - [x] `CreateEmployeePage.tsx`
  - [x] `EditEmployeePage.tsx`
  - [x] `EmployeeForm.tsx` component with Zod validation
- [x] Task 6.3: Document Upload & Management (12h)
  - [x] Document upload UI in employee detail
  - [x] `useDocuments.ts` hook
- [x] Task 6.4: Search, Filter, Export (6h)
  - [x] CSV export functionality
  - [x] Search by name, ID
  - [x] Filter by status, site, role

### Weeks 7-8: Site, Cage & Batch Management (80 hours)

- [x] Task 7.1: Sites CRUD Backend (10h)
  - [x] Site list, detail, create, update, soft-delete
  - [x] Cage management endpoints
  - [x] `GET /api/sites/list` for dropdown selects
- [x] Task 7.2: Cages CRUD Backend (10h)
  - [x] Cage assignment to sites
  - [x] Capacity tracking
- [x] Task 7.3: Batch Creation & Lifecycle Backend (15h)
  - [x] Batch CRUD with auto-code (BATCH-SITE-CAGE-YYYYMMDD)
  - [x] Status flow: placement → growing → ready_for_sale → sold
  - [x] Daily records (mortality, feed, weight, temperature)
  - [x] Vaccination tracking
  - [x] FCR calculation
- [x] Task 7.4: Testing (5h)
  - [x] Batch validator tests
- [x] Task 8.1: Batch List & Detail Pages (12h)
  - [x] `BatchesPage.tsx` with filters
  - [x] `BatchDetailPage.tsx` with daily records, vaccinations, feed distribution
- [x] Task 8.2: Batch Status Transitions UI (10h)
  - [x] Status workflow buttons
  - [x] Confirmation dialogs
- [x] Task 8.3: Site & Cage Management Pages (10h)
  - [x] `SitesPage.tsx` with site list
  - [x] `SiteDetailPage.tsx` with cage management
- [x] Task 8.4: Mobile Optimization (8h)
  - [x] Responsive layouts with Tailwind
  - [x] Touch-friendly interactions

### Weeks 9-10: Sales Module (80 hours)

- [x] Task 9.1: Buyer Master CRUD Backend (8h)
  - [x] 5 endpoints: list, detail+history, create, update, soft-delete
- [x] Task 9.2: Sales Recording Backend (12h)
  - [x] 6 endpoints: list, detail+balance, create with auto-code, update status, delete, add payment
  - [x] Auto-code: `SALE-YYYYMMDD-XXX`
  - [x] Weight/pricing fields in sales schema
- [x] Task 9.3: Payment Tracking Backend (12h)
  - [x] Multi-payment per sale (cash, cheque, bank transfer)
  - [x] Cheque clearing workflow
  - [x] Auto-complete sale when fully paid
  - [x] Revert on cheque bounce
- [x] Task 9.4: Sales Testing (8h)
  - [x] 40 sales tests passing
- [x] Task 10.1: Sales List & Detail Pages (12h)
  - [x] `SalesPage.tsx` with tabbed layout (Sales + Buyers tabs)
  - [x] `SaleDetailPage.tsx` with financial summary
- [x] Task 10.2: Invoice Generation / PDF (10h)
  - [x] `generateInvoice.ts` with jspdf
  - [x] Invoice download from sale detail
- [x] Task 10.3: Cheque Tracking & Payment UI (12h)
  - [x] Payment recording dialog
  - [x] Payment status management
  - [x] Cheque clearing/bounce handling
- [x] Task 10.4: Outstanding Balance Dashboard (6h)
  - [x] Balance tracking per buyer
  - [x] Outstanding amount display on sale detail

### Week 11: Dashboard, Reports & System Configuration (40 hours)

- [x] Task 11.1: Dashboard (12h)
  - [x] `DashboardPage.tsx` with real metrics
  - [x] `GET /api/dashboard/summary` endpoint
  - [x] `EnhancedMetricCard.tsx` component
  - [x] Metrics: active batches, FCR, mortality, payments, employees, sales
- [x] Task 11.2: Reports & Analytics (16h)
  - [x] Backend: 9 report types in `reports.ts` (1,449 lines)
    - [x] Batch performance (FCR, mortality, survival rate)
    - [x] Sales summary with buyer breakdown
    - [x] Mortality trends with cumulative calculation
    - [x] Feed consumption with inventory summaries
    - [x] Financial overview with payment method breakdown
    - [x] Batch comparison (2-4 batches, curve analysis)
    - [x] Batch profitability (revenue, feed cost, labor cost, margin)
    - [x] HR analytics (attendance, leave, payroll trends, overtime)
    - [x] Feed analytics (FCR trends, cost per bird, production efficiency)
  - [x] Frontend: `ReportsPage.tsx` with tabbed report sections
  - [x] Report components: `BatchComparisonTab`, `BatchProfitabilityTab`, `HRAnalyticsTab`, `FeedAnalyticsTab`
  - [x] `useReports.ts` hook with 9 report hooks + CSV export
  - [x] CSV export for all report types (`GET /api/reports/export/csv`)
- [x] Task 11.3: System Configuration (12h)
  - [x] `systemConfig.ts` backend route
  - [x] `SettingsPage.tsx` frontend
  - [x] Route registered in `index.ts`

### Week 12: MVP Integration Testing & Deployment (40 hours)

- [x] Task 12.1: Integration Testing (12h)
  - [x] 213 backend tests passing (10 test suites)
  - [x] Health (3), Auth (12), Permissions (12), Employees (18), Sales (40), Attendance (24), Payroll (19), Feed, Reports, Performance & Security (22)
- [x] Task 12.2: Performance Testing (8h)
  - [x] API response time benchmarks (health <100ms, dashboard <500ms, employees <500ms)
  - [x] Concurrent request handling (10 concurrent health checks, 5 concurrent auth)
  - [x] 404 route response time (<50ms)
- [x] Task 12.3: Security Testing (8h)
  - [x] Authentication edge cases (no header, empty token, malformed, expired, tampered)
  - [x] Authorization bypass testing (viewer→create, worker→payroll, viewer→feed, viewer→sales)
  - [x] Input sanitization verification (SQL injection, XSS, body size limit >10MB)
  - [x] Security headers (Helmet X-Content-Type-Options, CORS, JSON content type)
  - [x] Report CSV export type validation
- [ ] Task 12.4: Staging Deployment (8h)
  - [ ] GCP Cloud Run deployment
  - [ ] Firebase Hosting deployment
  - [ ] Neon PostgreSQL provisioning
  - [ ] Environment variable configuration
  - [ ] GCP deployment plan documented (commit `b1be2f8`)
- [ ] Task 12.5: UAT & Sign-Off (4h)
  - [ ] User acceptance testing
  - [ ] Stakeholder demo
  - [ ] Bug triage and fix

---

## Phase 2: Enhancements (Weeks 13-24)

### Weeks 13-14: Feed Mill Inventory & Production (80 hours)

- [x] Task 13.1: Supplier Management Backend (10h)
  - [x] Supplier CRUD (list, detail, create, update, soft-delete)
  - [x] Contact tracking, status filter, search
- [x] Task 13.2: Feed Recipe Management Backend (12h)
  - [x] Recipe CRUD with ingredient mapping
  - [x] Feed type and status filters
  - [x] Atomic ingredient replacement on update
- [x] Task 13.3: Feed Inventory Backend (10h)
  - [x] Inventory CRUD with low-stock flag calculation
  - [x] Reorder level tracking
  - [x] Restock endpoint with quantity increment
- [x] Task 13.4: Feed Inventory Frontend (8h)
  - [x] `FeedPage.tsx` with tabbed layout
  - [x] Supplier, recipe, inventory management UI
  - [x] `useFeed.ts` hook (24+ custom hooks)
- [x] Task 14.1: Feed Production Batch Backend (14h)
  - [x] Production CRUD with auto-code (`PROD-YYYYMMDD-XXX`)
  - [x] Status transitions: planned → in_progress → completed
  - [x] Material deduction on completion
  - [x] Production summary aggregates
- [x] Task 14.2: Feed Production Frontend (10h)
  - [x] Production batch list and detail in FeedPage
  - [x] Create/complete production dialogs
- [x] Task 14.3: Feed Validator (8h)
  - [x] `feed.ts` validator with Zod schemas for all feed operations
- [x] Task 14.4: Feed Testing (8h)
  - [x] `feed.test.ts` test suite

### Weeks 15-16: Feed Distribution & Recipe Management (80 hours)

- [x] Task 15.1: Feed Distribution Backend (12h)
  - [x] Distribution CRUD with inventory sufficiency check
  - [x] Distribution by batch endpoint
  - [x] Distribution detail view
- [x] Task 15.2: Feed Distribution Frontend (10h)
  - [x] Distribution tab in FeedPage
  - [x] Distribution hooks in `useFeed.ts`
- [x] Task 15.3: Feed-Batch Integration (10h)
  - [x] Feed distribution linked to farm batches
  - [x] BatchDetailPage shows feed distributions
- [x] Task 15.4: Feed Analytics Backend (8h)
  - [x] FCR trend by batch
  - [x] Feed cost per bird
  - [x] Inventory turnover
  - [x] Production efficiency calculations
- [x] Task 16.1: Advanced Recipe Features (12h)
  - [x] Recipe versioning (POST `/recipes/:id/version`, GET `/recipes/:id/versions`)
  - [x] Recipe cost optimization suggestions (GET `/recipes/cost-optimization`)
  - [x] Nutritional analysis fields (targetProtein, targetEnergy, targetFiber, targetCalcium)
- [x] Task 16.2: Inventory Alerts & Automation (10h)
  - [x] Low-stock alerts with auto-generation (GET `/inventory/alerts`, PUT `/inventory/alerts/:id/acknowledge`)
  - [x] Automatic reorder suggestions with urgency levels (GET `/inventory/reorder-suggestions`)
  - [x] Inventory audit trail (GET `/inventory/:id/audit-trail`, POST `/inventory/:id/adjust`)
- [x] Task 16.3: Feed Production Optimization (10h)
  - [x] Production scheduling (GET `/production/schedule` with date range filters)
  - [x] Waste tracking (waste_quantity, waste_reason fields + GET `/production/waste-summary`)
  - [x] Quality control checkpoints (POST `/production/:id/qc` with qcPassedAt, qcPassedBy, qcNotes)
- [x] Task 16.4: Feed Module Testing (8h)
  - [x] Feed production & distribution tests passing
  - [x] Auth & permission tests for all feed endpoints

### Weeks 17-18: Attendance & Payroll (80 hours)

- [x] Task 17.1: Shift CRUD Backend (8h)
  - [x] 4 endpoints: list, create, update, soft-delete
- [x] Task 17.2: Attendance Recording Backend (12h)
  - [x] 6 endpoints: list, summary, create, bulk, update, delete
  - [x] Auto leave balance sync on attendance type change
- [x] Task 17.3: Leave Balance Management Backend (8h)
  - [x] 4 endpoints: list, get by employee, upsert, update
  - [x] Leave type categorization
- [x] Task 17.4: Attendance Frontend (12h)
  - [x] `AttendancePage.tsx` with 3-tab layout (Attendance, Leave Balances, Shifts)
  - [x] Record and bulk attendance dialogs
  - [x] `useAttendance.ts` hook
  - [x] Attendance form validation schemas
- [x] Task 18.1: Payroll CRUD Backend (14h)
  - [x] 10 endpoints: list, detail, create, generate, update, status workflow, add/remove deductions, add/remove allowances
  - [x] Status workflow: draft → reviewed → approved → paid (forward-only)
  - [x] `recalculatePayrollTotals()` auto-update helper
- [x] Task 18.2: Payroll Frontend (12h)
  - [x] `PayrollPage.tsx` with status filter tabs
  - [x] `PayrollDetailPage.tsx` with summary cards, allowances/deductions tables
  - [x] Generate payroll dialog, create individual payroll dialog
  - [x] Status workflow buttons
  - [x] `usePayroll.ts` hook
  - [x] Payroll form validation schemas
- [x] Task 18.3: Attendance Testing (8h)
  - [x] 24 attendance tests passing
- [x] Task 18.4: Payroll Testing (6h)
  - [x] 19 payroll tests passing

### Weeks 19-20: Advanced Reporting & Analytics (80 hours)

- [x] Task 19.1: Report Engine Backend (16h)
  - [x] 9 report types in `reports.ts` (1,449 lines)
  - [x] Batch performance, sales summary, mortality trends
  - [x] Feed consumption, financial overview
  - [x] Batch comparison, batch profitability
  - [x] HR analytics, feed analytics
- [x] Task 19.2: CSV Export Engine (8h)
  - [x] Universal CSV export endpoint
  - [x] `arrayToCsv()` helper with proper escaping
  - [x] All 9 report types exportable
- [x] Task 19.3: Report Visualizations Frontend (16h)
  - [x] `ReportsPage.tsx` with tabbed sections
  - [x] `BatchComparisonTab.tsx` — comparative charts
  - [x] `BatchProfitabilityTab.tsx` — profitability analysis
  - [x] `HRAnalyticsTab.tsx` — attendance, payroll, leave charts
  - [x] `FeedAnalyticsTab.tsx` — FCR, costs, efficiency charts
  - [x] Recharts integration (line, bar, pie charts)
- [x] Task 19.4: Report Hooks & Data Layer (8h)
  - [x] `useReports.ts` with 9 report hooks + CSV export
- [x] Task 19.5: Reports Testing (8h)
  - [x] `reports.test.ts` test suite
- [x] Task 20.1: Dashboard Enhancements (12h)
  - [x] Auto-refresh polling (2-5 min intervals via TanStack Query refetchInterval)
  - [x] Period-based date range filters (7d, 30d, 90d, YTD with trend comparison)
  - [x] Recent activity feed (GET `/dashboard/recent-activity` with audit log mapping)
- [x] Task 20.2: Report Scheduling (12h)
  - [x] Report schedule CRUD (GET/POST/PUT/DELETE `/feed/report-schedules`)
  - [x] Cron expression support with next-run calculation
  - [x] Report schedule management hooks (`useReportSchedules`, `useCreateReportSchedule`, etc.)
  - [x] Zod validators for schedule creation/update

### Week 21: PWA Implementation (40 hours)

- [x] Task 21.1: PWA Manifest & Icons (8h)
  - [x] `favicon.svg`
  - [x] PWA icons: `icon-192x192.png`, `icon-512x512.png`, `apple-touch-icon.png`
  - [x] Manifest configuration in `index.html`
- [x] Task 21.2: Service Worker Setup (12h)
  - [x] `vite-plugin-pwa` integration
  - [x] Workbox configuration in `vite.config.ts`
- [x] Task 21.3: Install Prompt (8h)
  - [x] `InstallPrompt.tsx` component
- [x] Task 21.4: Update/Reload Prompt (6h)
  - [x] `PWAReloadPrompt.tsx` component
- [x] Task 21.5: Offline Banner (6h)
  - [x] `OfflineBanner.tsx` component

### Week 22: Mobile Optimization & Offline Support (40 hours)

- [x] Task 22.1: Offline Data Caching (12h)
  - [x] IndexedDB for offline data storage (`offlineDb.ts` with idb library — query cache, mutation queue, session stores)
  - [x] Cache-first strategy for static assets (Workbox: fonts, images with StaleWhileRevalidate)
  - [x] Network-first strategy for API calls (Workbox: 30-min cache, 200 max entries)
  - [x] TanStack Query persistence to localStorage (`queryPersister.ts` — 24h max age, filtered by module)
  - [x] offlineFirst networkMode for cached data when offline
  - [x] SPA navigation fallback for offline page loads (navigateFallback: index.html)
- [x] Task 22.2: Offline Form Queueing (10h)
  - [x] Queue form submissions when offline (`offlineSync.ts` — addToMutationQueue, syncMutations)
  - [x] Sync when back online (auto-sync on 'online' event with 1s debounce)
  - [x] Last-write-wins conflict resolution strategy
  - [x] Max 3 retries with status tracking (pending → syncing → failed)
  - [x] Toast notifications for sync status
  - [x] `useOffline.ts` hooks (useOnlineStatus, useOfflineMutationQueue, useOfflineMutation)
- [x] Task 22.3: Mobile UI Optimization (10h)
  - [x] Pull-to-refresh gesture support (`usePullToRefresh` hook + `PullToRefresh` component)
  - [x] Mobile bottom navigation bar (`MobileBottomNav.tsx` — Home, Batches, Sales, Reports, More)
  - [x] Sheet-based sidebar triggered by "More" button (replaced hamburger menu)
  - [x] Bottom padding on mobile content area (pb-20) for bottom nav clearance
  - [x] Safe area insets for notch devices
  - [x] Enhanced OfflineBanner with sync queue panel (retry/discard per mutation)
- [x] Task 22.4: Mobile Testing (8h)
  - [x] All packages build successfully (shared, backend, frontend)
  - [x] 213 backend tests pass (10 suites)
  - [x] PWA service worker generates with 62 precache entries
  - [x] Code splitting verified (21 lazy-loaded page chunks + 6 vendor chunks)

### Week 23: Security Hardening & Performance (40 hours)

- [x] Task 23.1: Security Audit (12h)
  - [x] Dependency vulnerability scan — npm audit fix (9→5 vulns, 4 high→0, all remaining are dev-only esbuild)
  - [x] Updated express (4.21→4.22) and axios (1.13.4→1.13.5) for CVE patches
  - [x] OWASP Top 10 review — all mitigations implemented
  - [x] Content Security Policy headers (Helmet CSP with directives for self, fonts, Firebase)
  - [x] HSTS (1-year max-age, includeSubDomains, preload in production)
  - [x] Input sanitization middleware (XSS, script tags, event handlers, null bytes, prototype pollution)
  - [x] HTTP Parameter Pollution protection (hpp middleware)
  - [x] Request timeout middleware (30s timeout, prevents slow loris attacks)
  - [x] Auth rate limiting (10 attempts/15min in prod vs 100 req general limit)
  - [x] Permissions-Policy header (camera, microphone, geolocation, payment all disabled)
  - [x] Referrer-Policy: strict-origin-when-cross-origin
  - [x] Cache-Control: no-store on all API responses
  - [x] Trust proxy enabled for production (load balancer support)
- [x] Task 23.2: Performance Optimization (12h)
  - [x] Code splitting — 21 lazy-loaded page components via React.lazy()
  - [x] Vendor chunk splitting (react, query, ui, charts, firebase, forms — 6 chunks)
  - [x] SPA loading spinner (PageLoader component during lazy chunk loads)
  - [x] TanStack Query cache persistence (24h offline cache in localStorage)
  - [x] offlineFirst network mode (serve cached data immediately)
  - [x] Workbox service worker with precaching (62 assets) and runtime caching
  - [x] Image cache with StaleWhileRevalidate (30-day TTL, 100 max entries)
  - [x] API response caching via Workbox NetworkFirst (30-min TTL, 200 max entries)
  - [x] CORS preflight caching (maxAge: 24 hours)
  - [x] Source maps enabled for production debugging
- [x] Task 23.3: Monitoring & Alerting Setup (8h)
  - [x] In-memory metrics collector (`monitoring.ts` — request count, latency, error rate, memory)
  - [x] Requests-per-minute calculation (60-second sliding window)
  - [x] Slow request alerts (>5s duration logged as warning)
  - [x] High error rate alerts (>5% logged as error)
  - [x] Protected metrics endpoint (GET /api/metrics, system:read permission required)
  - [x] Enhanced health check (uptime, memory usage, version)
  - [x] Structured Winston logging (JSON format for Cloud Logging aggregation)
- [x] Task 23.4: Backup & Recovery (8h)
  - [x] Backup configuration module (`backup.ts` — schedule, retention, RTO/RPO)
  - [x] Automated daily backup schedule (midnight UTC cron)
  - [x] 35-day retention policy configured
  - [x] Recovery procedure documented (10-step procedure)
  - [x] RTO 4 hours, RPO 1 hour targets defined
  - [x] Backup status reporting for health checks
  - [x] Point-in-time recovery enabled for production

### Week 24: Production Deployment & Go-Live (40 hours)

- [ ] Task 24.1: Production Infrastructure (12h)
  - [ ] GCP Cloud Run deployment (auto-scaling)
  - [ ] Firebase Hosting CDN for frontend
  - [ ] Neon PostgreSQL production database
  - [ ] Domain and SSL configuration
- [ ] Task 24.2: Data Migration (8h)
  - [ ] Production database schema deployment
  - [ ] Seed data for production (roles, default config)
  - [ ] Data validation scripts
- [ ] Task 24.3: Go-Live Checklist (8h)
  - [ ] Smoke tests on production
  - [ ] Performance benchmarks
  - [ ] Rollback plan verified
  - [ ] Monitoring alerts active
- [ ] Task 24.4: Documentation & Handoff (8h)
  - [ ] API documentation (Swagger/OpenAPI)
  - [ ] User guide / operations manual
  - [ ] Deployment runbook
  - [ ] Developer onboarding guide
- [ ] Task 24.5: Post-Launch Support Plan (4h)
  - [ ] Bug triage process
  - [ ] Feature request tracking
  - [ ] SLA definitions

---

## Cross-Cutting Concerns (Ongoing)

### Code Quality
- [x] TypeScript strict mode across all packages
- [x] Zod validation at all API boundaries (8 validator files)
- [x] Consistent error response format
- [x] Structured logging with Winston
- [ ] Frontend unit tests (Vitest configured but no tests written)
- [ ] E2E tests (Playwright/Cypress)

### Testing Summary
| Test Suite | Tests | Status |
|-----------|-------|--------|
| Health | 3 | ✅ Pass |
| Auth | 12 | ✅ Pass |
| Permissions | 12 | ✅ Pass |
| Employees | 18 | ✅ Pass |
| Sales | 40 | ✅ Pass |
| Attendance | 24 | ✅ Pass |
| Payroll | 19 | ✅ Pass |
| Feed | ✓ | ✅ Pass |
| Reports | ✓ | ✅ Pass |
| Performance & Security | 22 | ✅ Pass |
| **Total** | **213** | **✅ All Pass** |

### Infrastructure
- [x] Docker Compose for local development
- [x] GitHub Actions CI/CD pipeline
- [x] Local dev startup script
- [x] GCP deployment plan documented
- [ ] Staging environment deployed
- [ ] Production environment deployed

### Documentation
- [x] Implementation plan (`FarmFlow-Implementation-Plan-Final.md`)
- [x] GCP deployment plan (commit `b1be2f8`)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] User guide
- [ ] Developer onboarding guide

---

## Progress Summary

| Phase | Weeks | Status | Completion |
|-------|-------|--------|------------|
| **Phase 1: MVP** | 1-12 | 🟡 Near Complete | ~97% |
| Week 1: Setup & Infra | 1 | ✅ Complete | 100% |
| Week 2: Database | 2 | ✅ Complete | 100% |
| Week 3: Auth Backend | 3 | ✅ Complete | 100% |
| Week 4: Auth Frontend & Dashboard | 4 | ✅ Complete | 100% |
| Weeks 5-6: Employee Management | 5-6 | ✅ Complete | 100% |
| Weeks 7-8: Site/Cage/Batch | 7-8 | ✅ Complete | 100% |
| Weeks 9-10: Sales Module | 9-10 | ✅ Complete | 100% |
| Week 11: Reports & Config | 11 | ✅ Complete | 100% |
| Week 12: Testing & Deploy | 12 | 🟡 Partial | ~75% |
| **Phase 2: Enhancements** | 13-24 | 🟡 In Progress | ~92% |
| Weeks 13-14: Feed Inventory & Production | 13-14 | ✅ Complete | 100% |
| Weeks 15-16: Feed Distribution & Recipes | 15-16 | ✅ Complete | 100% |
| Weeks 17-18: Attendance & Payroll | 17-18 | ✅ Complete | 100% |
| Weeks 19-20: Advanced Reporting | 19-20 | ✅ Complete | 100% |
| Week 21: PWA Implementation | 21 | ✅ Complete | 100% |
| Week 22: Mobile & Offline | 22 | ✅ Complete | 100% |
| Week 23: Security & Performance | 23 | ✅ Complete | 100% |
| Week 24: Production Deploy | 24 | ❌ Not Started | 0% |

### Key Metrics
- **Backend Routes**: 17/17 registered + metrics endpoint ✅
- **Backend Tests**: 213/213 passing (10 suites) ✅
- **Frontend Pages**: 21 implemented (all lazy-loaded) ✅
- **Frontend Hooks**: 15+ hook files with 90+ custom hooks ✅
- **Frontend Chunks**: 21 page chunks + 6 vendor chunks (code-split) ✅
- **Database Schemas**: 11 files, 33 tables ✅
- **Migrations**: 4 generated (3 applied + 1 pending) ✅
- **Shared Types**: 7 type files ✅
- **Security**: CSP, HSTS, HPP, input sanitization, auth rate limiting ✅
- **Offline**: IndexedDB cache, mutation queue, query persistence ✅
- **Vulnerabilities**: 0 high, 5 moderate (dev-only esbuild) ✅

---

## Improvements: Feed Module Data Integrity & Purchase Orders

> **Plan doc:** `docs/Feed-Module-Improvements-Plan.md`
> **Estimated effort:** ~80 hours (2 sprints)
> **Status:** COMPLETE

### Sprint IMP-A: Data Integrity & Schema Foundations (~40h)

- [x] Task IMP-A6: Shared Types Update (2h)
  - [x] Add `inventoryItemId` to `FeedRecipeIngredient` interface
  - [x] Add `calculatedCost` to `FeedRecipe` interface
  - [x] Add `supplierName` to `FeedInventoryItem` interface
  - [x] Add `PurchaseOrder`, `PurchaseOrderItem` interfaces
  - [x] Rebuild shared package

- [x] Task IMP-A1: Database Migration — Recipe Ingredient FK + Audit Trail Notes (6h)
  - [x] Add `inventoryItemId` (FK → feedInventory.id) to `feedRecipeIngredients`
  - [x] Add `notes` (TEXT) to `inventoryAuditTrail`
  - [x] Generate migration `0004_feed_improvements_ingredient_fk.sql`
  - [x] Write backfill SQL: match existing ingredients by name to inventory items
  - [x] Verify backfill — log unmatched rows for manual review
  - [x] All existing tests pass after migration

- [x] Task IMP-A2: Backend — Recipe CRUD with Inventory Item FK (8h)
  - [x] Update recipe creation to accept `inventoryItemId` per ingredient
  - [x] Validate each `inventoryItemId` exists in `feedInventory`
  - [x] Auto-populate `ingredientName` from inventory item (denormalized)
  - [x] Update recipe detail to return `calculatedCost` (Σ proportion × costPerUnit)
  - [x] Update recipe list to include `calculatedCost`
  - [x] Update recipe versioning to copy `inventoryItemId` references
  - [x] Eliminate fuzzy `ilike()` matching in production creation — use FK directly
  - [x] Production materials created with guaranteed inventory item FK

- [x] Task IMP-A3: Backend — Supplier-Inventory Enforcement (4h)
  - [x] Make `supplierId` required in inventory creation validator
  - [x] Validate supplier exists and is active on inventory create/update
  - [x] Inventory list endpoint joins supplier name
  - [x] New endpoint: `GET /feed/suppliers/:id/inventory` — list inventory for supplier
  - [x] Supplier soft-delete blocks if active inventory references exist (409 Conflict)
  - [x] Existing inventory items flagged for supplier backfill if missing

- [x] Task IMP-A4: Frontend — Recipe Form with Inventory Dropdown (8h)
  - [x] Recipe create dialog: replace free-text ingredient input with inventory item combobox
  - [x] Dropdown shows: ingredientName, supplier, costPerUnit, unit
  - [x] Auto-fill `unit` from selected inventory item
  - [x] Live calculated cost displayed as ingredients are added
  - [x] Recipe edit dialog: pre-select inventory items from existing ingredients
  - [x] Inventory create/edit dialog: `supplierId` becomes required supplier dropdown
  - [x] Inventory list table: add "Supplier" column

- [x] Task IMP-A5: Tests — Data Integrity (6h)
  - [x] Recipe creation with valid `inventoryItemId` → success
  - [x] Recipe creation with invalid `inventoryItemId` → 400
  - [x] Recipe detail returns correct `calculatedCost`
  - [x] Production creation uses FK (no fuzzy match)
  - [x] Inventory creation without `supplierId` → 400
  - [x] Inventory creation with inactive supplier → 400
  - [x] Supplier delete with active inventory → 409
  - [x] Supplier delete with no inventory → success
  - [x] All existing 213 tests still pass

### Sprint IMP-B: Purchase Orders & Advanced Features (~40h)

- [x] Task IMP-B1: Database Migration — Purchase Orders (4h)
  - [x] Create `purchaseOrders` table (id, orderCode, supplierId FK, dates, status, totalCost, notes, createdBy FK)
  - [x] Create `purchaseOrderItems` table (id, purchaseOrderId FK, inventoryItemId FK, quantities, unitPrice, unit)
  - [x] PO status enum: draft, submitted, partially_received, received, cancelled
  - [x] Auto-generate PO code: `PO-YYYYMMDD-XXX`
  - [x] Indexes on status, supplierId, orderDate
  - [x] Generate migration `0005_purchase_orders.sql`

- [x] Task IMP-B2: Backend — Purchase Order CRUD + Receiving (12h)
  - [x] `GET /feed/purchase-orders` — list with pagination, status/supplier/date filters
  - [x] `GET /feed/purchase-orders/:id` — detail with line items + received %
  - [x] `POST /feed/purchase-orders` — create with auto-code, validate supplier + items
  - [x] `PUT /feed/purchase-orders/:id` — update (draft only), recalculate total
  - [x] `DELETE /feed/purchase-orders/:id` — delete (draft only)
  - [x] `PUT /feed/purchase-orders/:id/status` — submit (draft→submitted), cancel
  - [x] `POST /feed/purchase-orders/:id/receive` — receive items, auto-restock inventory
  - [x] On receive: create audit trail entry (changeType: purchase_receive)
  - [x] On receive: auto-transition PO status (partially_received or received)
  - [x] On receive: update inventory quantity, lastRestockDate, costPerUnit
  - [x] `GET /feed/suppliers/:id/purchase-orders` — PO history per supplier
  - [x] Block cancel if items already received
  - [x] Block receive on draft/cancelled POs
  - [x] Zod validators for all PO operations

- [x] Task IMP-B3: Frontend — Purchase Orders Tab & UI (10h)
  - [x] New "Purchase Orders" tab in FeedPage
  - [x] PO list table: orderCode, supplier, date, expectedDelivery, totalCost, status
  - [x] Status badge colors (draft=gray, submitted=blue, partial=yellow, received=green, cancelled=red)
  - [x] Status filter tabs, search by orderCode, date range
  - [x] Create PO dialog: select supplier → add line items from inventory → quantities + prices
  - [x] PO detail dialog/page: header info, line items table, receive per item, status buttons
  - [x] Receive dialog: enter received quantity per item, bulk receive option
  - [x] Reorder suggestions: "Create PO" button pre-fills supplier + items
  - [x] `usePurchaseOrders` hooks (list, detail, create, update, delete, status, receive)
  - [x] Mobile-responsive layout

- [x] Task IMP-B4: Dynamic Recipe Cost & Cost Optimization (6h)
  - [x] Recipe detail computes `calculatedCost` from ingredients × inventory costs
  - [x] Recipe list includes both manual `cost` and `calculatedCost`
  - [x] Cost optimization endpoint compares recipes against current inventory prices
  - [x] Returns: manual cost vs calculated cost, delta %, savings per recipe
  - [x] Production cost calculated from actual material costs at time of completion
  - [x] Frontend: recipe list shows cost comparison, delta > 10% highlighted
  - [x] Frontend: recipe detail shows cost breakdown table per ingredient

- [x] Task IMP-B5: Demand-Aware Reorder Suggestions (4h)
  - [x] Fetch planned + in_progress production batches (next 14 days)
  - [x] Calculate demand per inventory item from recipe ingredients × planned quantity
  - [x] New formula: `suggestedOrderQty = max(reorderLevel, qty + demand × 1.2) - qty`
  - [x] Response includes demand breakdown (which production batches, needed qty, date)
  - [x] Flag items with no supplier as "No supplier assigned"
  - [x] Frontend: show demand context on reorder card
  - [x] Frontend: expandable demand breakdown per suggestion

- [x] Task IMP-B6: Enhanced Audit Trail + Final Testing (4h)
  - [x] Production deductions include referenceType: production_batch + referenceId
  - [x] PO receives include referenceType: purchase_order + referenceId + notes
  - [x] Manual adjustments require notes
  - [x] Distribution deductions include referenceType: distribution + referenceId
  - [x] Audit trail filter by changeType and referenceType
  - [x] Frontend: clickable reference links in audit trail viewer
  - [x] PO tests: create, submit, receive, cancel, partial receive, validation errors
  - [x] Demand reorder tests: production demand included in calculations
  - [x] Cost calculation tests: calculatedCost matches expected values
  - [x] All tests pass (existing 213 + 30 new improvement tests = 243 total)

### Sprint IMP-C: UX Improvements

- [x] Task IMP-C1: Feed Tab Reorder (1h)
  - [x] Reorder tabs: Inventory → Recipes → Production → Distribution → Purchase Orders → Suppliers
  - [x] Change defaultValue from "suppliers" to "inventory"

- [x] Task IMP-C2: Specific Form Validation Errors (3h)
  - [x] Create `parseApiError(error, fallbackMessage)` utility in `lib/api.ts`
  - [x] Parse Zod validation field errors from backend `details.fieldErrors`
  - [x] Parse business logic error messages (e.g., "Supplier name already exists")
  - [x] Update all 18 catch blocks in FeedPage.tsx to use `parseApiError`
  - [x] Frontend compiles cleanly, all 243 backend tests pass

### Improvements Progress Summary

| Sprint | Tasks | Status | Completion |
|--------|-------|--------|------------|
| **Sprint IMP-A** | IMP-A1 to IMP-A6 | ✅ Complete | 100% |
| **Sprint IMP-B** | IMP-B1 to IMP-B6 | ✅ Complete | 100% |
| **Sprint IMP-C** | IMP-C1 to IMP-C2 | ✅ Complete | 100% |
| **Sprint IMP-D** | IMP-D1 to IMP-D2 | ✅ Complete | 100% |
| **Sprint IMP-E** | IMP-E1 | ✅ Complete | 100% |

---

### Sprint IMP-D: Recipe UX Improvements (New)

- [x] Task IMP-D1: Backend - Ingredient Summary (2h)
  - [x] Update `GET /recipes` to return aggregated ingredient string
- [x] Task IMP-D2: Frontend - Recipe Table & View (4h)
  - [x] Show ingredient summary in recipe table (line level)
  - [x] Add "View" button and read-only dialog
  - [x] Add Status dropdown to Edit Recipe form

### Sprint IMP-E: Quantity Impact Indicators (New)

- [x] Task IMP-E1: Feed Management Quantity Preview UX (4h)
  - [x] Inventory edit dialog shows quantity `before -> after` and signed delta
  - [x] Restock dialog shows projected stock after restock
  - [x] Complete production dialog shows per-material inventory deduction impact
  - [x] Distribution dialog shows linked production quantity impact before submit
  - [x] PO receive dialog shows per-line receive progression and stock increase preview
  - [x] Frontend build passes after implementation
  - [x] Frontend lint baseline unchanged (existing unrelated lint errors remain in other files)

---

### Remaining Work (Priority Order)
1. **Week 12**: Staging deployment (GCP Cloud Run + Firebase Hosting), UAT & sign-off
2. **Week 24**: Production deployment, data migration, documentation, go-live
3. **Cross-cutting**: Frontend unit tests, E2E tests, API docs
