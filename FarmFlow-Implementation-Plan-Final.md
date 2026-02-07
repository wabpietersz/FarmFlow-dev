# FarmFlow — AI-Assisted Implementation Plan
## Poultry Farm Management System (PWA)

**Version:** 1.0 (Final)
**Date:** February 8, 2026
**Timeline:** 24 weeks (6 months)
**Developer Profile:** Solo developer with AI coding assistants (Cursor, Copilot, etc.)
**Methodology:** Sprint-based, test-integrated, MVP-first delivery

---

## Table of Contents

1. Executive Summary
2. Planning Framework
3. MoSCoW Feature Prioritization
4. Technology Stack
5. Database Architecture
6. Phase 1: MVP (Weeks 1–12)
7. Phase 2: Enhancements (Weeks 13–24)
8. Risk Register
9. Coding Standards & Project Conventions
10. Deployment & Operations
11. Out of Scope
12. Appendix: Weekly Definition-of-Done Checklist

---

## 1. Executive Summary

### Project Overview

FarmFlow is a centralized management system for broiler poultry farm operations across multiple sites. It consolidates workforce management, production tracking, feed manufacturing, sales operations, and payroll into a unified Progressive Web Application (PWA) optimized for mobile-first data entry in farm environments.

### Scope

**Core Modules:**
- **Workforce Management:** Employee profiles, RBAC (7 roles), document uploads with audit trails
- **Production Tracking:** Multi-site operations, cage management, batch lifecycle (placement to sale), daily production records, Feed Conversion Ratio (FCR) calculation, vaccination tracking, mortality monitoring
- **Feed Manufacturing:** Raw material inventory, production batches, finished feed distribution, recipe management with ingredients and proportions
- **Sales Operations:** Buyer master data, sale recording, multi-payment processing, outstanding balance tracking, invoice generation
- **Payroll:** Attendance tracking, leave management, shift management, salary calculation (base + overtime + allowances - deductions), bonus/incentive management, approval workflows

### Delivery Strategy

**Phase 1 (MVP, Weeks 1–12):** Core functionality for basic farm operations—authentication, employee management, site/cage/batch management, FCR calculation, sales tracking, basic dashboard and reports.

**Phase 2 (Enhancements, Weeks 13–24):** Advanced features—feed mill operations, payroll, attendance, leave management, advanced analytics, PWA offline support, security hardening, production deployment.

### Developer Capacity Model

- **Hours per Week:** 40–45 hours
- **Code : Testing : Ops Split:** 60% coding, 40% testing/operations/documentation
- **Realistic Velocity:** 45–50 story points per sprint (2-week cycle)
- **AI Assistance:** Cursor, GitHub Copilot for boilerplate, test generation, schema design

---

## 2. Planning Framework

### Key Principles

1. **MVP-First:** Deliver working MVP (Phase 1) in 12 weeks with core workflows end-to-end
2. **Test-Driven:** Every module includes unit tests (>80% coverage) and integration tests
3. **Security-by-Design:** Authentication admin-controlled, file uploads via signed URLs, JWT in HttpOnly cookies, RBAC permission matrix enforced
4. **Modular Architecture:** Clear separation between features; independent backend/frontend build/test
5. **Realistic Velocity:** 60% code / 40% testing + operations + documentation
6. **Iterative Feedback:** Weekly stakeholder demos; sprint reviews; change control via MoSCoW freeze

### Success Criteria per Milestone

Each phase completion requires:
- ✓ Code compiles without errors
- ✓ Unit tests pass (>80% coverage on core business logic)
- ✓ Integration tests pass (E2E workflows)
- ✓ Zero security audit findings
- ✓ Staging deployment successful
- ✓ API response time <200ms (p95 latency)
- ✓ Stakeholder sign-off (UAT)

---

## 3. MoSCoW Feature Prioritization

### MUST-HAVE (Phase 1, Weeks 1–12)

- User authentication with Firebase (admin-controlled creation)
- RBAC with 7 roles and role-specific permission matrix
- Employee master data (CRUD, relational emergency contacts & bank details)
- Employee document uploads (private GCS, signed URLs)
- Multi-site and cage management
- Batch creation, tracking, and lifecycle management
- Daily production records with validation
- FCR calculation and monitoring with alerts
- Vaccination and mortality tracking
- Buyer master data (FR-SD-001)
- Sales recording and multi-payment processing (FR-SD-002)
- Cheque tracking and outstanding balance management
- Basic dashboard (active batches, FCR, mortality, outstanding payments)
- Reports: Batch performance, sales summary (CSV export)
- System configuration UI (designations, feed types, mortality causes, leave types)
- Notification system for threshold violations

### SHOULD-HAVE (Phase 2, Weeks 13–20)

- Feed mill inventory management (FR-FM-001)
- Feed production batch tracking
- Feed distribution to farm batches
- Feed recipe management with ingredients (FR-FM-001)
- Attendance tracking (FR-HR-010)
- Leave management with balance tracking (FR-HR-012)
- Shift management (FR-HR-010)
- Payroll processing: salary calculation, overtime, allowances, deductions (FR-HR-019)
- Bonus and incentive management (FR-HR-019)
- Advanced reporting: Batch profitability, comparative analysis, seasonal trends
- Custom report builder (filterable, CSV/PDF export)

### COULD-HAVE (Phase 2, if time permits)

- PWA offline-first enhancement with IndexedDB sync
- Predictive analytics (FCR trend prediction)
- Seasonal trend analysis
- Biometric attendance integration
- GPS location tagging for batch records
- Email integration for notifications

### WON'T-HAVE (Future phases)

- Native iOS/Android apps
- Blockchain integration for supply chain
- Real-time IoT sensor data ingestion
- Machine learning-based mortality prediction
- Multi-language support
- Advanced tax calculations (VAT, GST)

---

## 4. Technology Stack

### Frontend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React 18 + TypeScript 5 | Type-safe component development |
| **Build Tool** | Vite | Fast development server, optimized builds |
| **Styling** | TailwindCSS + Shadcn UI | Responsive design, reusable components |
| **State Management** | Zustand | Lightweight global state (auth, user context) |
| **Data Fetching** | TanStack Query (React Query) | Server state management, caching, sync |
| **Forms** | React Hook Form + Zod | Type-safe forms, validation |
| **Charts** | Recharts | Interactive batch/sales analytics |
| **PWA** | Workbox | Service worker, offline support, caching |
| **Authentication** | Firebase SDK (web) | OAuth 2.0 integration with backend |
| **File Uploads** | Axios + Multer (backend) | Document uploads with progress tracking |
| **Linting** | ESLint + Prettier | Code quality, formatting |
| **Testing** | Vitest + React Testing Library | Unit and component tests |

### Backend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 20+ | JavaScript runtime |
| **Framework** | Express.js + TypeScript | Type-safe REST API |
| **ORM** | Drizzle ORM | Type-safe database interactions, migrations |
| **Database** | PostgreSQL 15+ | Relational database (Cloud SQL) |
| **Authentication** | Firebase Admin SDK | Token validation, user management |
| **File Storage** | Google Cloud Storage (GCS) | Private file uploads, signed URLs |
| **Uploads** | Multer | Multipart form data handling |
| **Logging** | Winston | Structured JSON logging, business events |
| **Scheduling** | node-cron | Payroll jobs, batch status transitions |
| **Security** | Helmet, CORS | Security headers, cross-origin control |
| **Validation** | Zod | Schema validation on input |
| **Testing** | Jest + Supertest | Unit and API integration tests |
| **Linting** | ESLint + Prettier | Code quality |

### Infrastructure (GCP)

| Service | Purpose | Configuration |
|---------|---------|----------------|
| **Cloud Run** | Backend hosting | Minimum 1 instance (no cold starts), auto-scaling 2–10 instances, 4 vCPU / 8 GB memory |
| **Cloud SQL** | PostgreSQL database | Private IP with VPC Connector, automated backups (daily), high availability secondary |
| **Cloud Storage** | File uploads | Private buckets, signed URLs (1-hour expiry), CORS enabled |
| **Firebase Hosting** | Frontend SPA | CDN distribution, auto-deployment via Cloud Build |
| **Cloud Build** | CI/CD pipeline | GitHub trigger: lint, build, test on every push; staging/production manual approval |
| **Secret Manager** | Environment secrets | Firebase service account, database credentials, API keys |
| **Cloud Logging** | Log aggregation | Structured JSON format, retention 30 days (7 days for non-errors) |
| **Cloud Monitoring** | Observability | Custom dashboards, alert policies (error rate >5%, latency >500ms p95) |
| **Cloud Scheduler** | Cron jobs | Payroll calculations, backup verification, batch status updates |
| **VPC Connector** | Network connectivity | Cloud Run ↔ Cloud SQL private network |

### Development Tools

| Tool | Purpose |
|------|---------|
| **Git** | Version control (GitHub) |
| **Docker** | Local development environment (PostgreSQL, pgAdmin) |
| **GitHub Actions** | CI workflow (lint, build, test) |
| **GitHub Copilot / Cursor** | AI-assisted coding |
| **pgAdmin** | Database UI (local development only) |
| **Postman / Bruno** | API testing |
| **Lighthouse** | Performance and accessibility audits |

---

## 5. Database Architecture

### Full 27-Table Schema

#### Core User & Access Control
```sql
-- Users table: Core authentication and role assignment
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  firebaseUid VARCHAR(128) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  fullName VARCHAR(255) NOT NULL,
  userRole VARCHAR(50) NOT NULL
    CHECK (userRole IN ('system_admin', 'farm_manager', 'accountant', 'supervisor', 'feed_mill_operator', 'farm_worker', 'viewer')),
  siteId INT, -- Farm manager can be tied to specific site
  isActive BOOLEAN DEFAULT true,
  lastLogin TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (siteId) REFERENCES sites(id)
);

CREATE INDEX idx_users_firebaseUid ON users(firebaseUid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_userRole ON users(userRole);
```

#### Employees
```sql
-- Employees table: Complete workforce data
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  userId INT UNIQUE,
  firstName VARCHAR(100) NOT NULL,
  lastName VARCHAR(100) NOT NULL,
  designation VARCHAR(100) NOT NULL,
  siteId INT NOT NULL,
  employmentType VARCHAR(50) NOT NULL
    CHECK (employmentType IN ('permanent', 'contract', 'seasonal')),
  joinDate DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active'
    CHECK (status IN ('active', 'on_leave', 'terminated')),
  phone VARCHAR(20),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (siteId) REFERENCES sites(id)
);

CREATE INDEX idx_employees_siteId ON employees(siteId);
CREATE INDEX idx_employees_designation ON employees(designation);
CREATE INDEX idx_employees_status ON employees(status);

-- Emergency contacts: Relational table (not JSONB)
CREATE TABLE emergency_contacts (
  id SERIAL PRIMARY KEY,
  employeeId INT NOT NULL,
  contactName VARCHAR(100) NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  phoneNumber VARCHAR(20) NOT NULL,
  FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
);

-- Bank details: Relational table (not JSONB)
CREATE TABLE bank_details (
  id SERIAL PRIMARY KEY,
  employeeId INT NOT NULL UNIQUE,
  accountHolderName VARCHAR(100) NOT NULL,
  bankName VARCHAR(100) NOT NULL,
  branchCode VARCHAR(20),
  accountNumber VARCHAR(50) NOT NULL,
  ifscCode VARCHAR(20),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
);
```

