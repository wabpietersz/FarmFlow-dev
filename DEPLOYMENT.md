# FarmFlow Deployment Strategies

Authoritative go-live runbook: `/Users/warrenpietersz/Projects/Personal/FarmFlow2/deployment_prod.md`

Use this file as a strategy index/history. For live rollout and operations, follow `deployment_prod.md`.

This document now contains two separate strategies:

1. Old Strategy (legacy, lowest-cost bootstrap).
2. Production-Ready Strategy (recommended for real operations).

The recommended path for FarmFlow is the production-ready strategy in GCP with a lean baseline:

- Production: always on, non-HA initially.
- Staging: on-demand only (normally stopped).
- Region for Sri Lanka users: `asia-south1` (Mumbai) by default.

## Strategy A: Old Strategy (Legacy)

Status: `OLD STRATEGY - kept for reference only`

### Legacy architecture

| Service | Platform | Tier | Cost |
|---|---|---|---|
| Frontend | Firebase Hosting | Free (Spark) | $0 |
| Backend API | Cloud Run | Free tier | $0 |
| Database | Neon PostgreSQL | Free tier | $0 |
| Auth | Firebase Auth | Free (50K MAU) | $0 |
| File Storage | Firebase Storage | Free (5 GB) | $0 |

### Legacy notes

- Good for quick validation and zero-budget prototyping.
- Not ideal for long-term production reliability and operational control.
- Previous primary region in examples was `us-central1`.

### Legacy quick deploy commands (reference)

```bash
gcloud config set project farmflow-dev
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

gcloud builds submit --tag gcr.io/farmflow-dev/farmflow-api packages/backend/

gcloud run deploy farmflow-api \
  --image gcr.io/farmflow-dev/farmflow-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "DATABASE_URL=<neon-connection-string>" \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2
```

## Strategy B: Production-Ready (Recommended)

Status: `CURRENT RECOMMENDED STRATEGY`

Detailed implementation steps live in `/Users/warrenpietersz/Projects/Personal/FarmFlow2/deployment_prod.md`.

### Target architecture

| Area | Service | Configuration |
|---|---|---|
| Frontend | Firebase Hosting | CDN-hosted SPA |
| Backend API | Cloud Run | `min-instances=0`, `max-instances=3`, `1 vCPU`, `512Mi` |
| Production DB | Cloud SQL PostgreSQL | Non-HA (start), daily backups, PITR enabled |
| Staging DB | Cloud SQL PostgreSQL | Normally stopped (`activation-policy=NEVER`) |
| Storage | Cloud Storage | Private bucket, signed URLs |
| Auth | Firebase Auth + Admin SDK | Existing app pattern |
| Secrets | Secret Manager | DB URL, session secrets, Firebase private key |
| Monitoring | Cloud Monitoring + Logging | Health, error rate, latency, DB storage |

Cost control note: use Cloud Run `--add-cloudsql-instances` (Cloud SQL connector path) and avoid adding a Serverless VPC Connector unless you later require private IP-only networking.

### Region guidance (Sri Lanka)

- Primary recommendation: `asia-south1` (Mumbai).
- Keep backend and DB in the same region.
- If needed, benchmark against Singapore before finalizing.

## Cost model (small team baseline)

For your expected scale (about 10 users, about 100 employees, light documents):

| Scenario | Estimated monthly cost |
|---|---|
| Production non-HA | `$10-$25` |
| Production HA later | `$20-$50` |
| Staging mostly off | Low baseline storage/backup + small compute only when started |

Notes:

- Costs vary by region, traffic bursts, storage growth, and network egress.
- Staging Cloud Run with `min=0` is already scale-to-zero when idle.

## Prerequisites

1. GCP project with billing enabled.
2. `gcloud` CLI authenticated.
3. Firebase CLI installed.
4. Existing app secrets prepared for Secret Manager.

## Step 1: Enable required GCP APIs

