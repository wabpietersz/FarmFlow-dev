# POULTRY FARM MANAGEMENT SYSTEM
## Complete Technical Solution Design

**Version:** 1.0  
**Date:** February 2026  
**Author:** Technical Architecture Team  
**Status:** For Implementation

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Technology Stack Details](#2-technology-stack-details)
3. [Database Design](#3-database-design)
4. [API Specification](#4-api-specification)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend Architecture](#6-backend-architecture)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [File Management](#8-file-management)
9. [Offline Support](#9-offline-support)
10. [Deployment Strategy](#10-deployment-strategy)
11. [Security Implementation](#11-security-implementation)
12. [Testing Strategy](#12-testing-strategy)
13. [Monitoring & Logging](#13-monitoring--logging)
14. [Development Workflow](#14-development-workflow)

---

## March 16, 2026 Addendum

The baseline sales section in this document reflects the original single-header sale and direct-payment model.

Sales requirements have now expanded to cover:

- multi-lorry batch sale capture
- buyer-level multi-line receipts
- overpayment carry-forward credit
- buyer running ledgers and outstanding balances

The authoritative implementation plan for that redesign is [docs/Sales-Module-Improvement-Plan.md](/Users/warrenpietersz/Projects/Personal/FarmFlow2/docs/Sales-Module-Improvement-Plan.md).

Any new work on sales, buyer settlements, or payment allocation should follow that plan instead of extending the older direct `sale -> payment` model described later in this document.

---

## 1. SYSTEM OVERVIEW

### 1.1 Purpose
A Progressive Web Application (PWA) for managing poultry farm operations including workforce management, batch tracking, feed mill operations, and financial management.

### 1.2 Technical Objectives
- **Performance**: < 3s page load, < 200ms API response
- **Availability**: 99% uptime during business hours
- **Scalability**: Support 20 concurrent users initially, scale to 100+
- **Security**: Role-based access, encrypted data, audit trails
- **Offline-first**: Mobile data entry works without internet
- **Cost-effective**: ~$85/month operational cost

### 1.3 Architecture Style
- **Frontend**: Single Page Application (SPA)
- **Backend**: RESTful API with stateless design
- **Database**: Relational (PostgreSQL)
- **Deployment**: Containerized microservices
- **Authentication**: Token-based (JWT)

---

## 2. TECHNOLOGY STACK DETAILS

### 2.1 Frontend Stack

#### Core Framework
```json
{
  "framework": "React 18.2+",
  "language": "TypeScript 5.3+",
  "buildTool": "Vite 5.0+",
  "runtime": "Node.js 20+",
  "packageManager": "npm"
}
```

#### UI Components & Styling
```json
{
  "componentLibrary": "Shadcn UI (Radix primitives)",
  "styling": "TailwindCSS 3.4+",
  "icons": "Lucide React",
  "fonts": "System sans-serif stack"
}
```

UI implementation guidance and page composition rules are maintained in `docs/UI-Handbook.md`. That document is the source of truth for operational page styling and layout consistency across modules.

#### State Management
```json
{
  "serverState": "TanStack Query 5.0+ (react-query)",
  "clientState": "Zustand 4.4+",
  "formState": "React Hook Form 7.48+"
}
```

#### Key Libraries
```javascript
// package.json (frontend)
{
  "dependencies": {
    // Core
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "typescript": "^5.3.0",
    
    // UI Components (Shadcn UI - copy/paste)
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-alert-dialog": "^1.0.5",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    
    // Styling
    "tailwindcss": "^3.4.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.1.0",
    
    // State Management
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.4.7",
    
    // Forms & Validation
    "react-hook-form": "^7.48.2",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.2",
    
    // Routing
    "react-router-dom": "^6.20.1",
    
    // HTTP Client
    "axios": "^1.6.2",
    
    // Utilities
    "date-fns": "^2.30.0",
    "recharts": "^2.10.3",
    "react-webcam": "^7.2.0",
    "lucide-react": "^0.294.0",
    
    // PWA
    "workbox-window": "^7.0.0",
    "localforage": "^1.10.0",
    
    // Firebase
    "firebase": "^10.7.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.0",
    "vite-plugin-pwa": "^0.17.4",
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "eslint": "^8.55.0",
    "prettier": "^3.1.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

### 2.2 Backend Stack

#### Core Framework
```json
{
  "framework": "Express.js 4.18+",
  "language": "TypeScript 5.3+",
  "runtime": "Node.js 20+",
  "orm": "Drizzle ORM 0.29+"
}
```

#### Key Libraries
```javascript
// package.json (backend)
{
  "dependencies": {
    // Core Framework
    "express": "^4.18.2",
    "typescript": "^5.3.3",
    
    // Database
    "drizzle-orm": "^0.29.1",
    "drizzle-kit": "^0.20.6",
    "postgres": "^3.4.3",
    
    // Authentication
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    
    // Validation
    "express-validator": "^7.0.1",
    "zod": "^3.22.4",
    
    // File Handling
    "multer": "^1.4.5-lts.1",
    "@google-cloud/storage": "^7.7.0",
    
    // Scheduling
    "node-cron": "^3.0.3",
    
    // Security
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5",
    
    // Logging
    "winston": "^3.11.0",
    "@google-cloud/logging-winston": "^5.3.0",
    
    // Utilities
    "dotenv": "^16.3.1",
    "compression": "^1.7.4",
    "date-fns": "^2.30.0",
    
    // Firebase Admin
    "firebase-admin": "^12.0.0",
    
    // PDF Generation
    "puppeteer": "^21.6.1",
    
    // Excel Generation
    "exceljs": "^4.4.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "@types/bcrypt": "^5.0.2",
    "@types/multer": "^1.4.11",
    "@types/cors": "^2.8.17",
    "tsx": "^4.7.0",
    "nodemon": "^3.0.2",
    "eslint": "^8.55.0",
    "prettier": "^3.1.1"
  }
}
```

### 2.3 Database

#### PostgreSQL Configuration
```yaml
Cloud SQL Instance:
  tier: db-n1-standard-1
  version: PostgreSQL 15
  storage: 50GB SSD
  backups: Automated daily
  high_availability: false (dev), true (prod)
  connection_limit: 100
  
Configuration:
  max_connections: 100
  shared_buffers: 256MB
  effective_cache_size: 1GB
  maintenance_work_mem: 64MB
  work_mem: 4MB
```

---

## 3. DATABASE DESIGN

### 3.1 Complete Schema (Drizzle ORM)

```typescript
// src/db/schema.ts

import { pgTable, uuid, varchar, timestamp, text, integer, decimal, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', [
  'system_admin',
  'farm_manager',
  'accountant',
  'supervisor',
  'feed_mill_operator',
  'farm_worker',
  'viewer'
]);

export const employmentTypeEnum = pgEnum('employment_type', [
  'full_time',
  'part_time',
  'contract',
  'casual'
]);

export const batchStatusEnum = pgEnum('batch_status', [
  'active',
  'growing',
  'ready_for_sale',
  'sold',
  'completed',
  'archived'
]);

export const cageStatusEnum = pgEnum('cage_status', [
  'available',
  'occupied',
  'under_cleaning',
  'under_maintenance'
]);

// Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Employees Table
export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: varchar('employee_id', { length: 50 }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  dateOfBirth: timestamp('date_of_birth'),
  contactNumber: varchar('contact_number', { length: 20 }),
  email: varchar('email', { length: 255 }),
  emergencyContact: jsonb('emergency_contact').$type<{
    name: string;
    phone: string;
    relationship: string;
  }>(),
  nationalId: varchar('national_id', { length: 50 }),
  joiningDate: timestamp('joining_date').notNull(),
  exitDate: timestamp('exit_date'),
  employmentType: employmentTypeEnum('employment_type').notNull(),
  designation: varchar('designation', { length: 100 }).notNull(),
  department: varchar('department', { length: 100 }),
  assignedSiteId: uuid('assigned_site_id'),
  reportingManagerId: uuid('reporting_manager_id'),
  bankDetails: jsonb('bank_details').$type<{
    bankName: string;
    accountNumber: string;
    branch: string;
    paymentMethod: 'bank_transfer' | 'cash' | 'cheque';
  }>(),
  baseSalary: decimal('base_salary', { precision: 10, scale: 2 }),
  payStructure: varchar('pay_structure', { length: 20 }), // hourly, daily, monthly
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Sites Table
export const sites = pgTable('sites', {
  id: uuid('id').defaultRandom().primaryKey(),
  siteName: varchar('site_name', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }),
  address: text('address'),
  siteManagerId: uuid('site_manager_id'),
  capacity: integer('capacity'),
  numberOfCages: integer('number_of_cages'),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Cages Table
export const cages = pgTable('cages', {
  id: uuid('id').defaultRandom().primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id),
  cageNumber: varchar('cage_number', { length: 50 }).notNull(),
  maxCapacity: integer('max_capacity').notNull(),
  floorArea: decimal('floor_area', { precision: 10, scale: 2 }),
  equipmentDetails: jsonb('equipment_details').$type<{
    feeders: number;
    drinkers: number;
    other: string;
  }>(),
  status: cageStatusEnum('status').default('available').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Batches Table
export const batches = pgTable('batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: varchar('batch_id', { length: 100 }).notNull().unique(),
  siteId: uuid('site_id').notNull().references(() => sites.id),
  cageId: uuid('cage_id').notNull().references(() => cages.id),
  placementDate: timestamp('placement_date').notNull(),
  chicksPlaced: integer('chicks_placed').notNull(),
  initialAvgWeight: decimal('initial_avg_weight', { precision: 10, scale: 2 }),
  costPerChick: decimal('cost_per_chick', { precision: 10, scale: 2 }),
  supplierDetails: jsonb('supplier_details').$type<{
    name: string;
    contact: string;
  }>(),
  expectedSaleDate: timestamp('expected_sale_date'),
  actualSaleDate: timestamp('actual_sale_date'),
  status: batchStatusEnum('status').default('active').notNull(),
  totalMortality: integer('total_mortality').default(0),
  currentBirdCount: integer('current_bird_count'),
  totalFeedConsumed: decimal('total_feed_consumed', { precision: 12, scale: 2 }).default('0'),
  totalCost: decimal('total_cost', { precision: 12, scale: 2 }).default('0'),
  totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }).default('0'),
  profitMargin: decimal('profit_margin', { precision: 10, scale: 2 }),
  fcr: decimal('fcr', { precision: 10, scale: 2 }), // Feed Conversion Ratio
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Daily Records Table
export const dailyRecords = pgTable('daily_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull().references(() => batches.id, { onDelete: 'cascade' }),
  recordDate: timestamp('record_date').notNull(),
  ageInDays: integer('age_in_days').notNull(),
  mortalityCount: integer('mortality_count').default(0),
  mortalityCause: varchar('mortality_cause', { length: 100 }),
  sampleSize: integer('sample_size'),
  totalSampleWeight: decimal('total_sample_weight', { precision: 10, scale: 2 }),
  avgWeight: decimal('avg_weight', { precision: 10, scale: 2 }),
  weightGain: decimal('weight_gain', { precision: 10, scale: 2 }),
  feedType: varchar('feed_type', { length: 50 }), // starter, grower, finisher
  feedConsumed: decimal('feed_consumed', { precision: 10, scale: 2 }),
  waterConsumed: decimal('water_consumed', { precision: 10, scale: 2 }),
  temperature: jsonb('temperature').$type<{
    min: number;
    max: number;
    avg: number;
  }>(),
  humidity: decimal('humidity', { precision: 5, scale: 2 }),
  notes: text('notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>(),
  recordedBy: uuid('recorded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Vaccinations Table
export const vaccinations = pgTable('vaccinations', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull().references(() => batches.id, { onDelete: 'cascade' }),
  vaccineName: varchar('vaccine_name', { length: 255 }).notNull(),
  scheduledDate: timestamp('scheduled_date').notNull(),
  actualDate: timestamp('actual_date'),
  dosage: varchar('dosage', { length: 100 }),
  administeredBy: uuid('administered_by').references(() => employees.id),
  cost: decimal('cost', { precision: 10, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Feed Inventory Table
export const feedInventory = pgTable('feed_inventory', {
  id: uuid('id').defaultRandom().primaryKey(),
  materialType: varchar('material_type', { length: 100 }).notNull(),
  materialName: varchar('material_name', { length: 255 }).notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 2 }).notNull(),
  unit: varchar('unit', { length: 20 }).notNull(), // kg, tons
  unitCost: decimal('unit_cost', { precision: 10, scale: 2 }),
  supplierName: varchar('supplier_name', { length: 255 }),
  purchaseDate: timestamp('purchase_date'),
  expiryDate: timestamp('expiry_date'),
  minStockLevel: decimal('min_stock_level', { precision: 10, scale: 2 }),
  location: varchar('location', { length: 100 }),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Feed Production Table
export const feedProduction = pgTable('feed_production', {
  id: uuid('id').defaultRandom().primaryKey(),
  productionId: varchar('production_id', { length: 100 }).notNull().unique(),
  feedType: varchar('feed_type', { length: 50 }).notNull(),
  productionDate: timestamp('production_date').notNull(),
  quantityProduced: decimal('quantity_produced', { precision: 12, scale: 2 }).notNull(),
  formula: jsonb('formula').$type<Array<{
    materialId: string;
    materialName: string;
    quantity: number;
    cost: number;
  }>>(),
  totalCost: decimal('total_cost', { precision: 12, scale: 2 }),
  costPerKg: decimal('cost_per_kg', { precision: 10, scale: 2 }),
  producedBy: uuid('produced_by').references(() => employees.id),
  qualityCheck: jsonb('quality_check').$type<{
    passed: boolean;
    notes: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Sales Table
export const sales = pgTable('sales', {
  id: uuid('id').defaultRandom().primaryKey(),
  saleId: varchar('sale_id', { length: 100 }).notNull().unique(),
  batchId: uuid('batch_id').notNull().references(() => batches.id),
  saleDate: timestamp('sale_date').notNull(),
  buyerName: varchar('buyer_name', { length: 255 }).notNull(),
  buyerContact: varchar('buyer_contact', { length: 50 }),
  buyerAddress: text('buyer_address'),
  quantitySold: integer('quantity_sold').notNull(), // number of birds
  totalWeight: decimal('total_weight', { precision: 10, scale: 2 }),
  avgWeightPerBird: decimal('avg_weight_per_bird', { precision: 10, scale: 2 }),
  pricePerKg: decimal('price_per_kg', { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 12, scale: 2 }).default('0'),
  outstandingAmount: decimal('outstanding_amount', { precision: 12, scale: 2 }),
  paymentStatus: varchar('payment_status', { length: 20 }).default('pending'), // pending, partial, paid
  paymentMethod: varchar('payment_method', { length: 50 }),
  invoiceUrl: varchar('invoice_url', { length: 500 }),
  notes: text('notes'),
  recordedBy: uuid('recorded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Payments Table
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  saleId: uuid('sale_id').notNull().references(() => sales.id, { onDelete: 'cascade' }),
  paymentDate: timestamp('payment_date').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }),
  notes: text('notes'),
  recordedBy: uuid('recorded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Attendance Table
export const attendance = pgTable('attendance', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  attendanceDate: timestamp('attendance_date').notNull(),
  status: varchar('status', { length: 20 }).notNull(), // present, absent, half_day, leave
  clockIn: timestamp('clock_in'),
  clockOut: timestamp('clock_out'),
  hoursWorked: decimal('hours_worked', { precision: 5, scale: 2 }),
  overtimeHours: decimal('overtime_hours', { precision: 5, scale: 2 }).default('0'),
  notes: text('notes'),
  approvedBy: uuid('approved_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Payroll Table
export const payroll = pgTable('payroll', {
  id: uuid('id').defaultRandom().primaryKey(),
  payrollId: varchar('payroll_id', { length: 100 }).notNull().unique(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  totalDays: integer('total_days').notNull(),
  daysWorked: integer('days_worked').notNull(),
  hoursWorked: decimal('hours_worked', { precision: 10, scale: 2 }),
  overtimeHours: decimal('overtime_hours', { precision: 10, scale: 2 }).default('0'),
  baseSalary: decimal('base_salary', { precision: 12, scale: 2 }).notNull(),
  overtimePay: decimal('overtime_pay', { precision: 12, scale: 2 }).default('0'),
  allowances: jsonb('allowances').$type<Array<{
    type: string;
    amount: number;
  }>>(),
  totalAllowances: decimal('total_allowances', { precision: 12, scale: 2 }).default('0'),
  deductions: jsonb('deductions').$type<Array<{
    type: string;
    amount: number;
  }>>(),
  totalDeductions: decimal('total_deductions', { precision: 12, scale: 2 }).default('0'),
  grossSalary: decimal('gross_salary', { precision: 12, scale: 2 }).notNull(),
  netSalary: decimal('net_salary', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('draft'), // draft, approved, paid
  paymentDate: timestamp('payment_date'),
  paymentMethod: varchar('payment_method', { length: 50 }),
  payslipUrl: varchar('payslip_url', { length: 500 }),
  approvedBy: uuid('approved_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Audit Logs Table
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(), // create, update, delete, login, logout
  tableName: varchar('table_name', { length: 100 }),
  recordId: uuid('record_id'),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').defaultNow().notNull()
});

// Documents Table
export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // employee, batch, etc.
  entityId: uuid('entity_id').notNull(),
  documentType: varchar('document_type', { length: 100 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileUrl: varchar('file_url', { length: 500 }).notNull(),
  fileSize: integer('file_size'),
  mimeType: varchar('mime_type', { length: 100 }),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});
```

### 3.2 Database Indexes

```typescript
// Add to schema.ts
import { index } from 'drizzle-orm/pg-core';

// Performance indexes
export const batchStatusIdx = index('batch_status_idx').on(batches.status);
export const batchCageIdx = index('batch_cage_idx').on(batches.cageId);
export const dailyRecordBatchIdx = index('daily_record_batch_idx').on(dailyRecords.batchId);
export const dailyRecordDateIdx = index('daily_record_date_idx').on(dailyRecords.recordDate);
export const employeeIdIdx = index('employee_id_idx').on(employees.employeeId);
export const attendanceEmployeeIdx = index('attendance_employee_idx').on(attendance.employeeId);
export const attendanceDateIdx = index('attendance_date_idx').on(attendance.attendanceDate);
export const salesBatchIdx = index('sales_batch_idx').on(sales.batchId);
export const auditTimestampIdx = index('audit_timestamp_idx').on(auditLogs.timestamp);
```

### 3.3 Database Migrations

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

```bash
# Generate migration
npx drizzle-kit generate:pg

# Run migration
npx drizzle-kit push:pg
```

---

## 4. API SPECIFICATION

### 4.1 API Design Principles

- RESTful architecture
- JSON request/response
- JWT authentication
- Versioned API (/api/v1)
- Consistent error responses
- Pagination for lists
- Rate limiting

### 4.2 Request/Response Format

#### Standard Response Structure
```typescript
// Success Response
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}

// Paginated Response
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### 4.3 Authentication Endpoints

#### POST /api/auth/register
```typescript
// Request
{
  "email": "user@example.com",
  "password": "StrongPass123!",
  "role": "farm_manager"
}

// Response (201)
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "role": "farm_manager",
    "token": "jwt-token",
    "refreshToken": "refresh-token"
  },
  "message": "User registered successfully"
}
```

#### POST /api/auth/login
```typescript
// Request
{
  "email": "user@example.com",
  "password": "StrongPass123!"
}

// Response (200)
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "role": "farm_manager",
    "token": "jwt-token",
    "refreshToken": "refresh-token",
    "expiresIn": 3600
  }
}
```

#### POST /api/auth/refresh
```typescript
// Request
{
  "refreshToken": "refresh-token"
}

// Response (200)
{
  "success": true,
  "data": {
    "token": "new-jwt-token",
    "expiresIn": 3600
  }
}
```

### 4.4 Employee Endpoints

#### GET /api/employees
```typescript
// Query Parameters
?page=1&limit=20&search=john&status=active&department=farm

// Response (200)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "employeeId": "EMP001",
      "fullName": "John Doe",
      "designation": "Supervisor",
      "department": "Farm Operations",
      "contactNumber": "+94771234567",
      "status": "active",
      "joiningDate": "2024-01-15T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

#### GET /api/employees/:id
```typescript
// Response (200)
{
  "success": true,
  "data": {
    "id": "uuid",
    "employeeId": "EMP001",
    "fullName": "John Doe",
    "dateOfBirth": "1990-05-15",
    "contactNumber": "+94771234567",
    "email": "john@example.com",
    "emergencyContact": {
      "name": "Jane Doe",
      "phone": "+94771234568",
      "relationship": "spouse"
    },
    "nationalId": "901234567V",
    "joiningDate": "2024-01-15T00:00:00Z",
    "employmentType": "full_time",
    "designation": "Supervisor",
    "department": "Farm Operations",
    "bankDetails": {
      "bankName": "Commercial Bank",
      "accountNumber": "123456789",
      "branch": "Colombo",
      "paymentMethod": "bank_transfer"
    },
    "baseSalary": 50000.00,
    "payStructure": "monthly",
    "status": "active"
  }
}
```

#### POST /api/employees
```typescript
// Request
{
  "fullName": "John Doe",
  "dateOfBirth": "1990-05-15",
  "contactNumber": "+94771234567",
  "email": "john@example.com",
  "nationalId": "901234567V",
  "joiningDate": "2024-01-15",
  "employmentType": "full_time",
  "designation": "Supervisor",
  "department": "Farm Operations",
  "baseSalary": 50000.00,
  "payStructure": "monthly"
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "uuid",
    "employeeId": "EMP001",
    "fullName": "John Doe",
    ...
  },
  "message": "Employee created successfully"
}
```

#### PUT /api/employees/:id
```typescript
// Request (partial update allowed)
{
  "contactNumber": "+94771234568",
  "baseSalary": 55000.00
}

// Response (200)
{
  "success": true,
  "data": { ... },
  "message": "Employee updated successfully"
}
```

#### DELETE /api/employees/:id
```typescript
// Response (200)
{
  "success": true,
  "message": "Employee deactivated successfully"
}
// Note: Soft delete (sets status to 'inactive')
```

### 4.5 Batch Endpoints

#### GET /api/batches
```typescript
// Query Parameters
?page=1&limit=20&status=active&siteId=uuid&cageId=uuid

// Response (200)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "batchId": "BATCH-SITE1-CAGE1-20260201",
      "siteName": "Main Farm",
      "cageName": "Cage 1",
      "placementDate": "2026-02-01T00:00:00Z",
      "chicksPlaced": 10000,
      "currentBirdCount": 9850,
      "ageInDays": 15,
      "status": "active",
      "fcr": 1.45,
      "mortalityRate": 1.5
    }
  ],
  "pagination": { ... }
}
```

#### GET /api/batches/:id
```typescript
// Response (200)
{
  "success": true,
  "data": {
    "id": "uuid",
    "batchId": "BATCH-SITE1-CAGE1-20260201",
    "site": {
      "id": "uuid",
      "siteName": "Main Farm"
    },
    "cage": {
      "id": "uuid",
      "cageNumber": "Cage 1",
      "maxCapacity": 12000
    },
    "placementDate": "2026-02-01T00:00:00Z",
    "chicksPlaced": 10000,
    "initialAvgWeight": 45.00,
    "costPerChick": 120.00,
    "supplierDetails": {
      "name": "Cobb Hatchery",
      "contact": "+94771234567"
    },
    "currentBirdCount": 9850,
    "totalMortality": 150,
    "mortalityRate": 1.5,
    "ageInDays": 15,
    "totalFeedConsumed": 14500.00,
    "fcr": 1.45,
    "avgWeight": 750.00,
    "totalCost": 1650000.00,
    "status": "active",
    "latestRecord": {
      "recordDate": "2026-02-15T00:00:00Z",
      "mortalityCount": 5,
      "avgWeight": 750.00,
      "feedConsumed": 1200.00
    }
  }
}
```

#### POST /api/batches
```typescript
// Request
{
  "siteId": "uuid",
  "cageId": "uuid",
  "placementDate": "2026-02-01",
  "chicksPlaced": 10000,
  "initialAvgWeight": 45.00,
  "costPerChick": 120.00,
  "supplierDetails": {
    "name": "Cobb Hatchery",
    "contact": "+94771234567"
  },
  "expectedSaleDate": "2026-03-15"
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "uuid",
    "batchId": "BATCH-SITE1-CAGE1-20260201",
    ...
  },
  "message": "Batch created successfully"
}
```

### 4.6 Daily Records Endpoints

#### GET /api/batches/:batchId/daily-records
```typescript
// Query Parameters
?startDate=2026-02-01&endDate=2026-02-15

// Response (200)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "recordDate": "2026-02-15T00:00:00Z",
      "ageInDays": 15,
      "mortalityCount": 5,
      "avgWeight": 750.00,
      "feedConsumed": 1200.00,
      "temperature": {
        "min": 28,
        "max": 32,
        "avg": 30
      },
      "notes": "Birds healthy, feeding well"
    }
  ]
}
```

#### POST /api/batches/:batchId/daily-records
```typescript
// Request
{
  "recordDate": "2026-02-15",
  "mortalityCount": 5,
  "mortalityCause": "heat_stress",
  "sampleSize": 50,
  "totalSampleWeight": 37.5,
  "feedType": "grower",
  "feedConsumed": 1200.00,
  "waterConsumed": 2500.00,
  "temperature": {
    "min": 28,
    "max": 32,
    "avg": 30
  },
  "humidity": 65,
  "notes": "Birds healthy, feeding well",
  "photoUrls": ["https://storage.googleapis.com/..."]
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "uuid",
    "recordDate": "2026-02-15T00:00:00Z",
    "ageInDays": 15,
    "mortalityCount": 5,
    "avgWeight": 750.00,
    ...
  },
  "message": "Daily record created successfully"
}
```

### 4.7 Sales Endpoints

#### GET /api/sales
```typescript
// Query Parameters
?page=1&limit=20&batchId=uuid&paymentStatus=pending

// Response (200)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "saleId": "SALE-20260315-001",
      "batchId": "BATCH-SITE1-CAGE1-20260201",
      "buyerName": "ABC Traders",
      "saleDate": "2026-03-15T00:00:00Z",
      "quantitySold": 9800,
      "totalAmount": 2940000.00,
      "paidAmount": 1500000.00,
      "outstandingAmount": 1440000.00,
      "paymentStatus": "partial"
    }
  ],
  "pagination": { ... }
}
```

#### POST /api/sales
```typescript
// Request
{
  "batchId": "uuid",
  "saleDate": "2026-03-15",
  "buyerName": "ABC Traders",
  "buyerContact": "+94771234567",
  "buyerAddress": "123 Main St, Colombo",
  "quantitySold": 9800,
  "totalWeight": 24500.00,
  "pricePerKg": 120.00,
  "totalAmount": 2940000.00,
  "paymentMethod": "bank_transfer",
  "notes": "First sale from batch"
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "uuid",
    "saleId": "SALE-20260315-001",
    ...
  },
  "message": "Sale created successfully"
}
```

#### POST /api/sales/:id/payments
```typescript
// Request
{
  "paymentDate": "2026-03-20",
  "amount": 1440000.00,
  "paymentMethod": "bank_transfer",
  "referenceNumber": "TXN123456",
  "notes": "Final payment"
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "uuid",
    "saleId": "uuid",
    "paymentDate": "2026-03-20T00:00:00Z",
    "amount": 1440000.00,
    ...
  },
  "message": "Payment recorded successfully"
}
```

### 4.8 Payroll Endpoints

#### POST /api/payroll/generate
```typescript
// Request
{
  "periodStart": "2026-02-01",
  "periodEnd": "2026-02-29",
  "employeeIds": ["uuid1", "uuid2"] // optional, empty for all
}

// Response (201)
{
  "success": true,
  "data": {
    "payrollCount": 50,
    "totalGrossSalary": 2500000.00,
    "totalNetSalary": 2300000.00,
    "status": "draft"
  },
  "message": "Payroll generated successfully"
}
```

#### GET /api/payroll
```typescript
// Query Parameters
?page=1&limit=20&status=draft&periodStart=2026-02-01

// Response (200)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "payrollId": "PAY-202602-001",
      "employee": {
        "id": "uuid",
        "employeeId": "EMP001",
        "fullName": "John Doe"
      },
      "periodStart": "2026-02-01",
      "periodEnd": "2026-02-29",
      "grossSalary": 50000.00,
      "netSalary": 46000.00,
      "status": "draft"
    }
  ],
  "pagination": { ... }
}
```

#### POST /api/payroll/:id/approve
```typescript
// Response (200)
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "approved",
    ...
  },
  "message": "Payroll approved successfully"
}
```

### 4.9 File Upload Endpoints

#### POST /api/upload
```typescript
// Request (multipart/form-data)
FormData: {
  file: <file>,
  entityType: "employee",
  entityId: "uuid",
  documentType: "id_card"
}

// Response (200)
{
  "success": true,
  "data": {
    "fileUrl": "https://storage.googleapis.com/poultry-uploads/...",
    "fileName": "id_card.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf"
  },
  "message": "File uploaded successfully"
}
```

### 4.10 Reports Endpoints

#### GET /api/reports/dashboard
```typescript
// Response (200)
{
  "success": true,
  "data": {
    "activeBatches": 5,
    "totalBirds": 48500,
    "avgFCR": 1.52,
    "currentMonthSales": 15000000.00,
    "mortalityRate": 1.8,
    "feedStockKg": 8500.00,
    "pendingPayroll": 3,
    "recentAlerts": [
      {
        "type": "mortality",
        "batchId": "BATCH-001",
        "message": "High mortality detected",
        "timestamp": "2026-02-15T10:30:00Z"
      }
    ]
  }
}
```

#### GET /api/reports/batch-profitability/:batchId
```typescript
// Response (200)
{
  "success": true,
  "data": {
    "batchId": "BATCH-SITE1-CAGE1-20260201",
    "costs": {
      "chicks": 1200000.00,
      "feed": 450000.00,
      "medication": 25000.00,
      "labor": 80000.00,
      "utilities": 15000.00,
      "other": 10000.00,
      "total": 1780000.00
    },
    "revenue": {
      "totalSales": 2940000.00
    },
    "profit": 1160000.00,
    "profitMargin": 39.46,
    "fcr": 1.45,
    "costPerBird": 181.63,
    "revenuePerBird": 300.00
  }
}
```

---

## 5. FRONTEND ARCHITECTURE

### 5.1 Project Structure

```
frontend/
├── public/
│   ├── manifest.json
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── offline.html
│
├── src/
│   ├── components/
│   │   ├── ui/               # Shadcn UI components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   └── toast.tsx
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MobileNav.tsx
│   │   ├── forms/
│   │   │   ├── EmployeeForm.tsx
│   │   │   ├── BatchForm.tsx
│   │   │   ├── DailyEntryForm.tsx
│   │   │   └── SaleForm.tsx
│   │   └── charts/
│   │       ├── MortalityChart.tsx
│   │       ├── FeedConsumptionChart.tsx
│   │       └── ProfitChart.tsx
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── employees/
│   │   │   ├── EmployeesPage.tsx
│   │   │   ├── EmployeeDetailsPage.tsx
│   │   │   └── AttendancePage.tsx
│   │   ├── batches/
│   │   │   ├── BatchesPage.tsx
│   │   │   ├── BatchDetailsPage.tsx
│   │   │   └── DailyEntryPage.tsx
│   │   ├── feed/
│   │   │   ├── InventoryPage.tsx
│   │   │   └── ProductionPage.tsx
│   │   ├── sales/
│   │   │   ├── SalesPage.tsx
│   │   │   └── SaleDetailsPage.tsx
│   │   └── payroll/
│   │       ├── PayrollPage.tsx
│   │       └── PayslipPage.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useOffline.ts
│   │   ├── useEmployees.ts
│   │   ├── useBatches.ts
│   │   ├── useSales.ts
│   │   ├── usePayroll.ts
│   │   └── useCamera.ts
│   │
│   ├── lib/
│   │   ├── api.ts           # Axios instance
│   │   ├── utils.ts         # Utility functions
│   │   ├── constants.ts     # App constants
│   │   └── validators.ts    # Zod schemas
│   │
│   ├── store/
│   │   ├── authStore.ts     # Zustand auth store
│   │   ├── offlineStore.ts  # Offline queue
│   │   └── uiStore.ts       # UI state
│   │
│   ├── types/
│   │   ├── api.types.ts
│   │   ├── employee.types.ts
│   │   ├── batch.types.ts
│   │   ├── sale.types.ts
│   │   └── payroll.types.ts
│   │
│   ├── services/
│   │   ├── offline.service.ts
│   │   ├── storage.service.ts
│   │   └── notification.service.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   ├── sw.ts                # Service Worker
│   └── vite-env.d.ts
│
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### 5.2 State Management Strategy

#### Zustand Store Example
```typescript
// src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        const response = await api.post('/auth/login', { email, password });
        const { user, token } = response.data.data;
        
        set({
          user,
          token,
          isAuthenticated: true
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false
        });
      },

      refreshToken: async () => {
        // Token refresh logic
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
```

#### TanStack Query Setup
```typescript
// src/lib/api.ts
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, try refresh
      try {
        await useAuthStore.getState().refreshToken();
        // Retry original request
        return api(error.config);
      } catch {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

```typescript
// src/hooks/useBatches.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Batch } from '@/types/batch.types';

export function useBatches(filters?: { status?: string; siteId?: string }) {
  return useQuery({
    queryKey: ['batches', filters],
    queryFn: async () => {
      const response = await api.get('/batches', { params: filters });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Batch>) => {
      const response = await api.post('/batches', data);
      return response.data.data;
    },
    onSuccess: () => {
      // Invalidate and refetch batches
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    }
  });
}
```

### 5.3 Offline Support Implementation

```typescript
// src/services/offline.service.ts
import localforage from 'localforage';
import { useOfflineStore } from '@/store/offlineStore';

interface QueueItem {
  id: string;
  url: string;
  method: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

class OfflineService {
  private queue: LocalForage;

  constructor() {
    this.queue = localforage.createInstance({
      name: 'offline-queue'
    });
  }

  async addToQueue(url: string, method: string, data: any) {
    const item: QueueItem = {
      id: `${Date.now()}-${Math.random()}`,
      url,
      method,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    const queue = await this.getQueue();
    queue.push(item);
    await this.queue.setItem('queue', queue);

    useOfflineStore.getState().setQueueSize(queue.length);
  }

  async getQueue(): Promise<QueueItem[]> {
    return (await this.queue.getItem<QueueItem[]>('queue')) || [];
  }

  async processQueue() {
    const queue = await this.getQueue();
    const processed: string[] = [];

    for (const item of queue) {
      try {
        await api.request({
          url: item.url,
          method: item.method,
          data: item.data
        });
        processed.push(item.id);
      } catch (error) {
        item.retryCount++;
        if (item.retryCount > 3) {
          // Failed after 3 retries, mark for manual review
          console.error('Failed to sync:', item);
          processed.push(item.id);
        }
      }
    }

    // Remove processed items
    const remaining = queue.filter(item => !processed.includes(item.id));
    await this.queue.setItem('queue', remaining);
    useOfflineStore.getState().setQueueSize(remaining.length);

    return {
      processed: processed.length,
      remaining: remaining.length
    };
  }
}

export const offlineService = new OfflineService();

// Hook to check online status
export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      offlineService.processQueue(); // Auto-sync when back online
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

### 5.4 Service Worker Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      
      manifest: {
        name: 'Poultry Farm Management System',
        short_name: 'Farm Manager',
        description: 'Complete poultry farm operations management',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.yourfarm\.com\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      }
    })
  ]
});
```

---

## 6. BACKEND ARCHITECTURE

### 6.1 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── firebase.ts
│   │   ├── storage.ts
│   │   └── logger.ts
│   │
│   ├── db/
│   │   ├── schema.ts
│   │   ├── client.ts
│   │   └── migrations/
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── rbac.middleware.ts
│   │   ├── validation.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── logging.middleware.ts
│   │
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── employees.routes.ts
│   │   ├── batches.routes.ts
│   │   ├── feed.routes.ts
│   │   ├── sales.routes.ts
│   │   ├── payroll.routes.ts
│   │   ├── reports.routes.ts
│   │   └── upload.routes.ts
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── employees.controller.ts
│   │   ├── batches.controller.ts
│   │   ├── feed.controller.ts
│   │   ├── sales.controller.ts
│   │   ├── payroll.controller.ts
│   │   └── reports.controller.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── employees.service.ts
│   │   ├── batches.service.ts
│   │   ├── feed.service.ts
│   │   ├── sales.service.ts
│   │   ├── payroll.service.ts
│   │   ├── storage.service.ts
│   │   ├── email.service.ts
│   │   └── audit.service.ts
│   │
│   ├── validators/
│   │   ├── auth.validator.ts
│   │   ├── employee.validator.ts
│   │   ├── batch.validator.ts
│   │   └── sale.validator.ts
│   │
│   ├── utils/
│   │   ├── helpers.ts
│   │   ├── constants.ts
│   │   └── errors.ts
│   │
│   ├── types/
│   │   ├── express.d.ts
│   │   └── index.ts
│   │
│   ├── jobs/
│   │   ├── dailyBackup.job.ts
│   │   ├── feedStockAlert.job.ts
│   │   └── reportGeneration.job.ts
│   │
│   ├── app.ts
│   └── server.ts
│
├── Dockerfile
├── .dockerignore
├── .env.example
├── drizzle.config.ts
├── tsconfig.json
└── package.json
```

### 6.2 Express Application Setup

```typescript
// src/app.ts
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Middleware
import { loggingMiddleware } from './middleware/logging.middleware';
import { errorMiddleware } from './middleware/error.middleware';

// Routes
import authRoutes from './routes/auth.routes';
import employeeRoutes from './routes/employees.routes';
import batchRoutes from './routes/batches.routes';
import feedRoutes from './routes/feed.routes';
import salesRoutes from './routes/sales.routes';
import payrollRoutes from './routes/payroll.routes';
import reportsRoutes from './routes/reports.routes';
import uploadRoutes from './routes/upload.routes';

const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
app.use(loggingMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/upload', uploadRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    }
  });
});

// Error handler
app.use(errorMiddleware);

export default app;
```

```typescript
// src/server.ts
import app from './app';
import { logger } from './config/logger';
import { initializeDatabase } from './config/database';
import './jobs'; // Initialize cron jobs

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
```

### 6.3 Authentication Implementation

```typescript
// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { AppError } from '../utils/errors';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.substring(7);

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(users.email, decodedToken.email!)
    });

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401, 'UNAUTHORIZED');
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid token', 401, 'UNAUTHORIZED'));
    }
  }
}
```

```typescript
// src/middleware/rbac.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

type UserRole = 
  | 'system_admin'
  | 'farm_manager'
  | 'accountant'
  | 'supervisor'
  | 'feed_mill_operator'
  | 'farm_worker'
  | 'viewer';

const roleHierarchy: Record<UserRole, number> = {
  system_admin: 7,
  farm_manager: 6,
  accountant: 5,
  supervisor: 4,
  feed_mill_operator: 3,
  farm_worker: 2,
  viewer: 1
};

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
    }

    const userRole = req.user.role as UserRole;
    const userLevel = roleHierarchy[userRole];

    const hasAccess = allowedRoles.some(role => {
      const requiredLevel = roleHierarchy[role];
      return userLevel >= requiredLevel;
    });

    if (!hasAccess) {
      return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
    }

    next();
  };
}

// Usage example
// router.post('/batches', authMiddleware, requireRole(['farm_manager', 'supervisor']), createBatch);
```

### 6.4 Database Service Layer

```typescript
// src/services/batches.service.ts
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../config/database';
import { batches, dailyRecords, cages, sites } from '../db/schema';
import { AppError } from '../utils/errors';

export class BatchesService {
  async create(data: CreateBatchInput) {
    // Check cage availability
    const cage = await db.query.cages.findFirst({
      where: eq(cages.id, data.cageId)
    });

    if (!cage) {
      throw new AppError('Cage not found', 404, 'NOT_FOUND');
    }

    if (cage.status !== 'available') {
      throw new AppError('Cage is not available', 400, 'BAD_REQUEST');
    }

    // Generate batch ID
    const batchId = await this.generateBatchId(data.siteId, data.cageId);

    // Create batch
    const [batch] = await db.insert(batches).values({
      batchId,
      siteId: data.siteId,
      cageId: data.cageId,
      placementDate: new Date(data.placementDate),
      chicksPlaced: data.chicksPlaced,
      initialAvgWeight: data.initialAvgWeight,
      costPerChick: data.costPerChick,
      supplierDetails: data.supplierDetails,
      expectedSaleDate: data.expectedSaleDate ? new Date(data.expectedSaleDate) : null,
      currentBirdCount: data.chicksPlaced,
      status: 'active'
    }).returning();

    // Update cage status
    await db.update(cages)
      .set({ status: 'occupied' })
      .where(eq(cages.id, data.cageId));

    return batch;
  }

  async getById(id: string) {
    const batch = await db.query.batches.findFirst({
      where: eq(batches.id, id),
      with: {
        site: true,
        cage: true,
        dailyRecords: {
          orderBy: [desc(dailyRecords.recordDate)],
          limit: 1
        }
      }
    });

    if (!batch) {
      throw new AppError('Batch not found', 404, 'NOT_FOUND');
    }

    return batch;
  }

  async list(filters: BatchFilters) {
    let query = db.select().from(batches);

    if (filters.status) {
      query = query.where(eq(batches.status, filters.status));
    }

    if (filters.siteId) {
      query = query.where(eq(batches.siteId, filters.siteId));
    }

    if (filters.cageId) {
      query = query.where(eq(batches.cageId, filters.cageId));
    }

    const results = await query
      .orderBy(desc(batches.createdAt))
      .limit(filters.limit || 20)
      .offset((filters.page - 1) * (filters.limit || 20));

    return results;
  }

  async addDailyRecord(batchId: string, data: DailyRecordInput) {
    // Get batch
    const batch = await this.getById(batchId);

    // Calculate age
    const ageInDays = Math.floor(
      (new Date(data.recordDate).getTime() - batch.placementDate.getTime()) /
      (1000 * 60 * 60 * 24)
    );

    // Calculate avg weight
    const avgWeight = data.totalSampleWeight / data.sampleSize;

    // Create daily record
    const [record] = await db.insert(dailyRecords).values({
      batchId,
      recordDate: new Date(data.recordDate),
      ageInDays,
      mortalityCount: data.mortalityCount,
      mortalityCause: data.mortalityCause,
      sampleSize: data.sampleSize,
      totalSampleWeight: data.totalSampleWeight,
      avgWeight,
      feedType: data.feedType,
      feedConsumed: data.feedConsumed,
      waterConsumed: data.waterConsumed,
      temperature: data.temperature,
      humidity: data.humidity,
      notes: data.notes,
      photoUrls: data.photoUrls,
      recordedBy: data.recordedBy
    }).returning();

    // Update batch totals
    await db.update(batches)
      .set({
        totalMortality: batch.totalMortality + data.mortalityCount,
        currentBirdCount: batch.currentBirdCount - data.mortalityCount,
        totalFeedConsumed: Number(batch.totalFeedConsumed) + data.feedConsumed,
        updatedAt: new Date()
      })
      .where(eq(batches.id, batchId));

    // Calculate FCR
    await this.calculateFCR(batchId);

    return record;
  }

  private async calculateFCR(batchId: string) {
    const batch = await this.getById(batchId);
    
    // FCR = Total Feed Consumed / Total Weight Gained
    const totalWeightGained = 
      (Number(batch.dailyRecords[0]?.avgWeight || 0) - Number(batch.initialAvgWeight)) *
      batch.currentBirdCount;

    const fcr = Number(batch.totalFeedConsumed) / (totalWeightGained / 1000);

    await db.update(batches)
      .set({ fcr: fcr.toFixed(2) })
      .where(eq(batches.id, batchId));
  }

  private async generateBatchId(siteId: string, cageId: string): Promise<string> {
    const site = await db.query.sites.findFirst({
      where: eq(sites.id, siteId)
    });

    const cage = await db.query.cages.findFirst({
      where: eq(cages.id, cageId)
    });

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    return `BATCH-${site?.siteName.toUpperCase()}-${cage?.cageNumber}-${date}`;
  }
}
```

### 6.5 File Upload Service

```typescript
// src/services/storage.service.ts
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { AppError } from '../utils/errors';

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!);

export class StorageService {
  async uploadFile(
    file: Express.Multer.File,
    entityType: string,
    entityId: string
  ): Promise<string> {
    try {
      const fileExtension = path.extname(file.originalname);
      const fileName = `${entityType}/${entityId}/${uuidv4()}${fileExtension}`;

      const blob = bucket.file(fileName);
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: file.mimetype
        }
      });

      return new Promise((resolve, reject) => {
        blobStream.on('error', (error) => {
          reject(new AppError('File upload failed', 500, 'UPLOAD_ERROR'));
        });

        blobStream.on('finish', async () => {
          // Make file publicly accessible (or use signed URLs)
          await blob.makePublic();
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
          resolve(publicUrl);
        });

        blobStream.end(file.buffer);
      });
    } catch (error) {
      throw new AppError('File upload failed', 500, 'UPLOAD_ERROR');
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const fileName = fileUrl.split(`${bucket.name}/`)[1];
      await bucket.file(fileName).delete();
    } catch (error) {
      throw new AppError('File deletion failed', 500, 'DELETE_ERROR');
    }
  }

  async getSignedUrl(fileName: string, expiresIn: number = 3600): Promise<string> {
    const [url] = await bucket.file(fileName).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresIn * 1000
    });

    return url;
  }
}

export const storageService = new StorageService();
```

### 6.6 Scheduled Jobs

```typescript
// src/jobs/index.ts
import cron from 'node-cron';
import { logger } from '../config/logger';
import { feedStockAlert } from './feedStockAlert.job';
import { dailyBackup } from './dailyBackup.job';

// Run feed stock check every 6 hours
cron.schedule('0 */6 * * *', async () => {
  logger.info('Running feed stock alert job');
  try {
    await feedStockAlert();
  } catch (error) {
    logger.error('Feed stock alert job failed:', error);
  }
});

// Run daily backup at 2 AM
cron.schedule('0 2 * * *', async () => {
  logger.info('Running daily backup job');
  try {
    await dailyBackup();
  } catch (error) {
    logger.error('Daily backup job failed:', error);
  }
});

logger.info('Scheduled jobs initialized');
```

```typescript
// src/jobs/feedStockAlert.job.ts
import { db } from '../config/database';
import { feedInventory } from '../db/schema';
import { lt } from 'drizzle-orm';
import { emailService } from '../services/email.service';

export async function feedStockAlert() {
  // Find inventory items below minimum stock level
  const lowStockItems = await db
    .select()
    .from(feedInventory)
    .where(lt(feedInventory.quantity, feedInventory.minStockLevel));

  if (lowStockItems.length > 0) {
    // Send alert email
    await emailService.sendLowStockAlert(lowStockItems);
    
    // Log alert
    logger.info(`Low stock alert sent for ${lowStockItems.length} items`);
  }
}
```

---

## 7. AUTHENTICATION & AUTHORIZATION

### 7.1 Firebase Authentication Setup

```typescript
// src/config/firebase.ts
import admin from 'firebase-admin';

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT || '{}'
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

export default admin;
```

### 7.2 User Registration Flow

```typescript
// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import admin from '../config/firebase';
import bcrypt from 'bcrypt';
import { db } from '../config/database';
import { users } from '../db/schema';
import { AppError } from '../utils/errors';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, role } = req.body;

      // Create Firebase user
      const firebaseUser = await admin.auth().createUser({
        email,
        password,
        emailVerified: false
      });

      // Set custom claims for role
      await admin.auth().setCustomUserClaims(firebaseUser.uid, { role });

      // Hash password for database storage (backup)
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user in database
      const [user] = await db.insert(users).values({
        email,
        passwordHash,
        role,
        isActive: true
      }).returning();

      // Generate custom token
      const token = await admin.auth().createCustomToken(firebaseUser.uid);

      res.status(201).json({
        success: true,
        data: {
          userId: user.id,
          email: user.email,
          role: user.role,
          token
        },
        message: 'User registered successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      // Verify with Firebase
      const firebaseUser = await admin.auth().getUserByEmail(email);

      // Get user from database
      const user = await db.query.users.findFirst({
        where: eq(users.email, email)
      });

      if (!user || !user.isActive) {
        throw new AppError('Invalid credentials', 401, 'UNAUTHORIZED');
      }

      // Verify password (backup check)
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        throw new AppError('Invalid credentials', 401, 'UNAUTHORIZED');
      }

      // Generate tokens
      const token = await admin.auth().createCustomToken(firebaseUser.uid);

      res.json({
        success: true,
        data: {
          userId: user.id,
          email: user.email,
          role: user.role,
          token,
          expiresIn: 3600
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
```

### 7.3 Role-Based Access Control Matrix

```typescript
// src/config/permissions.ts
export const permissions = {
  // Employees
  'employees:create': ['system_admin', 'farm_manager'],
  'employees:read': ['system_admin', 'farm_manager', 'accountant', 'supervisor'],
  'employees:update': ['system_admin', 'farm_manager'],
  'employees:delete': ['system_admin'],

  // Batches
  'batches:create': ['system_admin', 'farm_manager', 'supervisor'],
  'batches:read': ['system_admin', 'farm_manager', 'supervisor', 'farm_worker', 'viewer'],
  'batches:update': ['system_admin', 'farm_manager', 'supervisor'],
  'batches:delete': ['system_admin', 'farm_manager'],

  // Daily Records
  'dailyRecords:create': ['system_admin', 'farm_manager', 'supervisor', 'farm_worker'],
  'dailyRecords:read': ['system_admin', 'farm_manager', 'supervisor', 'viewer'],
  'dailyRecords:update': ['system_admin', 'farm_manager', 'supervisor'],
  'dailyRecords:delete': ['system_admin', 'farm_manager'],

  // Feed
  'feed:create': ['system_admin', 'feed_mill_operator'],
  'feed:read': ['system_admin', 'farm_manager', 'feed_mill_operator', 'viewer'],
  'feed:update': ['system_admin', 'feed_mill_operator'],
  'feed:delete': ['system_admin'],

  // Sales
  'sales:create': ['system_admin', 'farm_manager', 'accountant'],
  'sales:read': ['system_admin', 'farm_manager', 'accountant', 'viewer'],
  'sales:update': ['system_admin', 'farm_manager', 'accountant'],
  'sales:delete': ['system_admin'],

  // Payroll
  'payroll:create': ['system_admin', 'accountant'],
  'payroll:read': ['system_admin', 'accountant', 'farm_manager'],
  'payroll:update': ['system_admin', 'accountant'],
  'payroll:approve': ['system_admin', 'farm_manager'],
  'payroll:delete': ['system_admin'],

  // Reports
  'reports:financial': ['system_admin', 'accountant', 'farm_manager'],
  'reports:operational': ['system_admin', 'farm_manager', 'supervisor', 'viewer'],
  'reports:export': ['system_admin', 'accountant', 'farm_manager']
};

export function hasPermission(userRole: string, permission: string): boolean {
  return permissions[permission]?.includes(userRole) || false;
}
```

---

## 8. FILE MANAGEMENT

### 8.1 Upload Configuration

```typescript
// src/config/multer.ts
import multer from 'multer';
import { AppError } from '../utils/errors';

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Allowed file types
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type', 400, 'INVALID_FILE_TYPE'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});
```

### 8.2 Upload Route

```typescript
// src/routes/upload.routes.ts
import { Router } from 'express';
import { upload } from '../config/multer';
import { authMiddleware } from '../middleware/auth.middleware';
import { UploadController } from '../controllers/upload.controller';

const router = Router();
const uploadController = new UploadController();

router.post(
  '/',
  authMiddleware,
  upload.single('file'),
  uploadController.uploadFile
);

export default router;
```

```typescript
// src/controllers/upload.controller.ts
import { Request, Response, NextFunction } from 'express';
import { storageService } from '../services/storage.service';
import { db } from '../config/database';
import { documents } from '../db/schema';
import { AppError } from '../utils/errors';

export class UploadController {
  async uploadFile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400, 'BAD_REQUEST');
      }

      const { entityType, entityId, documentType } = req.body;

      // Upload to Cloud Storage
      const fileUrl = await storageService.uploadFile(
        req.file,
        entityType,
        entityId
      );

      // Save document record
      const [document] = await db.insert(documents).values({
        entityType,
        entityId,
        documentType,
        fileName: req.file.originalname,
        fileUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.user!.id
      }).returning();

      res.json({
        success: true,
        data: {
          fileUrl: document.fileUrl,
          fileName: document.fileName,
          fileSize: document.fileSize,
          mimeType: document.mimeType
        },
        message: 'File uploaded successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
```

---

## 9. OFFLINE SUPPORT

### 9.1 Offline Queue Store

```typescript
// src/store/offlineStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OfflineState {
  queueSize: number;
  setQueueSize: (size: number) => void;
  lastSyncTime: number | null;
  setLastSyncTime: (time: number) => void;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set) => ({
      queueSize: 0,
      setQueueSize: (size: number) => set({ queueSize: size }),
      lastSyncTime: null,
      setLastSyncTime: (time: number) => set({ lastSyncTime: time })
    }),
    {
      name: 'offline-storage'
    }
  )
);
```

### 9.2 Offline-First Data Entry

```typescript
// src/pages/batches/DailyEntryPage.tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOffline } from '@/hooks/useOffline';
import { offlineService } from '@/services/offline.service';
import api from '@/lib/api';

export function DailyEntryPage() {
  const isOnline = useOffline();
  const queryClient = useQueryClient();

  const createRecordMutation = useMutation({
    mutationFn: async (data: DailyRecordInput) => {
      if (isOnline) {
        // Online: send immediately
        const response = await api.post(`/batches/${batchId}/daily-records`, data);
        return response.data.data;
      } else {
        // Offline: queue for later
        await offlineService.addToQueue(
          `/batches/${batchId}/daily-records`,
          'POST',
          data
        );
        return data; // Return optimistic data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-records'] });
      toast.success(isOnline ? 'Record saved' : 'Record queued (offline)');
    }
  });

  return (
    // Form UI
  );
}
```

---

## 10. DEPLOYMENT STRATEGY

### 10.1 Docker Configuration

```dockerfile
# Dockerfile (Backend)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/server.js"]
```

```dockerfile
# Dockerfile (Frontend)
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage (nginx)
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 10.2 Cloud Build Configuration

```yaml
# cloudbuild.yaml (Backend)
steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/poultry-backend:$COMMIT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/poultry-backend:latest'
      - '.'

  # Push to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '--all-tags'
      - 'gcr.io/$PROJECT_ID/poultry-backend'

  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'poultry-backend'
      - '--image'
      - 'gcr.io/$PROJECT_ID/poultry-backend:$COMMIT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--set-env-vars'
      - 'NODE_ENV=production'
      - '--set-secrets'
      - 'DATABASE_URL=database-url:latest'
      - '--min-instances'
      - '1'
      - '--max-instances'
      - '10'
      - '--memory'
      - '512Mi'
      - '--cpu'
      - '1'

images:
  - 'gcr.io/$PROJECT_ID/poultry-backend:$COMMIT_SHA'
  - 'gcr.io/$PROJECT_ID/poultry-backend:latest'

timeout: '1200s'
```

### 10.3 Environment Variables

```bash
# .env.example (Backend)
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Firebase
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Google Cloud Storage
GCP_PROJECT_ID=your-project-id
GCP_KEY_FILE=./service-account-key.json
GCS_BUCKET_NAME=poultry-uploads

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=3600

# Frontend URL (for CORS)
FRONTEND_URL=https://yourfarm.com

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=noreply@yourfarm.com
```

```bash
# .env.example (Frontend)
VITE_API_URL=https://api.yourfarm.com
VITE_FIREBASE_API_KEY=your-firebase-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

---

## 11. SECURITY IMPLEMENTATION

### 11.1 Security Headers (Helmet.js)

```typescript
// src/app.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.yourfarm.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 11.2 Input Validation

```typescript
// src/validators/batch.validator.ts
import { body } from 'express-validator';

export const createBatchValidator = [
  body('siteId')
    .isUUID()
    .withMessage('Site ID must be a valid UUID'),
  
  body('cageId')
    .isUUID()
    .withMessage('Cage ID must be a valid UUID'),
  
  body('placementDate')
    .isISO8601()
    .withMessage('Placement date must be a valid date'),
  
  body('chicksPlaced')
    .isInt({ min: 1, max: 20000 })
    .withMessage('Chicks placed must be between 1 and 20000'),
  
  body('initialAvgWeight')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Initial average weight must be a positive number'),
  
  body('costPerChick')
    .isFloat({ min: 0 })
    .withMessage('Cost per chick must be a positive number')
];
```

### 11.3 SQL Injection Prevention

```typescript
// Using Drizzle ORM prevents SQL injection
// Example: Safe parameterized queries

// ✅ SAFE - Drizzle ORM
const batch = await db.query.batches.findFirst({
  where: eq(batches.id, userProvidedId)
});

// ❌ UNSAFE - Raw SQL with string concatenation
// const batch = await db.execute(`SELECT * FROM batches WHERE id = '${userProvidedId}'`);
```

### 11.4 Rate Limiting

```typescript
// src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// Auth rate limiter (stricter)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // limit each IP to 5 login attempts
  message: 'Too many login attempts, please try again later'
});

// Usage
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
```

---

## 12. TESTING STRATEGY

### 12.1 Unit Tests

```typescript
// tests/services/batches.service.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BatchesService } from '../../src/services/batches.service';

describe('BatchesService', () => {
  let batchesService: BatchesService;

  beforeEach(() => {
    batchesService = new BatchesService();
  });

  describe('create', () => {
    it('should create a batch successfully', async () => {
      const batchData = {
        siteId: 'site-uuid',
        cageId: 'cage-uuid',
        placementDate: '2026-02-01',
        chicksPlaced: 10000,
        costPerChick: 120
      };

      const batch = await batchesService.create(batchData);

      expect(batch).toBeDefined();
      expect(batch.chicksPlaced).toBe(10000);
      expect(batch.status).toBe('active');
    });

    it('should throw error if cage is not available', async () => {
      const batchData = {
        siteId: 'site-uuid',
        cageId: 'occupied-cage-uuid',
        placementDate: '2026-02-01',
        chicksPlaced: 10000,
        costPerChick: 120
      };

      await expect(batchesService.create(batchData)).rejects.toThrow('Cage is not available');
    });
  });
});
```

### 12.2 Integration Tests

```typescript
// tests/integration/batches.test.ts
import request from 'supertest';
import app from '../../src/app';

describe('Batches API', () => {
  let authToken: string;

  beforeAll(async () => {
    // Login and get token
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    authToken = response.body.data.token;
  });

  describe('GET /api/batches', () => {
    it('should return list of batches', async () => {
      const response = await request(app)
        .get('/api/batches')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 401 without auth token', async () => {
      await request(app)
        .get('/api/batches')
        .expect(401);
    });
  });

  describe('POST /api/batches', () => {
    it('should create a new batch', async () => {
      const batchData = {
        siteId: 'site-uuid',
        cageId: 'cage-uuid',
        placementDate: '2026-02-01',
        chicksPlaced: 10000,
        costPerChick: 120
      };

      const response = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(batchData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.chicksPlaced).toBe(10000);
    });
  });
});
```

### 12.3 End-to-End Tests

```typescript
// e2e/batch-lifecycle.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Batch Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:5173/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://localhost:5173/dashboard');
  });

  test('should create a new batch', async ({ page }) => {
    // Navigate to batches page
    await page.click('text=Batches');
    await expect(page).toHaveURL(/.*batches/);

    // Click create button
    await page.click('text=Create Batch');

    // Fill form
    await page.selectOption('[name="siteId"]', 'site-uuid');
    await page.selectOption('[name="cageId"]', 'cage-uuid');
    await page.fill('[name="placementDate"]', '2026-02-01');
    await page.fill('[name="chicksPlaced"]', '10000');
    await page.fill('[name="costPerChick"]', '120');

    // Submit
    await page.click('button[type="submit"]');

    // Verify success
    await expect(page.locator('text=Batch created successfully')).toBeVisible();
    await expect(page).toHaveURL(/.*batches/);
  });

  test('should add daily record', async ({ page }) => {
    // Navigate to batch details
    await page.goto('http://localhost:5173/batches/batch-uuid');

    // Click add daily record
    await page.click('text=Add Daily Record');

    // Fill form
    await page.fill('[name="mortalityCount"]', '5');
    await page.fill('[name="feedConsumed"]', '1200');
    await page.fill('[name="avgWeight"]', '750');

    // Submit
    await page.click('button[type="submit"]');

    // Verify record added
    await expect(page.locator('text=Record added successfully')).toBeVisible();
  });
});
```

---

## 13. MONITORING & LOGGING

### 13.1 Winston Logger Configuration

```typescript
// src/config/logger.ts
import winston from 'winston';
import { LoggingWinston } from '@google-cloud/logging-winston';