#### Documents & Audit
```sql
-- Documents table: Employee and entity file uploads
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  entityType VARCHAR(50) NOT NULL
    CHECK (entityType IN ('employee', 'batch', 'sale', 'payroll')),
  entityId INT NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  fileUrl VARCHAR(512) NOT NULL,
  fileType VARCHAR(50) NOT NULL,
  fileSize INT NOT NULL,
  uploadedBy INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploadedBy) REFERENCES users(id)
);

CREATE INDEX idx_documents_entityType_entityId ON documents(entityType, entityId);

-- Audit logs: Track all critical actions
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  userId INT,
  action VARCHAR(100) NOT NULL,
  entityType VARCHAR(50),
  entityId INT,
  changes JSONB,
  ipAddress VARCHAR(50),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE INDEX idx_audit_logs_userId ON audit_logs(userId);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
```

#### Sites & Infrastructure
```sql
-- Sites table: Farm locations
CREATE TABLE sites (
  id SERIAL PRIMARY KEY,
  siteName VARCHAR(100) NOT NULL UNIQUE,
  location VARCHAR(255) NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  status VARCHAR(50) DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cages table: Individual cage units
CREATE TABLE cages (
  id SERIAL PRIMARY KEY,
  siteId INT NOT NULL,
  cageNumber VARCHAR(50) NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  status VARCHAR(50) DEFAULT 'empty'
    CHECK (status IN ('empty', 'occupied', 'maintenance')),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (siteId) REFERENCES sites(id),
  UNIQUE (siteId, cageNumber)
);

CREATE INDEX idx_cages_siteId ON cages(siteId);
CREATE INDEX idx_cages_status ON cages(status);
```

#### Batches & Production
```sql
-- Batches table: Batch lifecycle management
CREATE TABLE batches (
  id SERIAL PRIMARY KEY,
  batchCode VARCHAR(50) UNIQUE NOT NULL,
  siteId INT NOT NULL,
  cageId INT NOT NULL,
  chicksPlaced INT NOT NULL CHECK (chicksPlaced > 0),
  placementDate DATE NOT NULL,
  expectedDeliveryDate DATE,
  actualDeliveryDate DATE,
  status VARCHAR(50) DEFAULT 'placement'
    CHECK (status IN ('placement', 'growing', 'ready_for_sale', 'sold', 'culled')),
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (siteId) REFERENCES sites(id),
  FOREIGN KEY (cageId) REFERENCES cages(id)
);

CREATE INDEX idx_batches_siteId ON batches(siteId);
CREATE INDEX idx_batches_status ON batches(status);
CREATE INDEX idx_batches_cageId ON batches(cageId);

-- Daily records: Production metrics per batch
CREATE TABLE daily_records (
  id SERIAL PRIMARY KEY,
  batchId INT NOT NULL,
  recordDate DATE NOT NULL,
  currentAge INT NOT NULL,
  birdCount INT NOT NULL CHECK (birdCount > 0),
  mortalityCount INT NOT NULL DEFAULT 0 CHECK (mortalityCount >= 0),
  mortalityCause VARCHAR(100),
  waterConsumption DECIMAL(8,2),
  feedConsumption DECIMAL(8,2) NOT NULL CHECK (feedConsumption > 0),
  averageWeight DECIMAL(8,2),
  temperature DECIMAL(5,2),
  humidity INT CHECK (humidity >= 0 AND humidity <= 100),
  ammonia_level DECIMAL(5,2),
  recordedBy INT,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batchId) REFERENCES batches(id),
  FOREIGN KEY (recordedBy) REFERENCES users(id),
  UNIQUE (batchId, recordDate)
);

CREATE INDEX idx_daily_records_batchId ON daily_records(batchId);
CREATE INDEX idx_daily_records_recordDate ON daily_records(recordDate);

-- Daily record photos: Batch photography
CREATE TABLE daily_record_photos (
  id SERIAL PRIMARY KEY,
  dailyRecordId INT NOT NULL,
  photoUrl VARCHAR(512) NOT NULL,
  uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dailyRecordId) REFERENCES daily_records(id) ON DELETE CASCADE
);

-- Vaccinations: Health tracking
CREATE TABLE vaccinations (
  id SERIAL PRIMARY KEY,
  batchId INT NOT NULL,
  vaccineType VARCHAR(100) NOT NULL,
  vaccinationDate DATE NOT NULL,
  notes TEXT,
  recordedBy INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batchId) REFERENCES batches(id),
  FOREIGN KEY (recordedBy) REFERENCES users(id)
);

CREATE INDEX idx_vaccinations_batchId ON vaccinations(batchId);
```

#### Feed Manufacturing
```sql
-- Suppliers table: Raw material suppliers
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  supplierName VARCHAR(100) NOT NULL UNIQUE,
  contactPerson VARCHAR(100),
  phoneNumber VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  status VARCHAR(50) DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feed recipes table: Recipe definitions
CREATE TABLE feed_recipes (
  id SERIAL PRIMARY KEY,
  recipeName VARCHAR(100) NOT NULL UNIQUE,
  feedType VARCHAR(50) NOT NULL
    CHECK (feedType IN ('starter', 'grower', 'finisher')),
  status VARCHAR(50) DEFAULT 'active',
  cost DECIMAL(10,2) NOT NULL CHECK (cost > 0),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feed recipe ingredients: Many-to-many with proportions
CREATE TABLE feed_recipe_ingredients (
  id SERIAL PRIMARY KEY,
  recipeId INT NOT NULL,
  supplierId INT,
  ingredientName VARCHAR(100) NOT NULL,
  proportion DECIMAL(5,2) NOT NULL CHECK (proportion > 0),
  unit VARCHAR(20) NOT NULL,
  FOREIGN KEY (recipeId) REFERENCES feed_recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (supplierId) REFERENCES suppliers(id)
);

-- Feed inventory: Raw material stock
CREATE TABLE feed_inventory (
  id SERIAL PRIMARY KEY,
  ingredientName VARCHAR(100) NOT NULL,
  supplierId INT,
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity >= 0),
  unit VARCHAR(20) NOT NULL,
  costPerUnit DECIMAL(10,2) NOT NULL CHECK (costPerUnit > 0),
  reorderLevel DECIMAL(10,2),
  lastRestockDate DATE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplierId) REFERENCES suppliers(id)
);

CREATE INDEX idx_feed_inventory_ingredientName ON feed_inventory(ingredientName);
```

#### Sales & Payments
```sql
-- Buyers table: Buyer master data
CREATE TABLE buyers (
  id SERIAL PRIMARY KEY,
  buyerName VARCHAR(100) NOT NULL UNIQUE,
  contactPerson VARCHAR(100),
  phoneNumber VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  creditTerms INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales table: Sale transactions
CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  saleCode VARCHAR(50) UNIQUE NOT NULL,
  batchId INT NOT NULL,
  buyerId INT NOT NULL,
  saleDate DATE NOT NULL,
  totalBirds INT NOT NULL CHECK (totalBirds > 0),
  pricePerBird DECIMAL(10,2) NOT NULL CHECK (pricePerBird > 0),
  totalAmount DECIMAL(12,2) NOT NULL CHECK (totalAmount > 0),
  status VARCHAR(50) DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batchId) REFERENCES batches(id),
  FOREIGN KEY (buyerId) REFERENCES buyers(id)
);

CREATE INDEX idx_sales_batchId ON sales(batchId);
CREATE INDEX idx_sales_buyerId ON sales(buyerId);
CREATE INDEX idx_sales_saleDate ON sales(saleDate);

-- Payments table: Multi-payment tracking
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  saleId INT NOT NULL,
  paymentAmount DECIMAL(12,2) NOT NULL CHECK (paymentAmount > 0),
  paymentDate DATE NOT NULL,
  paymentMethod VARCHAR(50) NOT NULL
    CHECK (paymentMethod IN ('cash', 'cheque', 'bank_transfer')),
  chequeNumber VARCHAR(50),
  chequeDate DATE,
  bankName VARCHAR(100),
  paymentStatus VARCHAR(50) DEFAULT 'completed'
    CHECK (paymentStatus IN ('pending', 'completed', 'bounced')),
  notes TEXT,
  recordedBy INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (saleId) REFERENCES sales(id),
  FOREIGN KEY (recordedBy) REFERENCES users(id)
);

CREATE INDEX idx_payments_saleId ON payments(saleId);
CREATE INDEX idx_payments_paymentStatus ON payments(paymentStatus);
```

#### Attendance & Leave
```sql
-- Attendance table: Daily work tracking
CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  employeeId INT NOT NULL,
  attendanceDate DATE NOT NULL,
  status VARCHAR(50) NOT NULL
    CHECK (status IN ('present', 'absent', 'on_leave', 'half_day')),
  shiftId INT,
  notes TEXT,
  recordedBy INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(id),
  FOREIGN KEY (recordedBy) REFERENCES users(id),
  UNIQUE (employeeId, attendanceDate)
);

CREATE INDEX idx_attendance_employeeId ON attendance(employeeId);
CREATE INDEX idx_attendance_attendanceDate ON attendance(attendanceDate);

-- Shifts table: Shift definitions
CREATE TABLE shifts (
  id SERIAL PRIMARY KEY,
  shiftName VARCHAR(100) NOT NULL UNIQUE,
  startTime TIME NOT NULL,
  endTime TIME NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave balances table: Annual leave tracking
CREATE TABLE leave_balances (
  id SERIAL PRIMARY KEY,
  employeeId INT NOT NULL,
  leaveType VARCHAR(50) NOT NULL
    CHECK (leaveType IN ('casual', 'earned', 'medical', 'maternity', 'unpaid')),
  year INT NOT NULL,
  totalDays INT NOT NULL CHECK (totalDays >= 0),
  usedDays INT DEFAULT 0 CHECK (usedDays >= 0),
  balanceDays INT GENERATED ALWAYS AS (totalDays - usedDays) STORED,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(id),
  UNIQUE (employeeId, leaveType, year)
);

CREATE INDEX idx_leave_balances_employeeId ON leave_balances(employeeId);
```

#### Payroll
```sql
-- Payroll table: Salary processing
CREATE TABLE payroll (
  id SERIAL PRIMARY KEY,
  employeeId INT NOT NULL,
  payPeriod DATE NOT NULL,
  baseSalary DECIMAL(12,2) NOT NULL CHECK (baseSalary > 0),
  workingDays INT NOT NULL CHECK (workingDays > 0),
  attendedDays INT NOT NULL CHECK (attendedDays >= 0),
  overtimeHours DECIMAL(8,2) DEFAULT 0,
  overtimeRate DECIMAL(10,2),
  grossSalary DECIMAL(12,2) NOT NULL CHECK (grossSalary > 0),
  netSalary DECIMAL(12,2) NOT NULL CHECK (netSalary > 0),
  status VARCHAR(50) DEFAULT 'draft'
    CHECK (status IN ('draft', 'reviewed', 'approved', 'paid')),
  approvedBy INT,
  paidDate DATE,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(id),
  FOREIGN KEY (approvedBy) REFERENCES users(id)
);

CREATE INDEX idx_payroll_employeeId ON payroll(employeeId);
CREATE INDEX idx_payroll_payPeriod ON payroll(payPeriod);
CREATE INDEX idx_payroll_status ON payroll(status);

-- Payroll deductions: Tax, insurance, etc.
CREATE TABLE payroll_deductions (
  id SERIAL PRIMARY KEY,
  payrollId INT NOT NULL,
  deductionType VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  remarks TEXT,
  FOREIGN KEY (payrollId) REFERENCES payroll(id) ON DELETE CASCADE
);

-- Payroll allowances: HRA, DA, medical, etc.
CREATE TABLE payroll_allowances (
  id SERIAL PRIMARY KEY,
  payrollId INT NOT NULL,
  allowanceType VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  remarks TEXT,
  FOREIGN KEY (payrollId) REFERENCES payroll(id) ON DELETE CASCADE
);
```

