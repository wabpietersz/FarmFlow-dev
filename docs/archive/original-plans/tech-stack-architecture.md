# POULTRY FARM MANAGEMENT SYSTEM
## Tech Stack & Architecture

**Version:** 1.0  
**Date:** February 2026  
**Type:** MVP - Solo Developer Build

---

## TECH STACK

### Frontend
- **React 18** + TypeScript 5
- **Vite** (build tool)
- **Shadcn UI** + Radix UI (components)
- **TailwindCSS** (styling)
- **TanStack Query** (server state)
- **Zustand** (client state)
- **React Router** (routing)
- **React Hook Form** + Zod (forms & validation)
- **Recharts** (charts)
- **Workbox** (Service Workers - PWA)
- **LocalForage** (offline storage)

### Backend
- **Express.js** + TypeScript
- **Drizzle ORM** (database access)
- **Passport.js** + JWT (authentication)
- **express-validator** (validation)
- **Multer** (file uploads)
- **node-cron** (scheduled jobs)
- **Winston** (logging)
- **Helmet** + CORS (security)

### Database
- **Cloud SQL PostgreSQL 15**
- No Redis (using PostgreSQL for everything)

### Cloud Services (Google Cloud Platform)
- **Cloud Run** (backend hosting)
- **Firebase Hosting** (frontend hosting)
- **Cloud Storage** (file storage)
- **Firebase Authentication** (user auth)
- **Cloud Build** (CI/CD)
- **Cloud Logging** (logs)
- **Cloud Monitoring** (metrics)
- **Secret Manager** (secrets)

### Development Tools
- **TypeScript** (end-to-end type safety)
- **Docker** (containerization)
- **Git** + GitHub (version control)
- **ESLint** + Prettier (code quality)
- **Postman** (API testing)

---

## ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│                  CLIENT LAYER                        │
├─────────────────────────────────────────────────────┤
│  React PWA (Progressive Web App)                    │
│  ├── Desktop Browser                                │
│  ├── Mobile Browser                                 │
│  └── Installable App (Android/iOS)                  │
│                                                      │
│  Hosted: Firebase Hosting (Global CDN)              │
│  Features: Offline-first, Service Workers           │
└───────────────────────┬─────────────────────────────┘
                        │
                        │ HTTPS/REST API
                        │ JSON payloads
                        │
┌───────────────────────▼─────────────────────────────┐
│                   API LAYER                          │
├─────────────────────────────────────────────────────┤
│  Cloud Load Balancer                                │
│  └── SSL Termination                                │
│  └── DDoS Protection                                │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              APPLICATION LAYER                       │
├─────────────────────────────────────────────────────┤
│  Cloud Run (Express.js Backend)                     │
│                                                      │
│  ├── Routes Layer                                   │
│  │   ├── /api/auth                                  │
│  │   ├── /api/employees                             │
│  │   ├── /api/batches                               │
│  │   ├── /api/feed                                  │
│  │   ├── /api/sales                                 │
│  │   └── /api/payroll                               │
│  │                                                   │
│  ├── Middleware Layer                               │
│  │   ├── Authentication (JWT)                       │
│  │   ├── Authorization (RBAC)                       │
│  │   ├── Validation                                 │
│  │   ├── Error Handling                             │
│  │   └── Logging                                    │
│  │                                                   │
│  ├── Controllers (Business Logic)                   │
│  ├── Services (Data Access)                         │
│  └── Drizzle ORM (Type-safe queries)                │
│                                                      │
│  Auto-scaling: 0-10 instances                       │
│  Health checks: /health endpoint                    │
└────────┬──────────────────────┬─────────────────────┘
         │                      │
         │                      │
         ▼                      ▼
┌──────────────────┐   ┌──────────────────────┐
│   Cloud SQL      │   │   Cloud Storage      │
│   PostgreSQL     │   │   (GCS)              │
├──────────────────┤   ├──────────────────────┤
│                  │   │                      │
│ • All app data   │   │ • Employee docs      │
│ • User sessions  │   │ • Batch photos       │
│ • Cached data    │   │ • Reports (PDF)      │
│ • Audit logs     │   │ • Exports (Excel)    │
│                  │   │                      │
│ Instance:        │   │ Buckets:             │
│ db-n1-standard-1 │   │ - poultry-uploads    │
│ Storage: 50GB    │   │ - poultry-reports    │
│ Backups: Daily   │   │                      │
└──────────────────┘   └──────────────────────┘
         │
         │
         ▼