const loggingWinston = new LoggingWinston({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'poultry-backend',
    environment: process.env.NODE_ENV
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Cloud Logging for production
    loggingWinston
  ]
});

// Don't log to Cloud Logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.remove(loggingWinston);
}
```

### 13.2 Request Logging Middleware

```typescript
// src/middleware/logging.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      userId: req.user?.id
    });
  });

  next();
}
```

### 13.3 Error Logging

```typescript
// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { AppError } from '../utils/errors';

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  // Handle known errors
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message
      }
    });
  }

  // Handle unknown errors
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
}
```

### 13.4 Performance Monitoring

```typescript
// src/utils/metrics.ts
import { Request, Response } from 'express';
import { logger } from '../config/logger';

export class MetricsCollector {
  static trackDatabaseQuery(queryName: string, duration: number) {
    logger.info('Database Query', {
      metric: 'database_query_duration',
      queryName,
      duration
    });

    // Log slow queries
    if (duration > 100) {
      logger.warn('Slow database query', {
        queryName,
        duration
      });
    }
  }

  static trackAPIEndpoint(req: Request, res: Response, duration: number) {
    logger.info('API Endpoint', {
      metric: 'api_endpoint_duration',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration
    });

    // Log slow endpoints
    if (duration > 1000) {
      logger.warn('Slow API endpoint', {
        method: req.method,
        path: req.path,
        duration
      });
    }
  }
}
```

---

## 14. DEVELOPMENT WORKFLOW

### 14.1 Git Workflow

```
main (production)
  ↓