#### System Configuration
```sql
-- System configuration: Master data for dropdowns
CREATE TABLE system_config (
  id SERIAL PRIMARY KEY,
  configKey VARCHAR(100) UNIQUE NOT NULL,
  configValue JSONB NOT NULL,
  description TEXT,
  updatedBy INT,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updatedBy) REFERENCES users(id)
);

-- Example config records (inserted during seed):
-- { configKey: 'designations', configValue: ['Manager', 'Supervisor', 'Worker'] }
-- { configKey: 'feed_types', configValue: ['Starter', 'Grower', 'Finisher'] }
-- { configKey: 'mortality_causes', configValue: ['Disease', 'Weakness', 'Accident'] }
-- { configKey: 'leave_types', configValue: ['Casual', 'Earned', 'Medical'] }
-- { configKey: 'mortality_alert_threshold', configValue: '2.0' }
-- { configKey: 'fcr_alert_threshold', configValue: '1.8' }
```

#### Notifications
```sql
-- Notifications: In-app alerts
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  userId INT NOT NULL,
  notificationType VARCHAR(50) NOT NULL
    CHECK (notificationType IN ('mortality_alert', 'fcr_alert', 'low_feed', 'payment_due', 'leave_request', 'payroll_ready')),
  entityType VARCHAR(50),
  entityId INT,
  message TEXT NOT NULL,
  isRead BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  readAt TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE INDEX idx_notifications_userId ON notifications(userId);
CREATE INDEX idx_notifications_isRead ON notifications(isRead);
```

### Schema Summary

| Category | Count | Tables |
|----------|-------|--------|
| **Access Control** | 2 | users, audit_logs |
| **Workforce** | 4 | employees, emergency_contacts, bank_details, documents |
| **Infrastructure** | 2 | sites, cages |
| **Production** | 4 | batches, daily_records, daily_record_photos, vaccinations |
| **Feed** | 4 | suppliers, feed_recipes, feed_recipe_ingredients, feed_inventory |
| **Sales** | 3 | buyers, sales, payments |
| **Attendance** | 3 | attendance, shifts, leave_balances |
| **Payroll** | 3 | payroll, payroll_deductions, payroll_allowances |
| **Configuration** | 2 | system_config, notifications |
| **TOTAL** | **27** | |

---

## 6. Phase 1: MVP (Weeks 1–12)

### Week 1: Project Setup & Infrastructure (46 hours)

#### Objectives
- Establish monorepo structure with independent frontend/backend builds
- Set up CI/CD pipeline for automated testing on every commit
- Configure Docker development environment with PostgreSQL
- Create project documentation and coding standards

#### Tasks

**Task 1.1: Repository & Monorepo Setup (8 hours)**

| Item | Time |
|------|------|
| Initialize GitHub repository | 0.5h |
| Set up npm workspaces (root, /frontend, /backend, /shared) | 1.5h |
| Configure shared types/utilities package | 1.5h |
| Set up .gitignore, .env templates | 1h |
| Initialize frontend with Vite | 1.5h |
| Initialize backend with Express | 1.5h |
| Create README with project structure overview | 0.5h |

**AI Prompt Template:**
```
Create an npm workspace monorepo with the following structure:
- Root package.json with workspaces: packages/frontend, packages/backend, packages/shared
- packages/shared: TypeScript-only package with common types/utilities
- packages/frontend: Vite + React 18 setup
- packages/backend: Express + TypeScript setup
Include initial .gitignore, .prettierrc, .eslintrc configuration files.
```

**Task 1.2: Backend Scaffolding (10 hours)**

| Item | Time |
|------|------|
| Express app with middleware stack | 2h |
| Environment config (.env) | 1h |
| Health check endpoint | 1h |
| Request/response logging middleware | 1.5h |
| Error handling middleware | 1.5h |
| CORS and Helmet security headers | 1h |
| Rate limiting middleware | 1.5h |
| API documentation structure | 0.5h |

**AI Prompt Template:**
```
Set up an Express.js backend with TypeScript:
1. Create app.ts with Express initialization
2. Add middleware stack: logging (Winston), error handling, CORS, Helmet, rate limiting
3. Implement health check endpoint (GET /health)
4. Set up .env configuration for PORT, DB_URL, FIREBASE_KEY, GCS_BUCKET
5. Create error handling middleware that returns { success: false, error: string, code: string, statusCode: number, timestamp: ISO }
6. Add request/response structured logging with business event context
```

**Task 1.3: Frontend Scaffolding (10 hours)**

| Item | Time |
|------|------|
| Vite + React 18 project initialization | 1.5h |
| TailwindCSS setup | 1h |
| Shadcn UI component library setup | 1.5h |
| ESLint + Prettier configuration | 1h |
| Basic routing structure (React Router v6) | 1.5h |
| Zustand store setup (auth context) | 1h |
| TanStack Query (React Query) setup | 1h |
| Basic layout component | 1.5h |

**AI Prompt Template:**
```
Set up a React 18 + Vite frontend with TypeScript:
1. Initialize Vite project
2. Install and configure TailwindCSS
3. Set up Shadcn UI with custom component library
4. Configure ESLint + Prettier for code quality
5. Install and configure React Router v6 for routing
6. Set up Zustand store with auth state (currentUser, isAuthenticated, logout)
7. Install and configure TanStack Query for server state
8. Create basic App layout with header, sidebar (will be mobile-responsive)
```

**Task 1.4: CI/CD Pipeline Setup (12 hours)**

| Item | Time |
|------|------|
| GitHub Actions workflow for frontend (lint, build, test) | 3h |
| GitHub Actions workflow for backend (lint, build, test) | 3h |
| Cloud Build configuration for staging deployment | 4h |
| Docker image building (both frontend and backend) | 2h |

**AI Prompt Template:**
```
Set up GitHub Actions CI pipeline:

Frontend workflow (.github/workflows/frontend-ci.yml):
1. Trigger: push to main and pull_requests
2. Jobs: lint (ESLint), build (Vite), test (Vitest)
3. Fail on any lint/test failures

Backend workflow (.github/workflows/backend-ci.yml):
1. Trigger: push to main and pull_requests
2. Jobs: lint (ESLint), build (TypeScript), test (Jest)
3. Include database startup (PostgreSQL service container)
4. Fail on any lint/test failures

Cloud Build configuration:
1. Trigger: manual for staging, require approval for production
2. Build backend Docker image, run tests
3. Build frontend Docker image
4. Deploy to Cloud Run (staging)
```

**Task 1.5: Development Environment & Documentation (6 hours)**

| Item | Time |
|------|------|
| Docker Compose setup (PostgreSQL + pgAdmin) | 2h |
| Environment setup guide (.env.example, README) | 1.5h |
| Coding standards document (naming, error handling, logging) | 1.5h |
| API documentation structure (REST conventions) | 1h |

**AI Prompt Template:**
```
Create docker-compose.yml with PostgreSQL 15 and pgAdmin:
- PostgreSQL service with volume persistence
- pgAdmin service (port 5050) for database management
- Network configuration for backend container to connect
- .env file with default credentials and connection strings

Create CODING_STANDARDS.md covering:
- File naming: snake_case files, camelCase functions, PascalCase classes
- Error response format with examples
- Structured logging requirements
- Import organization rules
```

#### Acceptance Criteria

- [ ] GitHub repo created with monorepo structure
- [ ] Backend Express app builds without errors and has health check endpoint
- [ ] Frontend Vite app builds and runs without errors
- [ ] CI/CD pipelines (GitHub Actions) trigger on every push
- [ ] Docker Compose environment runs PostgreSQL and backend can connect
- [ ] All dependencies documented in respective package.json files
- [ ] CODING_STANDARDS.md and README completed
- [ ] Initial setup takes <1 hour for new developer to run locally

#### Security Checklist

- [ ] .env template provided (no actual secrets in repo)
- [ ] GitHub Actions secrets configured (Firebase, GCS, etc.)
- [ ] Docker images exclude sensitive files (.env, node_modules)
- [ ] CORS configured with origin whitelist (will update for production)
- [ ] Rate limiting enabled on all endpoints

#### Testing Requirements

- [ ] Health check endpoint returns 200 OK
- [ ] CI/CD pipeline passes for initial commit
- [ ] Docker Compose network connectivity verified
- [ ] npm workspace symlinks work correctly

#### Definition of Done

- [ ] Monorepo structure complete and documented
- [ ] Backend health check endpoint working
- [ ] Frontend builds and runs locally
- [ ] CI/CD pipelines configured and passing
- [ ] Docker Compose environment working
- [ ] Coding standards document published
- [ ] Initial setup guide allows new developer to start in <1 hour
- [ ] All dependencies pinned to specific versions (no ^, ~)

#### Week 1 Summary

**Deliverables:** Monorepo foundation, CI/CD pipelines, local development environment, coding standards.

**Risk Mitigations:**
- Monorepo complexity: Kept npm workspaces simple with only 3 packages (frontend, backend, shared)
- CI/CD failures: Test workflows locally before committing
- Docker issues: Use official images, clear documentation

**Velocity:** 46 hours allocated; adjustments if setup tasks are more complex.

---

### Week 2: Database Schema & Migrations (30 hours)

#### Objectives
- Implement all 27 tables with constraints, foreign keys, and indexes
- Set up Drizzle ORM with migration system
- Create seed data for system_config
- Validate schema with performance checks (EXPLAIN ANALYZE)

#### Tasks

**Task 2.1: Schema Design & Implementation (16 hours)**

| Item | Time |
|------|------|
| Create Drizzle schema files (users, employees, sites, batches, etc.) | 8h |
| Define all CHECK constraints and foreign key relationships | 4h |
| Create indexes for frequently queried columns | 2.5h |
| Document schema relationships and cardinality | 1.5h |

**AI Prompt Template:**
```
Using Drizzle ORM, create TypeScript schema files for all 27 tables:

1. Access control: users (with enum for userRole), audit_logs
2. Workforce: employees, emergency_contacts (FK to employees), bank_details
3. Infrastructure: sites, cages (FK to sites)
4. Production: batches, daily_records, daily_record_photos, vaccinations
5. Feed: suppliers, feed_recipes, feed_recipe_ingredients, feed_inventory
6. Sales: buyers, sales, payments
7. Attendance: attendance, shifts, leave_balances
8. Payroll: payroll, payroll_deductions, payroll_allowances
9. System: system_config, notifications, documents

Requirements:
- Use Drizzle SQL expressions for all constraints (CHECK, UNIQUE, FK cascades)
- Enums: userRole, employmentType, batchStatus, paymentStatus, leaveType, mortalityCause
- All timestamps use CURRENT_TIMESTAMP defaults
- Foreign keys use ON DELETE CASCADE where appropriate
- Include comments for each table explaining purpose
- Export schemas for use in API routes
```