┌──────────────────────────────────────────────────┐
│          AUTHENTICATION LAYER                     │
├──────────────────────────────────────────────────┤
│  Firebase Authentication                         │
│  ├── Email/Password                              │
│  ├── JWT Token Generation                        │
│  ├── Token Refresh                               │
│  └── Session Management                          │
└──────────────────────────────────────────────────┘
         │
         │
         ▼
┌──────────────────────────────────────────────────┐
│           MONITORING & LOGGING                    │
├──────────────────────────────────────────────────┤
│  Cloud Logging    │  Cloud Monitoring            │
│  • API logs       │  • Uptime checks             │
│  • Error logs     │  • Performance metrics       │
│  • Audit trails   │  • Resource usage            │
│  • Access logs    │  • Alerts                    │
└──────────────────────────────────────────────────┘
```

---

## DATA FLOW

### 1. User Authentication Flow
```
User → React App → Firebase Auth → JWT Token
                                   ↓
                          Store in LocalStorage
                                   ↓
                    Include in all API requests
                                   ↓
                    Express Middleware validates
                                   ↓
                    Check role permissions
                                   ↓
                    Allow/Deny access
```

### 2. Data Entry Flow (with Offline Support)
```
Farm Worker → Mobile PWA → Fill daily entry form
                           ↓
                   Check network status
                           ↓
                   ┌──────┴──────┐
                   │             │
              ONLINE          OFFLINE
                   │             │
                   ▼             ▼
          POST to API    Save to IndexedDB
                   │             │
                   ▼             └──→ Queue for sync
          Save to PostgreSQL           │
                   │                   │
                   ▼                   │
          Return success        Network restored
                                       │
                                       ▼
                                 POST to API
                                       │
                                       ▼
                                Save to PostgreSQL
                                       │
                                       ▼
                                Clear queue
```

### 3. File Upload Flow
```
User → React App → Select file → Multer (Express)
                                       ↓
                              Validate file type/size
                                       ↓
                              Upload to Cloud Storage
                                       ↓
                              Get public URL
                                       ↓
                              Save URL to PostgreSQL
                                       ↓
                              Return URL to frontend
                                       ↓
                              Display file
```

### 4. Report Generation Flow
```
User → Request Report → Express Controller
                              ↓
                    Query data from PostgreSQL
                              ↓
                    Generate PDF/Excel
                              ↓
                    Upload to Cloud Storage
                              ↓
                    Return download URL
                              ↓
                    User downloads file
```

---

## SECURITY ARCHITECTURE

### Authentication & Authorization
```
Layer 1: Firebase Authentication
├── Email/password validation
├── JWT token generation
├── Token expiration (1 hour)
└── Refresh token (30 days)

Layer 2: Express Middleware
├── Verify JWT signature
├── Check token expiration
├── Extract user ID & role
└── Attach to request object

Layer 3: Role-Based Access Control (RBAC)
├── System Admin → Full access
├── Farm Manager → Operations + Read-only financial
├── Accountant → HR + Payroll + Sales
├── Supervisor → Batch + Team management
├── Feed Mill Operator → Feed module only
├── Farm Worker → Data entry only
└── Viewer → Reports only
```

### Data Security
```
In Transit:
├── HTTPS (TLS 1.3)
├── Firebase Hosting SSL
└── Cloud Run automatic SSL

At Rest:
├── Cloud SQL encryption (AES-256)
├── Cloud Storage encryption
└── Secret Manager for credentials

Application:
├── Helmet.js (security headers)
├── CORS (allowed origins only)
├── Rate limiting (prevent abuse)
├── Input validation (prevent injection)
└── SQL injection prevention (Drizzle ORM)
```

### Audit Trail
```
Track all changes:
├── User ID (who)
├── Action (what: create/update/delete)
├── Timestamp (when)
├── Old value (before)
├── New value (after)
└── IP address (where from)

Stored in: audit_logs table (PostgreSQL)
Retention: 2 years
Access: Admin only
```

---

## DEPLOYMENT ARCHITECTURE

### Environments
```
1. Development (local)
   ├── Local PostgreSQL (Docker)
   ├── Local Express server
   ├── Local React dev server (Vite)
   └── Firebase emulators

2. Staging (GCP)
   ├── Cloud SQL (db-f1-micro)
   ├── Cloud Run (min: 0, max: 2)
   ├── Firebase Hosting (staging)
   └── Separate database