```bash
gcloud config set project <PROJECT_ID>

gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com
```

## Step 2: Create Cloud SQL for production (non-HA initially)

```bash
gcloud sql instances create farmflow-prod-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=asia-south1 \
  --availability-type=ZONAL \
  --storage-size=10GB \
  --storage-type=SSD \
  --storage-auto-increase \
  --backup-start-time=00:00 \
  --enable-point-in-time-recovery

gcloud sql databases create farmflow_prod --instance=farmflow-prod-db
gcloud sql users create farmflow_app --instance=farmflow-prod-db --password='<STRONG_PASSWORD>'
```

## Step 3: Create Cloud SQL for staging (on-demand)

```bash
gcloud sql instances create farmflow-staging-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=asia-south1 \
  --availability-type=ZONAL \
  --storage-size=10GB \
  --storage-type=SSD \
  --storage-auto-increase \
  --backup-start-time=01:00

gcloud sql databases create farmflow_staging --instance=farmflow-staging-db
gcloud sql users create farmflow_app --instance=farmflow-staging-db --password='<STRONG_PASSWORD>'

# Keep staging DB off by default to reduce cost.
gcloud sql instances patch farmflow-staging-db --activation-policy=NEVER
```

## Step 4: Store secrets

Use Secret Manager for at least:

- `DATABASE_URL_PROD`
- `DATABASE_URL_STAGING`
- `SESSION_SECRET`
- `FIREBASE_PRIVATE_KEY`

Example DATABASE_URL format with Cloud SQL Unix socket:

```text
postgresql://farmflow_app:<PASSWORD>@/farmflow_prod?host=/cloudsql/<PROJECT_ID>:asia-south1:farmflow-prod-db
```

## Step 5: Build and deploy backend (production)