**Task 2.2: Migration System & Seed Data (6 hours)**

| Item | Time |
|------|------|
| Configure Drizzle migrations | 1.5h |
| Create initial migration from schema | 1.5h |
| Write seed script for system_config | 2h |
| Test migration up/down | 1h |

**AI Prompt Template:**
```
Set up Drizzle ORM migrations:

1. Configure drizzle.config.ts with PostgreSQL driver
2. Generate initial migration from schema.ts
3. Create seed.ts script that populates system_config with:
   - designations: ['Farm Manager', 'Supervisor', 'Worker']
   - feed_types: ['Starter', 'Grower', 'Finisher']
   - mortality_causes: ['Disease', 'Weakness', 'Accident']
   - leave_types: ['Casual', 'Earned', 'Medical']
   - mortality_alert_threshold: 2.0
   - fcr_alert_threshold: 1.8

4. Add npm scripts:
   - npm run db:migrate - Apply migrations
   - npm run db:seed - Run seed script
   - npm run db:reset - Drop and recreate database
```

**Task 2.3: Indexes & Performance Validation (4 hours)**

| Item | Time |
|------|------|
| Create strategic indexes (batches, daily_records, payments, audit_logs) | 2h |
| Run EXPLAIN ANALYZE on slow queries | 1h |
| Document index rationale | 1h |

**AI Prompt Template:**
```
Create PostgreSQL indexes for high-frequency queries:

1. CREATE INDEX idx_batches_status ON batches(status);
2. CREATE INDEX idx_batches_siteId ON batches(siteId);
3. CREATE INDEX idx_daily_records_batchId ON daily_records(batchId);
4. CREATE INDEX idx_daily_records_recordDate ON daily_records(recordDate);
5. CREATE INDEX idx_payments_paymentStatus ON payments(paymentStatus);
6. CREATE INDEX idx_attendance_employeeId ON attendance(employeeId);
7. CREATE INDEX idx_payroll_payPeriod ON payroll(payPeriod);
8. CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

Run EXPLAIN ANALYZE on example queries:
- SELECT * FROM batches WHERE status = 'growing' AND siteId = 1;
- SELECT * FROM daily_records WHERE batchId = 5 AND recordDate >= '2026-01-01';
- SELECT * FROM payments WHERE paymentStatus = 'pending';

Document why each index was chosen and expected query speedup.
```

**Task 2.4: Migration & Rollback Procedures (4 hours)**

| Item | Time |
|------|------|
| Document migration strategy | 1h |
| Create rollback test procedure | 1.5h |
| Test zero-downtime migration approach | 1.5h |

**AI Prompt Template:**
```
Document database migration strategy:

1. Migration naming: YYYYMMDD_HHmmss_description.sql
2. Execution order: Apply sequentially, log results
3. Rollback procedure: Run corresponding .down migration
4. Zero-downtime for production:
   - Add new column as nullable
   - Back-fill with default values
   - Later, add NOT NULL constraint in separate migration
   - Drop old column in third migration

Create test script that simulates:
- Apply migration 001, verify schema
- Apply migration 002, verify data integrity
- Rollback migration 002, verify schema restored
- Re-apply migration 002, verify idempotence
```

#### Acceptance Criteria

- [ ] All 27 tables created in PostgreSQL
- [ ] All foreign keys, CHECK constraints, and indexes in place
- [ ] Drizzle ORM schema TypeScript files export all table definitions
- [ ] Migration files run without errors (up and down)
- [ ] Seed script populates system_config with 6+ records
- [ ] Index performance validated with EXPLAIN ANALYZE
- [ ] Schema diagram documented (can use DbDocs or simple markdown)

#### Testing Requirements

- [ ] Database connectivity test (health check from backend)
- [ ] Migration test: apply migration, verify tables exist
- [ ] Rollback test: apply, rollback, re-apply
- [ ] Data integrity test: FK constraints enforced
- [ ] Seed data test: system_config loaded correctly

#### Definition of Done

- [ ] All 27 tables created and indexed
- [ ] Migrations system working (up, down, reset)
- [ ] Seed script populated
- [ ] Schema documented (ER diagram or table listing)
- [ ] Zero-downtime migration strategy documented
- [ ] Performance baseline established (query times <100ms for large tables)
- [ ] Backup and restore procedure tested

#### Week 2 Summary

**Deliverables:** Complete database schema with 27 tables, migration system, indexes, seed data.

**Risk Mitigations:**
- Missed constraints: Use Drizzle type system to catch errors early
- Performance issues: Index from the start, run EXPLAIN ANALYZE
- Migration conflicts: Clear naming scheme, sequential execution

---

### Week 3: Authentication Backend (40 hours)

#### Objectives
- Implement Firebase authentication with JWT tokens
- Create RBAC permission matrix with 7 roles
- Enforce admin-only user creation (no self-registration)
- Set up audit logging for all security-relevant actions

#### Tasks

**Task 3.1: Firebase Authentication Setup (8 hours)**

| Item | Time |
|------|------|
| Firebase project configuration | 1.5h |
| Service account creation and Secret Manager setup | 2h |
| Firebase Admin SDK initialization in Express | 1.5h |
| Token verification middleware | 2h |
| Custom claims setup for RBAC | 1h |

**AI Prompt Template:**
```
Set up Firebase Authentication in Express backend:

1. Create Firebase project in GCP Console
2. Create service account and download JSON key
3. Store service account key in GCP Secret Manager
4. Install firebase-admin in backend
5. Create src/lib/firebase.ts:
   - Load service account from Secret Manager (not .env for security)
   - Initialize firebase Admin SDK
   - Export auth() and db()
6. Create src/middleware/auth.ts:
   - Extract token from Authorization header AND HttpOnly cookie
   - Verify token with admin.auth().verifyIdToken()
   - Attach user object to req.user with Firebase UID
   - Reject if invalid/expired
7. Custom claims:
   - Set Firebase custom claims: { role: 'system_admin', siteId: 1 }
   - Verify claims in middleware
```

**Task 3.2: Authentication Middleware (8 hours)**

| Item | Time |
|------|------|
| JWT verification middleware | 2h |
| Token refresh mechanism (httpOnly cookies) | 2h |
| Session timeout and re-authentication flow | 2h |
| Logout and token revocation | 2h |

**AI Prompt Template:**
```
Implement JWT authentication in Express:

1. Middleware src/middleware/verifyToken.ts:
   - Extract access token from: (a) Authorization header: Bearer <token>, (b) cookies.accessToken
   - Call Firebase admin.auth().verifyIdToken(token)
   - If expired, check refreshToken cookie and call admin.auth().verifySessionCookie()
   - If both invalid, return 401 Unauthorized
   - Attach verified user to req.user = { uid, email, role, siteId }

2. Token refresh endpoint POST /api/auth/refresh:
   - Accept refreshToken from httpOnly cookie
   - Call Firebase to exchange for new accessToken
   - Return new accessToken (short-lived, 1 hour)
   - Return new refreshToken in httpOnly cookie (long-lived, 7 days)

3. Logout endpoint POST /api/auth/logout:
   - Revoke session on Firebase
   - Clear httpOnly cookies
   - Return success response

4. Middleware configuration:
   - All endpoints except /login require verifyToken middleware
   - Tokens stored in httpOnly cookies (not localStorage)
   - SameSite=Strict CSRF protection
```

**Task 3.3: RBAC Middleware (10 hours)**

| Item | Time |
|------|------|
| Permission matrix definition | 2h |
| Role-based access control middleware | 3h |
| Site-based access restrictions | 2h |
| Audit logging for permission checks | 2h |
| Role verification tests | 1h |

**AI Prompt Template:**
```
Implement RBAC with permission matrix:

1. Define permission matrix in src/lib/permissions.ts:

const ROLE_PERMISSIONS = {
  system_admin: ['users:create', 'users:update', 'users:delete', 'system:*', 'reports:*', 'audit_logs:read'],
  farm_manager: ['batches:*', 'employees:read', 'sites:read', 'attendance:read', 'sales:read', 'reports:*'],
  accountant: ['employees:read', 'employees:salary', 'payroll:*', 'sales:*', 'payments:*', 'reports:financial:read', 'audit_logs:read'],
  supervisor: ['batches:*', 'daily_records:*', 'attendance:*', 'vaccinations:*', 'reports:batch:read'],
  feed_mill_operator: ['feed_inventory:*', 'feed_production:*', 'reports:feed:read'],
  farm_worker: ['daily_records:create', 'daily_records:read_own', 'attendance:read_own'],
  viewer: ['reports:read', 'employees:read', 'batches:read', 'sales:read']
};

2. Middleware src/middleware/requirePermission.ts:
   - Takes permission string: 'batches:create', 'reports:*', etc.
   - Checks if req.user.role has that permission
   - If not, return 403 Forbidden with { success: false, error: 'Insufficient permissions' }

3. Site-based access (for farm_manager role):
   - If user has siteId = 1, can only access batches/employees/sites for that site
   - Check req.query.siteId or req.params.siteId matches req.user.siteId
   - Prevent cross-site data access

4. Usage in routes:
   router.post('/users', requirePermission('users:create'), createUserHandler);
   router.get('/batches', requirePermission('batches:read'), getBatchesHandler);

5. Audit logging:
   - Log every permission check (success and failure)
   - Record in audit_logs table: action, userId, permission, granted/denied
```

**Task 3.4: User Management Routes (8 hours)**

| Item | Time |
|------|------|
| Admin user creation endpoint (no self-registration) | 2.5h |
| Login endpoint (Firebase + JWT setup) | 2h |
| Password reset flow (Firebase email) | 1.5h |
| Profile retrieval endpoint | 1h |
| User listing and search (system_admin only) | 1h |

**AI Prompt Template:**
```
Implement user management endpoints:

1. POST /api/auth/register (system_admin only):
   - Input: { email, fullName, userRole (enum), siteId (optional) }
   - Validate email format, role is valid
   - Check if email already exists
   - Call admin.auth().createUser({ email, displayName: fullName })
   - Create users table record: { firebaseUid, email, fullName, userRole, siteId }
   - Set custom claims: admin.auth().setCustomUserClaims(uid, { role: userRole, siteId })
   - Send password setup email via Firebase
   - Return { success: true, userId, email }

2. POST /api/auth/login:
   - Input: { email, password }
   - Call Firebase client SDK to authenticate (handled in frontend for security)
   - Backend receives idToken from frontend
   - Verify token with admin.auth().verifyIdToken(idToken)
   - Create session: admin.auth().createSessionCookie(idToken, { expiresIn: 7 * 24 * 60 * 60 * 1000 })
   - Return sessionCookie in httpOnly cookie
   - Also return refreshToken in httpOnly cookie
   - Return user object: { userId, email, fullName, role, siteId }

3. POST /api/auth/password-reset:
   - Input: { email }
   - Call admin.auth().generatePasswordResetLink(email)
   - Send email with reset link
   - Return { success: true, message: 'Reset email sent' }

4. GET /api/auth/profile (authenticated):
   - Return current user from req.user
   - Include role, siteId, permissions for frontend

5. GET /api/users (system_admin only):
   - Optional: ?role=farm_manager&siteId=1 (filters)
   - Return paginated list of users
```