3. Production (GCP)
   ├── Cloud SQL (db-n1-standard-1)
   ├── Cloud Run (min: 1, max: 10)
   ├── Firebase Hosting (production)
   ├── Automated backups
   └── High availability
```

### CI/CD Pipeline
```
Git Push → GitHub
    ↓
Cloud Build Trigger
    ↓
┌─────────────────┐
│ Build Steps:    │
│ 1. Run tests    │
│ 2. Build Docker │
│ 3. Push to      │
│    Artifact     │
│    Registry     │
│ 4. Deploy to    │
│    Cloud Run    │
│ 5. Run smoke    │
│    tests        │
└─────────────────┘
    ↓
Deployment Complete
    ↓
Notifications (email/slack)
```

---

## DATABASE ARCHITECTURE

### Core Tables
```
users
├── id (uuid)
├── email
├── role (enum)
├── created_at
└── updated_at

employees
├── id (uuid)
├── employee_id (auto)
├── full_name
├── contact_info (jsonb)
├── employment_details (jsonb)
├── bank_details (jsonb)
└── status

sites
├── id (uuid)
├── name
├── location
└── capacity

cages
├── id (uuid)
├── site_id (fk)
├── cage_number
├── capacity
└── status

batches
├── id (uuid)
├── batch_id (auto)
├── cage_id (fk)
├── placement_date
├── chicks_placed
├── status
└── metrics (jsonb)

daily_records
├── id (uuid)
├── batch_id (fk)
├── record_date
├── mortality_count
├── avg_weight
├── feed_consumed
├── temperature (jsonb)
└── notes

feed_inventory
├── id (uuid)
├── material_type
├── quantity
├── unit_cost
└── last_updated

sales
├── id (uuid)
├── batch_id (fk)
├── buyer_info (jsonb)
├── quantity
├── price_per_kg
├── total_amount
└── payment_status

payroll
├── id (uuid)
├── employee_id (fk)
├── period (date)
├── gross_salary
├── deductions (jsonb)
├── net_salary
└── status

audit_logs
├── id (uuid)
├── user_id (fk)
├── action
├── table_name
├── record_id
├── old_value (jsonb)
├── new_value (jsonb)
└── timestamp
```

### Relationships
```
sites → cages (1:many)
cages → batches (1:many)
batches → daily_records (1:many)
batches → sales (1:many)
employees → payroll (1:many)
users → audit_logs (1:many)
```

### Indexes
```
Performance indexes:
├── batches.status
├── batches.cage_id
├── daily_records.batch_id
├── daily_records.record_date
├── employees.employee_id
├── sales.batch_id
└── audit_logs.timestamp
```

---

## API DESIGN

### RESTful Endpoints

#### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me
```

#### Employees
```
GET    /api/employees
GET    /api/employees/:id
POST   /api/employees
PUT    /api/employees/:id
DELETE /api/employees/:id
POST   /api/employees/:id/documents
```

#### Batches
```
GET    /api/batches
GET    /api/batches/:id
POST   /api/batches
PUT    /api/batches/:id
DELETE /api/batches/:id
GET    /api/batches/:id/daily-records
POST   /api/batches/:id/daily-records
GET    /api/batches/:id/analytics
```

#### Feed
```
GET    /api/feed/inventory
POST   /api/feed/inventory
PUT    /api/feed/inventory/:id
GET    /api/feed/production
POST   /api/feed/production
GET    /api/feed/distribution
POST   /api/feed/distribution
```

#### Sales
```
GET    /api/sales
GET    /api/sales/:id
POST   /api/sales
PUT    /api/sales/:id
POST   /api/sales/:id/payments
GET    /api/sales/outstanding
```

#### Payroll
```
GET    /api/payroll
GET    /api/payroll/:id
POST   /api/payroll/generate
PUT    /api/payroll/:id
POST   /api/payroll/:id/approve
GET    /api/payroll/:id/payslip
```

#### Reports
```
GET    /api/reports/dashboard
GET    /api/reports/batch-profitability
GET    /api/reports/feed-consumption
GET    /api/reports/mortality-trends
GET    /api/reports/sales-summary
POST   /api/reports/export (PDF/Excel)
```

---

## SCALABILITY CONSIDERATIONS

### Current Capacity
```
Users: 20 concurrent
Batches: 50 active
Employees: 50
Sites: 2
Daily Records: ~150/day
```