develop (integration)
  ↓
feature/* (feature branches)
```

### 14.2 Commit Convention

```
feat: Add batch profitability calculation
fix: Resolve FCR calculation bug
docs: Update API documentation
style: Format code with prettier
refactor: Simplify batch service logic
test: Add unit tests for payroll service
chore: Update dependencies
```

### 14.3 Development Scripts

```json
// package.json (Backend)
{
  "scripts": {
    "dev": "nodemon --exec tsx src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "db:generate": "drizzle-kit generate:pg",
    "db:push": "drizzle-kit push:pg",
    "db:studio": "drizzle-kit studio"
  }
}
```

```json
// package.json (Frontend)
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx",
    "format": "prettier --write src/**/*.{ts,tsx}",
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

### 14.4 Setup Instructions

#### Backend Setup
```bash
# 1. Clone repository
git clone <repository-url>
cd backend

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# 4. Setup database
npm run db:generate
npm run db:push

# 5. Start development server
npm run dev
```

#### Frontend Setup
```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your API URL

# 4. Start development server
npm run dev
```

---

## APPENDICES

### A. Database ER Diagram

```
┌─────────────┐
│   users     │
└──────┬──────┘
       │
       │ (1:N)
       ▼
┌─────────────┐         ┌─────────────┐
│  employees  │────────▶│ attendance  │
└──────┬──────┘   (1:N) └─────────────┘
       │
       │ (1:N)
       ▼
┌─────────────┐
│   payroll   │
└─────────────┘

┌─────────────┐
│   sites     │
└──────┬──────┘
       │
       │ (1:N)
       ▼
┌─────────────┐         ┌──────────────┐
│   cages     │────────▶│   batches    │
└─────────────┘   (1:N) └───────┬──────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
              (1:N) ▼     (1:N) ▼     (1:N) ▼
           ┌──────────┐ ┌──────────┐ ┌──────────┐
           │  daily   │ │  sales   │ │vaccina-  │
           │ records  │ │          │ │tions     │
           └──────────┘ └────┬─────┘ └──────────┘
                             │
                             │ (1:N)
                             ▼
                       ┌──────────┐
                       │ payments │
                       └──────────┘

┌──────────────┐         ┌──────────────┐
│feed_inventory│────────▶│feed_production
└──────────────┘   (N:N) └──────────────┘
```