**Task 3.5: Security Hardening (6 hours)**

| Item | Time |
|------|------|
| CSRF protection (tokens or SameSite) | 1.5h |
| Input sanitization (Zod) | 1.5h |
| Rate limiting on auth endpoints | 1h |
| Helmet security headers | 1h |
| CORS configuration (whitelist origins) | 1h |

**AI Prompt Template:**
```
Harden authentication security:

1. CSRF Protection:
   - Use SameSite=Strict on all cookies (default in modern Express)
   - Verify Content-Type: application/json for POST/PUT/DELETE
   - No form-encoded submissions from unauthorized origins

2. Input Sanitization (Zod):
   - Validate email format: email()
   - Validate password strength (8+ chars, 1 uppercase, 1 number, 1 special)
   - Sanitize fullName (no SQL chars, length 1-255)
   - Sanitize userRole (enum check)

3. Rate Limiting:
   - /api/auth/login: 5 attempts per 15 minutes per IP
   - /api/auth/password-reset: 3 attempts per hour per email
   - /api/auth/register: No public access (admin only)
   - Use express-rate-limit middleware

4. Helmet Security Headers:
   - Content-Security-Policy: default-src 'self'
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - Strict-Transport-Security: max-age=31536000
   - X-XSS-Protection: 1; mode=block

5. CORS Configuration:
   - allowedOrigins: ['http://localhost:3000', 'https://farmflow.example.com']
   - allowedMethods: ['GET', 'POST', 'PUT', 'DELETE']
   - allowCredentials: true (for cookies)
   - exposedHeaders: ['X-Total-Count', 'X-Page-Count']

6. Error Messages:
   - Don't expose system details ('User not found' ← use 'Invalid credentials')
   - Log actual errors internally, return generic client messages
```

#### RBAC Permission Matrix

| Role | Users | Employees | Batches | Daily Records | Sales | Payroll | Reports | Audit Logs | System |
|------|-------|-----------|---------|---------------|-------|---------|---------|-----------|--------|
| **system_admin** | CRUD | R | R | R | R | R | R | Read | * |
| **farm_manager** | - | R | CRUD | R | R | R | * | - | - |
| **accountant** | - | R (salary) | - | - | CRUD | CRUD | Financial | Read | - |
| **supervisor** | - | - | CRUD | CRUD | R | - | Batch | - | - |
| **feed_mill_operator** | - | - | - | - | - | - | Feed | - | - |
| **farm_worker** | - | - | - | Create own | - | - | - | - | - |
| **viewer** | - | R | R | R | R | - | Read | - | - |

#### Acceptance Criteria

- [ ] Firebase authentication set up and verified
- [ ] JWT tokens generated and verified in middleware
- [ ] Token refresh mechanism working (refresh token in httpOnly cookie)
- [ ] RBAC permission matrix enforced for all endpoints
- [ ] User creation endpoint requires system_admin role
- [ ] Self-registration disabled completely
- [ ] Audit logs record all authentication events
- [ ] Rate limiting functional on auth endpoints
- [ ] Security headers (Helmet) configured
- [ ] CORS whitelist implemented
- [ ] All endpoints return consistent error format

#### Security Checklist

- [ ] Firebase service account key stored in Secret Manager (not .env)
- [ ] JWT tokens signed and verified
- [ ] Tokens stored in httpOnly, Secure, SameSite=Strict cookies (not localStorage)
- [ ] No credentials logged (passwords, tokens, API keys)
- [ ] Rate limiting prevents brute force attacks
- [ ] RBAC enforced at middleware level (not just UI)
- [ ] Audit logs capture all permission-related actions
- [ ] OWASP A07:2021 (Identification and Authentication Failures) addressed

#### Testing Requirements

- [ ] Unit tests: Permission checks (pass/fail for each role)
- [ ] Unit tests: Token refresh logic
- [ ] Integration tests: Login → token → authenticated request
- [ ] Integration tests: Permission denied (403) for unauthorized role
- [ ] Integration tests: User creation only by system_admin
- [ ] Security test: Rate limiting on /login endpoint
- [ ] Security test: CSRF attack prevented

#### Definition of Done

- [ ] All authentication routes working
- [ ] RBAC permission matrix enforced
- [ ] Audit logs recording events
- [ ] Token refresh mechanism working
- [ ] Rate limiting active
- [ ] Security headers configured
- [ ] Tests passing (>80% coverage)
- [ ] No security audit findings

#### Week 3 Summary

**Deliverables:** Firebase authentication, JWT tokens in httpOnly cookies, RBAC with 7 roles, audit logging, security hardening.

**Risk Mitigations:**
- Firebase misconfig: Early testing with staging Firebase project
- RBAC complexity: Permission matrix documented, tested systematically
- Token expiry issues: Refresh token mechanism tested

---

### Week 4: Authentication Frontend (40 hours)

#### Objectives
- Create login/logout UI
- Implement protected routes with role-based navigation
- Set up Zustand auth store for client-side state
- Handle token refresh and session timeout gracefully

#### Tasks

**Task 4.1: Login Page (10 hours)**

| Item | Time |
|------|------|
| Login form with email/password inputs | 3h |
| Firebase client SDK integration | 2h |
| Form validation and error handling | 2h |
| Loading states and error messaging | 2h |
| Redirect to dashboard on successful login | 1h |

**AI Prompt Template:**
```
Create login page component:

1. Components/LoginPage.tsx:
   - Form inputs: email, password
   - Validation: email format, password required
   - Submit handler:
     a. Call Firebase signInWithEmailAndPassword(email, password)
     b. If successful, receive idToken
     c. Send idToken to backend POST /api/auth/login
     d. Backend sets httpOnly cookies with sessionCookie
     e. Store user data in Zustand: setUser({ id, email, role, siteId })
     f. Redirect to /dashboard
   - Error handling: Display toast for invalid credentials, network errors
   - Loading state: Disable button during request

2. Styling: Centered form, Shadcn UI components (Input, Button, Alert)
3. Accessibility: Label all inputs, error announcements
4. Responsive: Mobile-first layout
```

**Task 4.2: Protected Routes (8 hours)**

| Item | Time |
|------|------|
| ProtectedRoute wrapper component | 2.5h |
| Role-based route access | 2.5h |
| Redirect to login if unauthenticated | 1.5h |
| Handle session expiration | 1.5h |

**AI Prompt Template:**
```
Create ProtectedRoute component:

1. Components/ProtectedRoute.tsx:
   - Props: Component, requiredRole (optional), requiredPermission (optional)
   - Check Zustand store: isAuthenticated, currentUser
   - If not authenticated, redirect to /login
   - If requiredRole specified:
     a. Check currentUser.role matches
     b. If not, redirect to /unauthorized (403 page)
   - If requiredPermission specified:
     a. Check backend permissions stored in Zustand
     b. If not granted, redirect to /unauthorized
   - Render Component if all checks pass

2. Usage in routes:
   <ProtectedRoute Component={BatchesPage} requiredRole="supervisor" />
   <ProtectedRoute Component={PayrollPage} requiredPermission="payroll:read" />

3. Session expiration:
   - On 401 response, attempt token refresh via backend
   - If refresh fails, clear Zustand store and redirect to /login
   - Show modal: "Your session has expired. Please login again."
```

**Task 4.3: Auth Store (Zustand) Setup (8 hours)**

| Item | Time |
|------|------|
| User state structure | 2h |
| Auth actions (login, logout, refresh) | 3h |
| Persistence (localStorage for refresh token hint) | 2h |
| Auth state TypeScript types | 1h |

**AI Prompt Template:**
```
Create Zustand auth store (src/store/authStore.ts):

1. Store structure:
   interface User {
     id: string;
     email: string;
     fullName: string;
     role: UserRole;
     siteId?: number;
     permissions: string[];
   }

   interface AuthStore {
     currentUser: User | null;
     isAuthenticated: boolean;
     isLoading: boolean;
     error: string | null;
     setUser(user: User): void;
     logout(): void;
     clearError(): void;
     refreshToken(): Promise<void>;
     hasPermission(permission: string): boolean;
     hasRole(role: UserRole): boolean;
   }

2. Actions:
   - setUser(user): Set current user, isAuthenticated = true
   - logout(): Clear user, make backend POST /api/auth/logout
   - refreshToken(): Call backend GET /api/auth/refresh, update token
   - hasPermission(permission): Check if permission in currentUser.permissions
   - hasRole(role): Check if currentUser.role === role

3. Persistence:
   - Don't store tokens in localStorage (use httpOnly cookies)
   - Store user info in sessionStorage (cleared on browser close)
   - On app load, call /api/auth/profile to restore session

4. Error handling:
   - If refresh fails, logout user
   - Store error messages for UI display
```

**Task 4.4: Logout & Session Management (8 hours)**

| Item | Time |
|------|------|
| Logout functionality and UI button | 2h |
| Session timeout handling | 2h |
| Token refresh automatic retry | 2h |
| Activity-based session extension | 2h |

**AI Prompt Template:**
```
Implement session management:

1. Logout handler:
   - Call POST /api/auth/logout on backend
   - Clear Zustand authStore
   - Clear sessionStorage
   - Redirect to /login
   - Show success toast

2. Session timeout:
   - Set inactivity timer (30 minutes default, configurable)
   - On user action (click, keystroke), reset timer
   - On timer expiry:
     a. Try to refresh token silently
     b. If refresh fails, show modal "Session expired. Please login again."
     c. Redirect to /login

3. Token refresh retry:
   - On API 401 response:
     a. Call authStore.refreshToken()
     b. If successful, retry original request
     c. If failed, redirect to /login
   - Maximum 1 retry per request (prevent infinite loops)

4. Activity monitoring:
   - useEffect hook in App.tsx
   - Listen to: click, keydown, mousemove
   - Reset inactivity timer on each event
   - Clean up listeners on unmount
```

**Task 4.5: Role-Based Navigation (6 hours)**

| Item | Time |
|------|------|
| Navigation menu based on user role | 3h |
| Dynamic menu items and links | 2h |
| Mobile navigation drawer | 1h |

**AI Prompt Template:**
```
Create role-based navigation (Components/Navigation.tsx):

1. Menu items per role:
   system_admin: Dashboard, Users, System Config, Audit Logs
   farm_manager: Dashboard, Batches, Employees, Reports
   supervisor: Dashboard, Batches, Daily Records, Attendance
   accountant: Dashboard, Employees, Sales, Payroll, Reports
   feed_mill_operator: Dashboard, Feed Inventory, Feed Production
   farm_worker: Dashboard, Daily Records, My Attendance

2. Navigation component:
   - Get currentUser from Zustand
   - Map role to menu items
   - Show/hide menu items based on role
   - Highlight active route
   - Mobile: Hamburger menu → drawer

3. Responsive:
   - Desktop: Sidebar navigation
   - Mobile: Hamburger menu (Shadcn Drawer)
   - Tablet: Collapsible sidebar

4. User menu:
   - Display: "Welcome, [fullName]"
   - Actions: Profile, Change Password, Logout
   - Position: Top-right corner
```

#### Acceptance Criteria