### Growth Path
```
Phase 1 (MVP): Current stack handles 100 users
Phase 2 (10 customers): Add Redis caching
Phase 3 (50 customers): Add read replicas
Phase 4 (100+ customers): Add BigQuery, load balancing
```

### Database Scaling
```
Vertical Scaling:
├── Start: db-n1-standard-1 (1 vCPU, 3.75GB)
├── Growth: db-n1-standard-2 (2 vCPU, 7.5GB)
└── Large: db-n1-standard-4 (4 vCPU, 15GB)

Horizontal Scaling:
├── Read replicas (for reports)
├── Connection pooling (PgBouncer)
└── Table partitioning (by date)
```

### Backend Scaling
```
Cloud Run auto-scaling:
├── Min instances: 0 (dev), 1 (prod)
├── Max instances: 2 (dev), 10 (prod)
├── Concurrency: 80 requests/instance
└── CPU: 1 vCPU per instance
```

---

## COST ESTIMATE

### Development (3 months)
```
Cloud SQL (db-f1-micro):        $15/month × 3 = $45
Cloud Run:                      $10/month × 3 = $30
Cloud Storage:                  $2/month × 3  = $6
Firebase Hosting:               Free
Cloud Build:                    Free (120 builds/day)
Monitoring & Logging:           Free tier
────────────────────────────────────────────────
TOTAL:                          ~$81 (3 months)
```

### Production (monthly)
```
Cloud SQL (db-n1-standard-1):   $50
Cloud Run (avg usage):          $25
Cloud Storage (100GB):          $5
Firebase Hosting:               Free
Secret Manager:                 Free tier
Monitoring & Logging:           $5
────────────────────────────────────────────────
TOTAL:                          ~$85/month
```

---

## PERFORMANCE TARGETS

### API Response Times
```
GET requests (single):          < 100ms
GET requests (list):            < 300ms
POST/PUT requests:              < 200ms
File uploads:                   < 2s (10MB)
Report generation:              < 5s
Dashboard load:                 < 500ms
```

### Frontend Performance
```
Initial page load:              < 2s
Time to interactive:            < 3s
Subsequent navigation:          < 100ms
Offline mode activation:        < 500ms
PWA install size:               < 5MB
```

### Database Performance
```
Simple queries:                 < 10ms
Complex queries:                < 100ms
Joins (< 3 tables):            < 50ms
Batch inserts:                  < 200ms
Backup time (50GB):             < 30min
```

---

## DISASTER RECOVERY

### Backup Strategy
```
Database:
├── Automated daily backups (Cloud SQL)
├── Point-in-time recovery (7 days)
├── Weekly full backups (retained 4 weeks)
└── Monthly archives (retained 1 year)

Files:
├── Cloud Storage versioning
├── Lifecycle management
└── Cross-region replication (optional)

Code:
├── Git version control
├── GitHub repository
└── Tagged releases
```

### Recovery Procedures
```
Database restore:               < 1 hour
Application redeployment:       < 10 minutes
Complete system recovery:       < 2 hours
```

### RTO/RPO Targets
```
RTO (Recovery Time Objective):  2 hours
RPO (Recovery Point Objective): 24 hours (daily backup)
Uptime target:                  99% (business hours)
```

---

## MONITORING & ALERTS

### Key Metrics
```
Application:
├── Request rate (req/sec)
├── Error rate (%)
├── Response time (ms)
└── Active users

Infrastructure:
├── CPU usage (%)
├── Memory usage (%)
├── Disk usage (%)
└── Network I/O

Business:
├── Active batches
├── Daily mortality rate
├── Feed stock levels
└── Pending approvals
```

### Alert Triggers
```
Critical:
├── Error rate > 5%
├── Response time > 3s
├── Database CPU > 90%
└── Disk usage > 90%

Warning:
├── Response time > 1s
├── Database CPU > 70%
├── Mortality rate > 5%
└── Feed stock < 500kg
```

---

## FUTURE ENHANCEMENTS (Post-MVP)

### Phase 2 (Months 4-6)
- Redis caching layer
- Advanced reporting (BigQuery)
- Leave management
- SMS notifications
- Biometric integration prep

### Phase 3 (Months 7-9)
- Mobile app (React Native)
- IoT sensor integration
- Advanced analytics dashboard
- Multi-currency support
- Automated alerts

### Phase 4 (Months 10-12)
- Machine Learning (Vertex AI)
- Predictive analytics
- Automated scheduling
- API for third-party integrations
- Multi-language support

---

**END OF DOCUMENT**