The backend image must be built from the **repository root** (it needs `packages/shared`).
It requires **Node 22** (firebase-admin 14) and applies database migrations itself on every
start (`dist/scripts/migrate.js`, using drizzle-orm's migrator — drizzle-kit is not in the image).

```bash
REGION=asia-south1
IMAGE=$REGION-docker.pkg.dev/<PROJECT_ID>/farmflow/farmflow-api:$(git rev-parse --short HEAD)

docker build -f packages/backend/Dockerfile -t $IMAGE .
docker push $IMAGE

gcloud run deploy farmflow-api-prod \
  --image $IMAGE \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --cpu 1 --memory 512Mi \
  --min-instances 1 --max-instances 3 \
  --add-cloudsql-instances <PROJECT_ID>:$REGION:farmflow-prod-db \
  --set-env-vars "NODE_ENV=production,CORS_ORIGIN=https://<APP_DOMAIN>,FIREBASE_PROJECT_ID=<FIREBASE_PROJECT>,FIREBASE_CLIENT_EMAIL=<SERVICE_ACCOUNT_EMAIL>,GCS_BUCKET_NAME=<BUCKET>" \
  --set-secrets "DATABASE_URL=DATABASE_URL_PROD:latest,SESSION_SECRET=SESSION_SECRET:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest,SMTP_PASS=SMTP_PASS:latest" \
  --set-env-vars "SMTP_HOST=smtp.gmail.com,SMTP_PORT=587,SMTP_USER=<SENDER>,SMTP_FROM=FarmFlow <SENDER>"
```

`--min-instances 1` keeps one instance warm: the notification bell (vaccinations due, stock
expiry, cheques, approvals, late payers) is generated by the server every 30 minutes and
won't run while the service is scaled to zero.

### Backend settings

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres 15 connection string |
| `NODE_ENV` | yes | `production` |
| `CORS_ORIGIN` | yes | The app's public URL |
| `SESSION_SECRET` | yes | Long random string |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | yes | Service account for sign-in verification and user management |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | recommended | Set-password and reset emails from FarmFlow. Gmail needs an **app password**; `SMTP_FROM` must be the Gmail address. Without SMTP, the app shows a link to copy instead |
| `GCS_BUCKET_NAME`, `GCS_PROJECT_ID` | for documents | Employee document storage |
| `MIGRATIONS_DIR` | no | Override where migrations are read from |

## Step 6: Deploy frontend

Either serve the frontend image (nginx; set `BACKEND_URL` to the API, default `http://backend:3001`):

```bash
docker build -f packages/frontend/Dockerfile -t <FRONTEND_IMAGE> .
docker run -p 80:80 -e BACKEND_URL=https://<PROD_RUN_URL> <FRONTEND_IMAGE>
```

or build static files for Firebase Hosting:

```bash
VITE_API_URL=https://<PROD_RUN_URL>/api npm run build:frontend
firebase deploy --only hosting
```

If Firebase Hosting rewrites to Cloud Run, use `asia-south1` in `firebase.json`.

## Step 7: Database: migrations, lists and the first admin

Migrations run automatically when the backend starts. To run them by hand
(e.g. from a laptop through the Cloud SQL Auth Proxy):

```bash
npm run build:shared && npm run build:backend
DATABASE_URL='<PROD_DATABASE_URL>' npm run db:migrate:prod -w packages/backend
```

A blank database gets all tables, the money categories and default EPF/ETF rates and
approval limits from the migrations. Optional dropdown lists (designations, mortality causes,
leave types…) come from the seed, which needs dev dependencies, so run it from a dev checkout:

```bash
DATABASE_URL='<PROD_DATABASE_URL>' npm run db:seed -w packages/backend
```

Create the first system admin. No password is set or printed; the script prints a link the
admin opens to choose one. Then add farms, houses, accounts and users in the app.

```bash
FARMFLOW_ADMIN_EMAIL=owner@example.com FARMFLOW_ADMIN_FIRST_NAME=<First> FARMFLOW_ADMIN_LAST_NAME=<Last> \
DATABASE_URL='<PROD_DATABASE_URL>' npx tsx packages/backend/src/scripts/setup-admin.ts
```

Readiness check:

```bash
curl -sSf "https://<PROD_RUN_URL>/api/health?readiness=true"
```

## Staging runbook (on-demand only)

Start staging:

```bash
gcloud sql instances patch farmflow-staging-db --activation-policy=ALWAYS

gcloud run deploy farmflow-api-staging \
  --image gcr.io/<PROJECT_ID>/farmflow-api \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 2 \
  --add-cloudsql-instances <PROJECT_ID>:asia-south1:farmflow-staging-db \
  --set-env-vars "NODE_ENV=staging" \
  --set-secrets "DATABASE_URL=DATABASE_URL_STAGING:latest" \
  --set-secrets "SESSION_SECRET=SESSION_SECRET:latest" \
  --set-secrets "FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest"
```

Stop staging:

```bash
gcloud sql instances patch farmflow-staging-db --activation-policy=NEVER
```

Notes:

- Staging Cloud Run remains deployed with `min-instances=0`; idle cost is near zero.
- DB stop/start control gives most of the staging cost savings.

## HA upgrade path (later)

When the system is widely adopted, move production DB to HA:

```bash
gcloud sql instances patch farmflow-prod-db --availability-type=REGIONAL
```

Before enabling HA:

1. Confirm monthly budget impact.
2. Confirm failover testing window.
3. Confirm maintenance and rollback expectations with stakeholders.

## Minimum operations checklist

1. Daily automated backups enabled (production and staging).
2. PITR enabled on production.
3. Monthly restore drill from backup.
4. Alerts for API error rate, p95 latency, Cloud SQL disk usage.
5. Secret rotation schedule (at least quarterly).
6. Documented runbook for staging start/stop and incident response.

## Decision summary

- Use Strategy B for production.
- Keep Strategy A only as historical reference.
- Start non-HA now, upgrade to HA when adoption justifies it.