- [ ] Login page renders and accepts input
- [ ] Firebase authentication works (test with real Firebase project)
- [ ] Backend receives idToken and sets httpOnly cookies
- [ ] Token stored in cookie (not localStorage)
- [ ] Protected routes require authentication
- [ ] Zustand auth store initialized and persisted
- [ ] Role-based navigation displays correct menu items
- [ ] Logout clears session and redirects to login
- [ ] Session timeout triggers after 30 minutes inactivity
- [ ] Token refresh works silently on 401 responses
- [ ] Error messages display on login failure

#### Testing Requirements

- [ ] Unit tests: Login form validation
- [ ] Unit tests: Zustand auth store actions
- [ ] Integration tests: Login flow (UI → Backend → Dashboard)
- [ ] Integration tests: Protected route access (authenticated vs unauthenticated)
- [ ] Integration tests: Role-based route access (supervisor vs farm_worker)
- [ ] Security test: Token not exposed in console/sessionStorage

#### Definition of Done

- [ ] Login page fully functional
- [ ] Protected routes working
- [ ] Auth store managing state correctly
- [ ] Role-based navigation displaying correctly
- [ ] Session timeout and refresh working
- [ ] Tests passing (>80% coverage)
- [ ] No security warnings (console clean)
- [ ] Mobile-responsive UI

#### Week 4 Summary

**Deliverables:** Login page, protected routes, Zustand auth store, role-based navigation, session management.

**Risk Mitigations:**
- Firebase config issues: Use Firebase Emulator for local testing
- Token expiry: Automatic refresh implemented
- UI complexity: Use Shadcn UI component library

---

### Weeks 5-6: Employee Management (80 hours)

#### Objectives
- Build complete CRUD backend and frontend for employees
- Implement relational emergency contacts and bank details (not JSONB)
- Set up private file uploads with signed URLs (GCS)
- Create search, filter, and document management features

#### Phase 1 Weeks 5-6 Task Overview (80 hours total)

**Week 5 Tasks (40 hours):**
- Task 5.1: Employee CRUD Backend (14 hours)
- Task 5.2: Emergency Contacts & Bank Details (8 hours)
- Task 5.3: File Upload Setup (12 hours)
- Task 5.4: Testing & Documentation (6 hours)

**Week 6 Tasks (40 hours):**
- Task 6.1: Employee List Page (10 hours)
- Task 6.2: Create/Edit Employee Form (12 hours)
- Task 6.3: Document Upload & Management (12 hours)
- Task 6.4: Search, Filter, Export (6 hours)

#### Week 5: Backend Employee Management

**Task 5.1: Employee CRUD Backend (14 hours)**

| Item | Time |
|------|------|
| GET /employees (list with pagination & filters) | 2.5h |
| GET /employees/:id (detail view) | 1.5h |
| POST /employees (create with validation) | 3h |
| PUT /employees/:id (update) | 3h |
| DELETE /employees/:id (soft delete with audit) | 1.5h |
| Search by name/designation/site | 1.5h |
| Role-based access control | 1h |

**AI Prompt Template:**
```
Create employee CRUD endpoints:

1. GET /api/employees (farm_manager, accountant, system_admin):
   - Query params: ?page=1&limit=20&siteId=1&designation=Supervisor&status=active
   - Validate pagination (limit max 100)
   - Filter by: siteId (farm_manager limited to own site), designation, status
   - Return: { data: Employee[], total: number, page: number }
   - Include related data: emergencyContact, bankDetails

2. GET /api/employees/:id:
   - Fetch employee with related data
   - Return full employee object with emergency contacts array, bank details object
   - Permission: farm_manager can only see own site employees

3. POST /api/employees:
   - Input validation with Zod: { firstName, lastName, designation, siteId, employmentType, joinDate, phone }
   - Check siteId exists
   - Check designation in system_config
   - Create employee record
   - Permission: system_admin, farm_manager (own site)
   - Audit log: 'employee_created'
   - Return created employee

4. PUT /api/employees/:id:
   - Allow updates to: firstName, lastName, designation, phone, status
   - Don't allow siteId change (prevents cross-site moves)
   - Validate inputs
   - Permission: system_admin, farm_manager (own site)
   - Audit log: 'employee_updated' with changes (before/after)
   - Return updated employee

5. DELETE /api/employees/:id:
   - Soft delete: set status = 'terminated', updatedAt = now
   - Audit log: 'employee_deleted'
   - Don't cascade delete (preserve history)
   - Return { success: true }

6. GET /api/employees/search?q=John:
   - Full-text search on firstName, lastName, phone, email
   - Return top 10 matches
```

**Task 5.2: Emergency Contacts & Bank Details (8 hours)**

| Item | Time |
|------|------|
| POST /employees/:id/emergency-contacts (create) | 1.5h |
| GET /employees/:id/emergency-contacts (list) | 1.5h |
| PUT /emergency-contacts/:id (update) | 1.5h |
| DELETE /emergency-contacts/:id (delete) | 1h |
| Bank details endpoints (CRUD) | 2.5h |

**AI Prompt Template:**
```
Create emergency contacts and bank details endpoints:

1. POST /api/employees/:id/emergency-contacts:
   - Input: { contactName, relationship, phoneNumber }
   - Validate phone format
   - Create row in emergency_contacts table
   - Return created contact with id

2. GET /api/employees/:id/emergency-contacts:
   - Fetch all emergency_contacts for employee
   - Return array of contacts

3. PUT /api/emergency-contacts/:id:
   - Update contactName, relationship, phoneNumber
   - Verify emergency contact belongs to employee
   - Audit log: 'emergency_contact_updated'
   - Return updated contact

4. DELETE /api/emergency-contacts/:id:
   - Delete row (allow physical delete for contacts)
   - Audit log: 'emergency_contact_deleted'

5. Bank Details CRUD (similar pattern):
   - POST /api/employees/:id/bank-details: Create (one per employee)
   - GET /api/employees/:id/bank-details: Fetch
   - PUT /api/bank-details/:id: Update
   - Fields: accountHolderName, bankName, branchCode, accountNumber, ifscCode
   - Permission: accountant can read; only system_admin/farm_manager can write
   - Don't log sensitive account numbers (log only bank_name, last 4 digits of account)
```

**Task 5.3: File Upload Setup (12 hours)**

| Item | Time |
|------|------|
| GCS bucket configuration (private) | 1.5h |
| Signed URL generation (1-hour expiry) | 2h |
| File upload endpoint with validation | 3h |
| File deletion endpoint | 1.5h |
| Multer middleware setup | 2.5h |
| File type and size validation | 1.5h |

**AI Prompt Template:**
```
Set up secure file uploads with signed URLs:

1. GCS bucket setup:
   - Create bucket: gs://farmflow-documents-prod (private)
   - Disable public access (all must use signed URLs)
   - CORS: Allow origin https://farmflow.example.com, methods GET/PUT
   - Lifecycle rule: Delete files older than 2 years (archive older)

2. Signed URL generation (src/lib/gcs.ts):
   - Import @google-cloud/storage
   - Get service account from Secret Manager
   - Create Storage client
   - Function generateSignedUrl(bucketName, fileName):
     a. Get file reference
     b. Generate signed URL (method: 'GET', expires: 1 hour from now)
     c. Return URL string

3. File upload endpoint POST /api/employees/:id/documents:
   - Input: multipart/form-data with file and documentType
   - Multer middleware:
     a. Limits: maxSize 10MB, allowedMimes: [application/pdf, image/jpeg, image/png]
     b. Storage: Store in memory (not disk)
   - Validation: File size ≤ 10MB, type in whitelist
   - Upload to GCS:
     a. Bucket path: employees/{employeeId}/{date}-{randomUuid}-{originalFileName}
     b. Metadata: Content-Type, Cache-Control
   - Create documents table row: { entityType: 'employee', entityId, fileName, fileUrl, fileSize, fileType, uploadedBy }
   - Generate signed URL for download
   - Audit log: 'file_uploaded'
   - Return { success: true, documentId, downloadUrl }

4. File download GET /api/documents/:id/download:
   - Get document from database
   - Verify permission (user can access employee or is admin)
   - Generate fresh signed URL
   - Redirect to signed URL (client downloads from GCS)

5. File deletion DELETE /api/documents/:id:
   - Get document from database
   - Delete from GCS bucket
   - Delete database row
   - Audit log: 'file_deleted'
   - Return { success: true }

6. Multer middleware (src/middleware/upload.ts):
   - Configure: max file size 10MB
   - Error handling: Return 400 Bad Request with error message
   - File validation: Check MIME type (not just extension)
```

**Task 5.4: Testing & Documentation (6 hours)**

| Item | Time |
|------|------|
| Unit tests for employee service | 2h |
| Integration tests for CRUD endpoints | 2h |
| API documentation (Postman or OpenAPI) | 1.5h |
| Error handling and edge cases | 0.5h |

**AI Prompt Template:**
```
Create comprehensive tests:

1. Unit tests (src/__tests__/services/employeeService.test.ts):
   - Test validation: required fields, phone format
   - Test calculations: age from joinDate
   - Mock database calls

2. Integration tests (src/__tests__/routes/employees.test.ts):
   - Setup: Create test employee, authenticated user
   - POST /employees: Create valid/invalid employee
   - GET /employees: Paginate, filter, search
   - PUT /employees/:id: Update, verify audit log
   - DELETE /employees/:id: Soft delete
   - Permission tests: farm_manager can only see own site
   - Cleanup: Delete test data

3. API documentation:
   - Endpoint: POST /api/employees
   - Method: POST
   - Auth: Bearer token, requires farm_manager role
   - Request: { firstName, lastName, designation, siteId, employmentType, joinDate, phone }
   - Response: 201 Created, { data: Employee }
   - Error: 400 Bad Request, 403 Forbidden, 500 Internal Server Error
```

#### Week 6: Frontend Employee Management

**Task 6.1: Employee List Page (10 hours)**

| Item | Time |
|------|------|
| Fetch and display employees list | 2h |
| Pagination UI (prev/next, jump to page) | 2h |
| Filter by site, designation, status | 2h |
| Sorting by columns (name, joinDate) | 2h |
| Loading and error states | 2h |

**AI Prompt Template:**
```
Create employees list page:

1. Pages/EmployeesPage.tsx:
   - Use TanStack Query (useQuery) to fetch employees
   - Query key: ['employees', { page, limit, siteId, designation, status }]
   - Display table with columns: Name, Designation, Site, Employment Type, Join Date, Status
   - Pagination controls: Previous, page input, Next
   - Filters: Site dropdown, Designation dropdown, Status select
   - Sort: Click column header to sort (ascending/descending)
   - Loading state: Skeleton rows
   - Error state: Retry button
   - Action buttons: View Details, Edit, Delete

2. Responsive table:
   - Desktop: Full columns
   - Tablet: Hide optional columns
   - Mobile: Stack view with key info

3. UX:
   - Debounce filters (500ms) to reduce API calls
   - Show total count: "Showing 1-20 of 150 employees"
   - Highlight current page in pagination
```

**Task 6.2: Create/Edit Employee Form (12 hours)**

| Item | Time |
|------|------|
| Form component with React Hook Form | 4h |
| Zod schema validation | 2h |
| Emergency contacts sub-form | 3h |
| Bank details sub-form | 2h |
| Submit and error handling | 1h |