### B. API Response Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable Entity | Semantic error |
| 500 | Internal Server Error | Server error |

### C. Environment Variables Reference

#### Backend
```
NODE_ENV              - Environment (development, staging, production)
PORT                  - Server port (default: 3000)
DATABASE_URL          - PostgreSQL connection string
FIREBASE_SERVICE_ACCOUNT - Firebase service account JSON
GCP_PROJECT_ID        - Google Cloud project ID
GCS_BUCKET_NAME       - Cloud Storage bucket name
JWT_SECRET            - JWT signing secret
FRONTEND_URL          - Frontend URL for CORS
SENDGRID_API_KEY      - SendGrid API key
FROM_EMAIL            - Email sender address
```

#### Frontend
```
VITE_API_URL          - Backend API URL
VITE_FIREBASE_API_KEY - Firebase API key
VITE_FIREBASE_AUTH_DOMAIN - Firebase auth domain
VITE_FIREBASE_PROJECT_ID - Firebase project ID
```

---

**END OF TECHNICAL SOLUTION DESIGN DOCUMENT**

This document provides complete technical specifications for implementing the Poultry Farm Management System. All code examples are production-ready and follow industry best practices.

---

## Addendum: Inventory Management Module Expansion

**Date:** March 16, 2026

The current implementation stores feed inventory, suppliers, purchase orders, lots, and inventory audit data inside the feed domain. For the next implementation phase, this domain is widened into a shared inventory management capability while keeping feed production intact.