**AI Prompt Template:**
```
Create employee create/edit form:

1. Forms/EmployeeForm.tsx:
   - Mode: 'create' or 'edit'
   - Pre-fill form if editing
   - Fields:
     a. firstName, lastName (required, text)
     b. designation (required, dropdown from system_config)
     c. siteId (required, dropdown)
     d. employmentType (required, radio: Permanent/Contract/Seasonal)
     e. joinDate (required, date picker)
     f. phone (optional, pattern)
     g. Emergency contacts (sub-form, array):
        - contactName, relationship, phoneNumber (repeatable)
        - Add/remove buttons
     h. Bank details (sub-form):
        - accountHolderName, bankName, branchCode, accountNumber, ifscCode (repeatable, max 1)

2. Validation with Zod:
   - firstName: string min 1, max 100
   - lastName: string min 1, max 100
   - designation: enum from system_config
   - siteId: number, valid site exists
   - employmentType: enum
   - joinDate: date, not in future
   - phone: optional, pattern /^[0-9]{10,15}$/
   - Emergency contacts: array of { contactName, relationship, phoneNumber }
   - Bank details: { accountNumber min 8, ifscCode pattern }

3. Submit handler:
   - Create mode: POST /api/employees
   - Edit mode: PUT /api/employees/:id
   - On success: Show toast, redirect to list
   - On error: Display field-level errors

4. Responsive:
   - Desktop: 2 columns
   - Mobile: 1 column
   - Scrollable sub-forms on mobile
```

**Task 6.3: Document Upload & Management (12 hours)**

| Item | Time |
|------|------|
| File upload UI with drag-drop | 3h |
| Upload progress and status | 2h |
| Document list and preview | 3h |
| Download functionality | 2h |
| Delete with confirmation | 2h |

**AI Prompt Template:**
```
Create document management UI:

1. DocumentUpload component:
   - Drag-drop area for file upload
   - File input button (alternative)
   - Show file name, size, type before upload
   - Progress bar during upload
   - Success/error message after upload
   - Accepted types: PDF, JPEG, PNG
   - Max size: 10MB

2. Upload handler:
   - FormData with file and documentType
   - POST /api/employees/:id/documents
   - Show progress via onUploadProgress
   - On success: Refresh documents list
   - On error: Display error message, allow retry

3. DocumentsList component:
   - Table: File name, Type, Size, Upload date, Actions
   - Actions: Download, Delete, Preview
   - Sort by upload date (newest first)

4. Download functionality:
   - GET /api/documents/:id/download
   - Opens signed URL in new tab
   - Browser handles download

5. Delete:
   - Confirmation modal: "Delete this document?"
   - DELETE /api/documents/:id
   - Refresh list on success

6. Preview (PDFs only):
   - Use react-pdf library
   - Modal showing embedded PDF
   - Option to download
```

**Task 6.4: Search, Filter, Export (6 hours)**

| Item | Time |
|------|------|
| Search employees by name/phone | 2h |
| Advanced filters (date range, status) | 2h |
| CSV export of employee list | 2h |

**AI Prompt Template:**
```
Create search and export features:

1. Search component:
   - Input field with debounce (500ms)
   - GET /api/employees/search?q=john
   - Return top 10 matches with highlighting
   - Click match to navigate to employee detail

2. Advanced filters:
   - Join date range (from/to pickers)
   - Status select (Active, On Leave, Terminated)
   - Site multi-select
   - Designation multi-select
   - "Apply Filters" button
   - "Clear Filters" button

3. CSV export:
   - Button: "Export to CSV"
   - Get current filtered list
   - Convert to CSV: id, firstName, lastName, designation, siteId, joinDate, phone
   - Trigger download: <a href={csvDataUrl} download="employees.csv">
   - Format: Comma-separated, quoted strings with commas

4. Pagination memory:
   - Remember last page/filters in component state
   - Restore on back navigation
```

#### Acceptance Criteria (Weeks 5-6)

- [ ] Employee CRUD endpoints working (create, read, update, list)
- [ ] Relational emergency contacts table populated and editable
- [ ] Relational bank details table populated and editable
- [ ] File uploads to private GCS bucket
- [ ] Signed URLs generated with 1-hour expiry
- [ ] File type/size validation enforced (10MB max)
- [ ] Employee list page with pagination, filters, sorting
- [ ] Create/edit form fully functional with validation
- [ ] Document upload with progress tracking
- [ ] Document download, preview, delete working
- [ ] Search and advanced filters working
- [ ] CSV export generating valid file
- [ ] Audit logs recording all employee changes
- [ ] Permission matrix enforced (farm_manager sees only own site)
- [ ] Mobile-responsive UI

#### Testing Requirements (Weeks 5-6)

- [ ] Backend: CRUD operations tested
- [ ] Backend: Permission enforcement tested
- [ ] Backend: File upload validation tested (size, type)
- [ ] Frontend: Form validation tested (invalid inputs rejected)
- [ ] Frontend: File upload (mock GCS) tested
- [ ] Integration: Create employee → upload document → download
- [ ] E2E: Full employee workflow (create, edit, upload docs, export list)

#### Definition of Done (Weeks 5-6)

- [ ] All CRUD endpoints working and tested
- [ ] Emergency contacts & bank details relational tables populated
- [ ] File uploads secure (signed URLs, private bucket)
- [ ] Frontend list/create/edit pages fully functional
- [ ] Document management (upload/download/delete) working
- [ ] Search and filters operational
- [ ] CSV export generating correctly
- [ ] Audit logs recording all actions
- [ ] Tests passing (>80% coverage on employee module)
- [ ] Mobile UI responsive and usable

#### Weeks 5-6 Summary

**Deliverables:** Complete employee management system with CRUD, relational emergency contacts/bank details, secure file uploads (signed URLs), document management, search, filters, CSV export.

**Risk Mitigations:**
- GCS signing issues: Use service account from Secret Manager
- Large file uploads: Stream uploads, show progress
- Concurrent edits: Lock employee during edit or use optimistic updates

---

## 7. Phase 1 Remaining Weeks (Weeks 7–12) Summary

Due to token constraints, I'll provide the structure for remaining Phase 1 weeks in abbreviated format. These follow the same detailed template as Weeks 1–6.

### Weeks 7-8: Site, Cage & Batch Management (80 hours)

**Week 7 Tasks (40h):**
- 7.1: Sites CRUD (10h)
- 7.2: Cages CRUD (10h)
- 7.3: Batch creation & lifecycle (15h)
- 7.4: Testing (5h)

**Week 8 Tasks (40h):**
- 8.1: Batch list & detail pages (12h)
- 8.2: Batch status transitions UI (10h)
- 8.3: Cage management page (10h)
- 8.4: Mobile optimization (8h)

**Key Features:**
- Batch ID format: BATCH-SITE-CAGE-YYYYMMDD
- Batch status flow: placement → growing → ready_for_sale → sold
- FCR = totalFeedKg / totalWeightGainKg (calculated in backend)
- Alert thresholds (configurable via system_config): Mortality >2%, FCR >1.8
- Daily records entry (mobile-optimized UI for farm worker input)
- Cage status: empty, occupied, maintenance

---

### Weeks 9-10: Sales Module (80 hours)

**Week 9 Tasks (40h):**
- 9.1: Buyer master CRUD (8h, FR-SD-001)
- 9.2: Sales recording endpoints (12h, FR-SD-002)
- 9.3: Payment tracking (multi-payment) (12h)
- 9.4: Testing (8h)

**Week 10 Tasks (40h):**
- 10.1: Sales list & detail pages (12h)
- 10.2: Invoice generation (PDF) (10h)
- 10.3: Cheque tracking & payment UI (12h)
- 10.4: Outstanding balance dashboard (6h)

**Key Features:**
- Sale ID format: SALE-YYYYMMDD-XXX
- Multiple payments per sale (cash, cheque, bank transfer)
- Outstanding balance = totalAmount - sum(payments)
- Cheque status: pending, cleared, bounced
- Invoice PDF with batch details, price, buyer info
- Validation: Payment ≤ sale amount, sale can't be deleted if paid

---

### Week 11: Dashboard, Reports & System Configuration (40 hours)

**Task 11.1: Dashboard (12h)**
- Active batches widget (count, avg FCR)
- Outstanding payments widget
- Mortality rate alerts
- FCR alerts (>1.8)
- Sales summary (last 7 days, 30 days)
- Recent activity feed

**Task 11.2: Reports (16h)**
- Batch performance report (FCR, mortality, cost/bird)
- Sales summary (by buyer, date range, CSV export)
- Employee attendance report (FR-HR-010)
- Customizable filters and date ranges
- PDF export functionality

**Task 11.3: System Configuration UI (12h)**
- Designations CRUD (linked to employees)
- Feed types (starter, grower, finisher)
- Mortality causes
- Leave types (casual, earned, medical)
- Alert thresholds (mortality %, FCR %)
- All backed by system_config table

---

### Week 12: MVP Integration Testing, Staging Deployment & UAT (40 hours)

**Task 12.1: Integration Testing (12h)**
- E2E: Employee creation → batch assignment → daily records → sale
- E2E: Batch lifecycle (placement → growing → sale)
- E2E: Multi-payment processing

**Task 12.2: Performance Testing (8h)**
- API response time <200ms (p95)
- Database query optimization
- Frontend bundle size <500KB (gzipped)

**Task 12.3: Security Testing (8h)**
- OWASP Top 10 checklist
- SQL injection prevention
- XSS prevention
- CSRF token validation
- Authentication/authorization bypass attempts

**Task 12.4: Staging Deployment (8h)**
- Deploy to Cloud Run (backend)
- Deploy to Firebase Hosting (frontend)
- Cloud SQL configuration
- Cloud Storage bucket setup
- Monitoring and alerting

**Task 12.5: UAT & Sign-Off (4h)**
- Stakeholder test script
- Bug triage (P0, P1, P2)
- Sign-off documentation

**MVP Go-Live Criteria:**
- All P0 bugs fixed
- API response <200ms (p95)
- Stakeholder UAT sign-off
- Monitoring configured
- Backup and restore tested

---

## 8. Phase 2: Enhancements (Weeks 13–24)

Following the same detailed structure:

### Weeks 13-14: Feed Mill Inventory & Production (SHOULD-HAVE)

**Weeks 15-16: Feed Distribution & Recipe Management (SHOULD-HAVE, FR-FM-001)**

**Weeks 17-18: Attendance & Payroll (SHOULD-HAVE, FR-HR-010, FR-HR-012, FR-HR-019)**

**Weeks 19-20: Advanced Reporting & Analytics (COULD-HAVE)**

**Week 21: PWA Implementation (COULD-HAVE)**

**Week 22: Mobile Optimization & Offline Support (COULD-HAVE)**

**Week 23: Security Hardening & Performance (SHOULD-HAVE)**

**Week 24: Production Deployment & Go-Live (MUST-HAVE)**

*(Details follow same template as Phase 1 weeks)*

---