### Design direction

- keep the existing `feed_inventory` physical table as the shared inventory stock table for now
- add `inventory_item_types` to classify stock and determine behavior
- add `batch_inventory_consumptions` to capture non-feed inventory consumed by farm batches
- expose a dedicated `/api/inventory` route surface for generalized inventory workflows
- keep `/api/feed/inventory` as a feed-only filtered view over shared inventory

### Required schema additions

1. `inventory_item_types`
   - `id`
   - `typeCode`
   - `typeName`
   - `category`
   - `defaultUnit`
   - `allowsBatchAllocation`
   - `isFeed`
   - `status`
   - `description`
   - timestamps
2. `feed_inventory`
   - add `itemTypeId`
   - optional master-data fields such as `sku`, `itemCode`, `description`
3. `batch_inventory_consumptions`
   - `id`
   - `batchId`
   - `inventoryItemId`
   - `inventoryLotId`
   - `purchaseOrderItemId`
   - `quantity`
   - `unit`
   - `unitCost`
   - `lineCost`
   - `consumptionDate`
   - `referenceType`
   - `referenceId`
   - `notes`
   - `createdBy`
   - timestamps

### Workflow assumptions

1. Feed recipes and feed production can only use inventory items where the item type is marked `isFeed = true`.
2. For non-feed stock, allocation into a farm batch is treated as immediate consumption in this phase.
3. Purchase order receiving for non-feed items must optionally capture batch consumption quantities as part of the receive transaction.
4. Remaining stock from a received lot stays available for later batch consumption through inventory item detail.

### Reporting impact

- `GET /api/batches/:id` must return batch inventory consumption detail and totals
- `GET /api/reports/batch-profitability` must include non-feed inventory cost in addition to feed and labor cost
- a new inventory consumption report should provide per-batch and per-item cost visibility