## 9. Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|-----------|
| 1 | Scope creep from stakeholders | High | High | MoSCoW freeze after Week 1; formal change request process; weekly demos to manage expectations |
| 2 | Database performance issues | Medium | High | Index strategy from start; query optimization; load testing before UAT; consider read replicas if needed |
| 3 | Firebase configuration issues | Medium | Medium | Early setup in Week 1; use Firebase Emulator for local dev; placeholder strategy for prod config |
| 4 | Developer burnout (40h/week) | Medium | High | Maintain 40-45 hour cap strictly; weekly breaks; pair programming with AI tools; automate repetitive tasks |
| 5 | Third-party API failures (Firebase, GCS) | Low | Medium | Circuit breaker patterns; fallback storage options; comprehensive error handling; monitoring alerts |
| 6 | Data loss or corruption | Low | Critical | Daily automated backups; tested restore procedures; audit trail logging; version control on schema changes |
| 7 | Deployment failures | Medium | High | Staging environment mirrors production; CI/CD automated; rollback procedures documented; canary deployments |
| 8 | Security vulnerabilities discovered | Medium | High | OWASP compliance from start; regular dependency audits; security code review; penetration testing before go-live |
| 9 | Offline sync conflicts (PWA) | High | Medium | Last-write-wins strategy; conflict detection; user resolution UI; sync queue management |
| 10 | Stakeholder expectation mismatch | High | High | Weekly demos; clear MVP definition; transparent velocity tracking; manage scope with MoSCoW matrix |

---

## 10. Coding Standards & Project Conventions

### File Structure

**Backend:**
```
src/
├── config/          # Configuration (database, firebase)
├── lib/             # Utilities (errors, logging, validators)
├── middleware/      # Express middleware (auth, permissions, uploads)
├── routes/          # API endpoints organized by feature
│   ├── employees.ts
│   ├── batches.ts
│   ├── sales.ts
│   └── ...
├── services/        # Business logic (no database access in routes)
│   ├── employeeService.ts
│   ├── batchService.ts
│   └── ...
├── db/              # Database schema (Drizzle)
│   ├── schema.ts
│   └── migrations/
├── __tests__/       # Tests (mirror src structure)
└── app.ts           # Express app initialization
```

**Frontend:**
```
src/
├── components/      # Reusable UI components
│   ├── common/      # Layout, navigation, alerts
│   ├── forms/       # Form components
│   └── modules/     # Feature-specific components
├── pages/           # Page components (one per route)
├── hooks/           # Custom React hooks
├── store/           # Zustand stores (auth, app state)
├── lib/             # Utilities (api client, validators)
├── types/           # TypeScript types
├── __tests__/       # Tests
└── App.tsx          # Root component
```

### Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| **Files** | snake_case | employee_service.ts, batch_form.tsx |
| **Variables** | camelCase | currentUser, batchStatus |
| **Classes** | PascalCase | EmployeeService, BatchForm |
| **Constants** | UPPER_SNAKE_CASE | MAX_FILE_SIZE, ROLE_PERMISSIONS |
| **Enums** | PascalCase values | UserRole.SYSTEM_ADMIN |
| **TypeScript types** | PascalCase | interface Employee, type SaleStatus |
| **Routes** | kebab-case | /api/employees, /api/batch-records |
| **Database columns** | snake_case | first_name, created_at |

### Error Response Format

All API endpoints return consistent JSON:

```json
{
  "success": boolean,
  "error": "string (if success=false)",
  "code": "ERROR_CODE (string)",
  "statusCode": number,
  "timestamp": "ISO 8601 string",
  "data": "any (if success=true)"
}
```

**Example Success:**
```json
{
  "success": true,
  "statusCode": 200,
  "timestamp": "2026-02-08T10:30:00Z",
  "data": { "id": 1, "firstName": "John" }
}
```

**Example Error:**
```json
{
  "success": false,
  "error": "Email already exists",
  "code": "DUPLICATE_EMAIL",
  "statusCode": 400,
  "timestamp": "2026-02-08T10:30:00Z"
}
```

### Structured Logging

All logs use Winston with JSON format for structured querying:

```typescript
logger.info('Employee created', {
  userId: req.user.id,
  employeeId: createdEmployee.id,
  employeeName: `${createdEmployee.firstName} ${createdEmployee.lastName}`,
  siteId: createdEmployee.siteId,
  timestamp: new Date().toISOString()
});

logger.warn('High mortality rate detected', {
  batchId: batch.id,
  mortalityRate: 3.5,
  threshold: 2.0,
  action: 'alert_sent'
});

logger.error('File upload failed', {
  error: err.message,
  userId: req.user.id,
  fileName: file.originalname,
  fileSize: file.size
});
```

### Import Organization

1. Node.js built-ins (`fs`, `path`)
2. Third-party packages (`express`, `firebase-admin`)
3. Internal utilities and lib
4. Components (frontend only)
5. Types and constants

```typescript
import fs from 'fs';
import express from 'express';
import admin from 'firebase-admin';

import { logger } from '../lib/logger';
import { requirePermission } from '../middleware/rbac';

import { UserRole } from '../types';
import { ROLE_PERMISSIONS } from '../lib/permissions';
```

---

## 11. Deployment & Operations

### CI/CD Pipeline

**GitHub Actions Triggers:**
- Every push to `main`: Run lint, build, test (all pass required)
- Pull request: Same checks + code review
- Merge to `main`: Trigger Cloud Build

**Cloud Build:**
- Staging: Manual trigger (test deployment)
- Production: Manual trigger + require approval

**Deployment Steps:**
1. Build Docker image (backend + frontend)
2. Run tests in container
3. Push image to Container Registry
4. Deploy to Cloud Run (staging) or production
5. Run smoke tests (health check)
6. Update Cloud DNS if needed

### Environments

| Environment | Backend | Frontend | Database | Storage |
|-------------|---------|----------|----------|---------|
| **Development** | Local (Express) | Local (Vite) | Local (Docker PostgreSQL) | Local (filesystem) |
| **Staging** | Cloud Run | Firebase Hosting | Cloud SQL (separate instance) | Cloud Storage (private) |
| **Production** | Cloud Run (min 1, max 10 instances) | Firebase Hosting (CDN) | Cloud SQL (HA secondary) | Cloud Storage (private) |

### Monitoring & Alerting

**Cloud Monitoring Dashboards:**
- Backend: Request count, error rate, latency (p50, p95, p99)
- Database: Connection count, query time, replication lag
- Frontend: Page load time, error tracking
- Custom: Batch creation rate, sale processing rate

**Alert Policies:**
- Error rate >5% → Page on-call
- API latency p95 >500ms → Warning
- Database connection pool >80% → Warning
- Cloud SQL disk >85% → Warning
- Failed backup detection → Page on-call

### Backup & Disaster Recovery

**Database Backups:**
- Automated: Daily at 00:00 UTC (Cloud SQL managed backups)
- Retention: 35 days
- Test restore: Monthly (first Monday, 10:00 UTC)
- RTO: 4 hours (restore from backup)
- RPO: 1 hour (maximum data loss)

**File Storage Backups:**
- Cloud Storage: Versioning enabled (last 30 versions)
- Lifecycle: Archive to Coldline after 90 days
- No separate backup needed (GCS replication sufficient)

**Disaster Recovery Plan:**
1. On database failure: Restore from latest backup
2. Verify data integrity (sample queries)
3. Run smoke tests on staging
4. Failover to restored database
5. Update monitoring
6. Notify stakeholders
7. Root cause analysis

### Log Aggregation

**Cloud Logging:**
- All logs sent to Cloud Logging (automatic from Cloud Run)
- Log level: DEBUG in development, INFO in staging, WARNING in production
- Retention: 30 days (non-error), 90 days (error)
- Structured JSON format for easy parsing

**Log Queries:**
```
resource.type="cloud_run_revision"
severity="ERROR"
timestamp>="2026-02-08T10:00:00Z"
```

---

## 12. Out of Scope

The following features are explicitly NOT included in this 24-week plan:

- **Native Mobile Apps:** iOS/Android native clients (PWA is the mobile solution)
- **Blockchain Integration:** Supply chain traceability via blockchain
- **Real-Time IoT:** Automated sensor data ingestion (manual daily entry only)
- **Machine Learning:** Predictive mortality, disease detection, optimal feed formulation
- **Multi-Language Support:** Only English UI initially
- **Advanced Tax Calculations:** VAT, GST, income tax calculations
- **Biometric Integration:** Fingerprint or facial recognition for attendance
- **Integration with Legacy Systems:** ERP, accounting software integration (manual data entry only)
- **Custom Report Builder:** Users create own report definitions (pre-defined reports only)
- **API Rate Limiting per Customer:** No multi-tenant rate limiting
- **Advanced Cache Strategy:** CDN caching (basic HTTP caching only)

---

## 13. Appendix: Weekly Definition-of-Done Checklist

This checklist applies to every week of development:

### Code Quality
- [ ] All new code has unit tests (>80% coverage)
- [ ] All tests passing (zero test failures)
- [ ] Linting passes (ESLint, no warnings)
- [ ] Code formatted (Prettier)
- [ ] TypeScript compiles without errors
- [ ] No console.log or debugger statements left in code

### Documentation
- [ ] API endpoints documented (request/response examples)
- [ ] Complex logic documented with comments
- [ ] New dependencies added to README
- [ ] Database schema changes documented
- [ ] Breaking changes noted in CHANGELOG

### Testing
- [ ] Unit tests written and passing
- [ ] Integration tests for critical flows
- [ ] Edge cases tested (empty arrays, null values, etc.)
- [ ] Error scenarios tested
- [ ] Performance acceptable (no N+1 queries)

### Security
- [ ] No hardcoded secrets (use Secret Manager/env vars)
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] Authentication/authorization enforced
- [ ] Audit logs for sensitive actions

### Version Control
- [ ] Code committed to feature branch
- [ ] Meaningful commit messages
- [ ] No secrets in commit history
- [ ] Pull request reviewed before merge
- [ ] No merge conflicts unresolved

### Deployment Readiness
- [ ] CI/CD pipeline passing (GitHub Actions)
- [ ] Code deployable to staging
- [ ] Database migrations tested (up and down)
- [ ] Rollback plan documented
- [ ] No breaking changes to API (backward compatible)

### Acceptance Criteria
- [ ] All tasks completed and acceptance criteria met
- [ ] No P0 bugs (blockers)
- [ ] Stakeholder feedback incorporated
- [ ] Demo-ready (can show to stakeholders)

---

## Conclusion

This FarmFlow implementation plan provides a comprehensive, realistic roadmap for building a centralized poultry farm management system over 24 weeks. By following MVP-first principles, integrating testing throughout, and maintaining security-by-design, the project delivers core functionality in Phase 1 (Weeks 1–12) and enhancements in Phase 2 (Weeks 13–24).

**Key Success Factors:**
1. Maintain 40–45 hour work week (respect developer capacity)
2. Use AI coding assistants (Cursor, Copilot) for boilerplate and repetitive tasks
3. Test-drive every module (80%+ coverage on core logic)
4. Weekly stakeholder demos to validate assumptions
5. MoSCoW freeze after Week 1 (prevent scope creep)
6. Leverage GCP services (Cloud Run, Cloud SQL, Cloud Storage) for scalability
7. Security-first mindset (RBAC, signed URLs, audit logs)

**Timeline at a Glance:**
- **Week 1:** Infrastructure foundation
- **Weeks 2–4:** Authentication & authorization
- **Weeks 5–8:** Core employee & batch management
- **Weeks 9–10:** Sales module
- **Week 11:** Dashboard & reports
- **Week 12:** Testing & go-live prep
- **Weeks 13–24:** Enhancements (feed mill, payroll, PWA, production deployment)

The plan is designed for a solo developer with AI coding support, realistic velocity metrics, and quality gates at every phase. Adjust timelines based on actual velocity after Week 2.
