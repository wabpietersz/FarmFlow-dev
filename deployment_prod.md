# FarmFlow Production Deployment Runbook (Authoritative)

This is the source-of-truth document for taking FarmFlow live on GCP.

If this file conflicts with `/Users/warrenpietersz/Projects/Personal/FarmFlow2/DEPLOYMENT.md`, follow this file.

## 1. Goals and constraints

1. Keep production cost-effective for current scale (about 10 users, about 100 employees, light documents).
2. Keep production available 24/7.
3. Accept Cloud Run cold starts (`min-instances=0`) to reduce fixed cost.
4. Start with Cloud SQL non-HA, then upgrade to HA when adoption justifies it.
5. Keep staging off by default and start it only when needed.
6. Avoid networking choices that add fixed baseline cost without clear value.

## 2. Final architecture decisions

| Area | Decision | Why |
|---|---|---|
| Region | `asia-south1` (Mumbai) | Better latency for Sri Lanka users |
| Frontend | Firebase Hosting | Simple CDN hosting for SPA |
| Backend | Cloud Run | Auto-scaling and low idle cost |
| Production DB | Cloud SQL PostgreSQL (non-HA first) | Managed Postgres with clear HA upgrade path |
| Staging DB | Cloud SQL PostgreSQL (stopped by default) | Lowest practical staging cost |
| Storage | GCS private bucket + signed URLs | Secure document access |
| Secrets | Secret Manager | Centralized secret handling |
| Auth | Firebase Auth (existing app flow) | Matches current codebase |

## 3. Networking and security decisions

### 3.1 Networking

1. Use Cloud Run to Cloud SQL via `--add-cloudsql-instances`.
2. Do not add Serverless VPC Connector in phase 1.
3. Keep Cloud Run and Cloud SQL in the same region.
4. Use public HTTPS endpoints for frontend and API.

Cost note:
- Skipping VPC connector avoids extra baseline networking charges.

### 3.2 Security

1. Separate runtime service accounts for production and staging.
2. Least-privilege IAM roles only.
3. Secrets in Secret Manager, not in source control.
4. Private GCS buckets (no public object ACLs).
5. Signed URLs for file download (time-limited).
6. App-layer auth enforced through Firebase token verification.
7. Keep Cloud Run public only because browser clients call it directly; rely on app auth + rate limiting + strict CORS.
8. Set `CORS_ORIGIN` to exact frontend origin only (no wildcard).
9. Set `COOKIE_DOMAIN` as host only (no protocol, no path).

## 4. Target cost profile

| Scenario | Expected monthly range |
|---|---|
| Production non-HA | `$10-$25` |
| Production HA later | `$20-$50` |
| Staging mostly off | Low storage/backup baseline + compute only when started |

These ranges assume small workloads and minimal egress.

## 5. Phase 1: Launch production (non-HA)

### 5.1 Pre-flight

Set shell variables:

```bash
export PROJECT_ID="<your-gcp-project-id>"
export REGION="asia-south1"
export PROD_DB_INSTANCE="farmflow-prod-db"
export PROD_DB_NAME="farmflow_prod"
export PROD_DB_USER="farmflow_app"
export PROD_RUN_SERVICE="farmflow-api-prod"
export PROD_RUN_SA="farmflow-prod-run"
export PROD_BUCKET="gs://farmflow-prod-docs-${PROJECT_ID}"
export AR_REPO="farmflow"
```

### 5.2 Enable APIs

```bash
gcloud config set project "$PROJECT_ID"

gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com
```

### 5.3 Create artifact registry

```bash
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="FarmFlow Docker images"
```

### 5.4 Create runtime service account and IAM

```bash
gcloud iam service-accounts create "$PROD_RUN_SA" \
  --display-name="FarmFlow Production Cloud Run SA"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROD_RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROD_RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 5.5 Create production GCS bucket and permissions

```bash
gcloud storage buckets create "$PROD_BUCKET" \
  --location="$REGION" \
  --uniform-bucket-level-access

gcloud storage buckets add-iam-policy-binding "$PROD_BUCKET" \
  --member="serviceAccount:${PROD_RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Required for V4 signed URLs in many service-account setups.
gcloud iam service-accounts add-iam-policy-binding \
  "${PROD_RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --member="serviceAccount:${PROD_RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

### 5.6 Create production Cloud SQL (non-HA)

Choose the smallest shared-core tier available in your region (for example `db-f1-micro`).

```bash
gcloud sql instances create "$PROD_DB_INSTANCE" \
  --database-version=POSTGRES_15 \
  --tier=<SMALLEST_SHARED_CORE_TIER> \
  --region="$REGION" \
  --availability-type=ZONAL \
  --storage-size=10GB \
  --storage-type=SSD \
  --storage-auto-increase \
  --backup-start-time=00:00 \
  --enable-point-in-time-recovery

gcloud sql databases create "$PROD_DB_NAME" --instance="$PROD_DB_INSTANCE"
gcloud sql users create "$PROD_DB_USER" --instance="$PROD_DB_INSTANCE" --password="<STRONG_DB_PASSWORD>"

# Safety guard.
gcloud sql instances patch "$PROD_DB_INSTANCE" --deletion-protection
```

### 5.7 Create required secrets

Your backend currently needs:
- `DATABASE_URL`
- `SESSION_SECRET`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `CORS_ORIGIN`
- `COOKIE_DOMAIN`
- `GCS_BUCKET_NAME`
- `GCS_PROJECT_ID`

Create secrets:

```bash
for s in DATABASE_URL_PROD SESSION_SECRET FIREBASE_PRIVATE_KEY; do
  gcloud secrets create "$s" --replication-policy="automatic" || true
done
```

Add secret versions:

```bash
printf 'postgresql://%s:%s@/%s?host=/cloudsql/%s:%s:%s\n' \
  "$PROD_DB_USER" "<STRONG_DB_PASSWORD>" "$PROD_DB_NAME" "$PROJECT_ID" "$REGION" "$PROD_DB_INSTANCE" \
  | gcloud secrets versions add DATABASE_URL_PROD --data-file=-

printf '%s' '<LONG_RANDOM_SESSION_SECRET>' \
  | gcloud secrets versions add SESSION_SECRET --data-file=-

printf '%s' '<FIREBASE_PRIVATE_KEY_WITH_NEWLINES_ESCAPED_AS_\\n>' \
  | gcloud secrets versions add FIREBASE_PRIVATE_KEY --data-file=-
```

### 5.8 Build backend image

Important: build context must be repo root because the Dockerfile copies workspace files from root.

```bash
gcloud builds submit \
  --tag "${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/farmflow-api:prod-v1" \
  --file packages/backend/Dockerfile \
  .
```

### 5.9 Deploy production backend to Cloud Run

```bash
gcloud run deploy "$PROD_RUN_SERVICE" \
  --image "${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/farmflow-api:prod-v1" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --service-account "${PROD_RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --cpu 1 \
  --memory 512Mi \
  --concurrency 40 \
  --timeout 30 \
  --min-instances 0 \
  --max-instances 3 \
  --add-cloudsql-instances "${PROJECT_ID}:${REGION}:${PROD_DB_INSTANCE}" \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "FIREBASE_PROJECT_ID=<firebase-project-id>" \
  --set-env-vars "FIREBASE_CLIENT_EMAIL=<firebase-client-email>" \
  --set-env-vars "CORS_ORIGIN=https://<your-prod-hosting-domain>" \
  --set-env-vars "COOKIE_DOMAIN=<your-prod-hosting-domain>" \
  --set-env-vars "GCS_BUCKET_NAME=farmflow-prod-docs-${PROJECT_ID}" \
  --set-env-vars "GCS_PROJECT_ID=${PROJECT_ID}" \
  --set-secrets "DATABASE_URL=DATABASE_URL_PROD:latest" \
  --set-secrets "SESSION_SECRET=SESSION_SECRET:latest" \
  --set-secrets "FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest"
```

### 5.10 Run database migrations safely

Use Cloud SQL Auth Proxy from an admin machine to avoid opening DB to the internet.

1. Start proxy:

```bash
cloud-sql-proxy "${PROJECT_ID}:${REGION}:${PROD_DB_INSTANCE}" --port 5432
```

2. In another shell (from repo root), run migrations:

```bash
DATABASE_URL="postgresql://${PROD_DB_USER}:<STRONG_DB_PASSWORD>@127.0.0.1:5432/${PROD_DB_NAME}" npm run db:migrate
DATABASE_URL="postgresql://${PROD_DB_USER}:<STRONG_DB_PASSWORD>@127.0.0.1:5432/${PROD_DB_NAME}" npm run db:seed
```

### 5.11 Deploy frontend

```bash
VITE_API_URL="https://<prod-cloud-run-url>/api" npm run build:frontend
firebase deploy --only hosting
```

If you use Firebase rewrite to Cloud Run, set rewrite region to `asia-south1`.

### 5.12 Firebase auth/domain hardening

1. Add production hosting domain under Firebase Auth authorized domains.
2. Remove unused development domains from production project where possible.
3. Verify login and token refresh from production frontend.
### 5.13 Go-live checks

1. `GET /api/health` returns 200.
2. Login flow works with Firebase auth token.
3. Employee list/create/update works.
4. File upload and signed URL download works.
5. Logs have no repeated DB/auth errors.

## 6. Phase 2: Upgrade production DB to HA later

Trigger conditions (pick at least one):

1. Business requires stronger availability guarantees.
2. Downtime impact becomes operationally significant.
3. Data and request volume grow beyond comfort thresholds.

### 6.1 Pre-upgrade checklist

1. Confirm budget impact (`+` monthly DB cost).
2. Schedule maintenance window.
3. Ensure backups and PITR are healthy.
4. Capture baseline latency and error metrics.

### 6.2 Enable HA

```bash
gcloud sql instances patch "$PROD_DB_INSTANCE" \
  --availability-type=REGIONAL
```

### 6.3 Post-upgrade validation

1. Verify application connectivity and query latency.
2. Verify backup and failover status in Cloud SQL.
3. Run smoke tests on payroll, attendance, documents, and reports.

## 7. Phase 3: Add staging (on-demand model)

### 7.1 Create staging resources

Set variables:

```bash
export STAGING_DB_INSTANCE="farmflow-staging-db"
export STAGING_DB_NAME="farmflow_staging"
export STAGING_DB_USER="farmflow_app"
export STAGING_RUN_SERVICE="farmflow-api-staging"
export STAGING_RUN_SA="farmflow-staging-run"
export STAGING_BUCKET="gs://farmflow-staging-docs-${PROJECT_ID}"
```

Create service account and IAM:

```bash
gcloud iam service-accounts create "$STAGING_RUN_SA" \
  --display-name="FarmFlow Staging Cloud Run SA"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${STAGING_RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${STAGING_RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Create staging DB:

```bash
gcloud sql instances create "$STAGING_DB_INSTANCE" \
  --database-version=POSTGRES_15 \
  --tier=<SMALLEST_SHARED_CORE_TIER> \
  --region="$REGION" \
  --availability-type=ZONAL \
  --storage-size=10GB \
  --storage-type=SSD \
  --storage-auto-increase \
  --backup-start-time=01:00

gcloud sql databases create "$STAGING_DB_NAME" --instance="$STAGING_DB_INSTANCE"
gcloud sql users create "$STAGING_DB_USER" --instance="$STAGING_DB_INSTANCE" --password="<STRONG_DB_PASSWORD>"
```

Create and bind staging bucket:

```bash
gcloud storage buckets create "$STAGING_BUCKET" \
  --location="$REGION" \
  --uniform-bucket-level-access

gcloud storage buckets add-iam-policy-binding "$STAGING_BUCKET" \
  --member="serviceAccount:${STAGING_RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud iam service-accounts add-iam-policy-binding \
  "${STAGING_RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --member="serviceAccount:${STAGING_RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

Create staging DB URL secret:

```bash
gcloud secrets create DATABASE_URL_STAGING --replication-policy="automatic" || true

printf 'postgresql://%s:%s@/%s?host=/cloudsql/%s:%s:%s\n' \
  "$STAGING_DB_USER" "<STRONG_DB_PASSWORD>" "$STAGING_DB_NAME" "$PROJECT_ID" "$REGION" "$STAGING_DB_INSTANCE" \
  | gcloud secrets versions add DATABASE_URL_STAGING --data-file=-
```

Deploy staging API:

```bash
gcloud run deploy "$STAGING_RUN_SERVICE" \
  --image "${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/farmflow-api:prod-v1" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --service-account "${STAGING_RUN_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --cpu 1 \
  --memory 512Mi \
  --concurrency 20 \
  --timeout 30 \
  --min-instances 0 \
  --max-instances 2 \
  --add-cloudsql-instances "${PROJECT_ID}:${REGION}:${STAGING_DB_INSTANCE}" \
  --set-env-vars "NODE_ENV=staging" \
  --set-env-vars "FIREBASE_PROJECT_ID=<firebase-project-id>" \
  --set-env-vars "FIREBASE_CLIENT_EMAIL=<firebase-client-email>" \
  --set-env-vars "CORS_ORIGIN=https://<your-staging-hosting-domain>" \
  --set-env-vars "COOKIE_DOMAIN=<your-staging-hosting-domain>" \
  --set-env-vars "GCS_BUCKET_NAME=farmflow-staging-docs-${PROJECT_ID}" \
  --set-env-vars "GCS_PROJECT_ID=${PROJECT_ID}" \
  --set-secrets "DATABASE_URL=DATABASE_URL_STAGING:latest" \
  --set-secrets "SESSION_SECRET=SESSION_SECRET:latest" \
  --set-secrets "FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest"
```

Default staging to stopped:

```bash
gcloud sql instances patch "$STAGING_DB_INSTANCE" --activation-policy=NEVER
```

### 7.2 Start/stop staging runbook

Start staging DB:

```bash
gcloud sql instances patch "$STAGING_DB_INSTANCE" --activation-policy=ALWAYS
```

Stop staging DB to save cost:

```bash
gcloud sql instances patch "$STAGING_DB_INSTANCE" --activation-policy=NEVER
```

When staging DB is restarted after being off, run migrations before test activity:

```bash
cloud-sql-proxy "${PROJECT_ID}:${REGION}:${STAGING_DB_INSTANCE}" --port 5433
DATABASE_URL="postgresql://${STAGING_DB_USER}:<STRONG_DB_PASSWORD>@127.0.0.1:5433/${STAGING_DB_NAME}" npm run db:migrate
```

Operational note:
- Staging Cloud Run can remain deployed with `min-instances=0`.
- Main cost reduction comes from stopping staging Cloud SQL when not in use.

## 8. Observability, backups, and guardrails

### 8.1 Monitoring alerts

Create alerts for:

1. API error rate.
2. API p95 latency.
3. Cloud SQL CPU and storage.
4. Failed backup events.

### 8.2 Backup policy

1. Daily automated backups for production.
2. PITR enabled for production.
3. Monthly restore drill.

### 8.3 Budget controls

1. Configure billing budget alerts at 50%, 80%, and 100%.
2. Review top cost drivers monthly (Cloud SQL, Cloud Run, Storage).

## 9. Cost-performance tuning rules

Start with:

- Cloud Run: `1 vCPU`, `512Mi`, `min=0`, `max=3`, `concurrency=40`
- Cloud SQL: smallest shared-core tier + 10GB SSD

Tune only when needed:

1. If p95 latency is high under load, increase Cloud Run memory to `1GiB`.
2. If CPU saturation appears, increase Cloud Run max instances before increasing min instances.
3. If DB CPU becomes bottleneck, scale Cloud SQL tier first, HA second.
4. Enable HA only when business impact justifies recurring cost increase.

## 10. Required environment variable matrix

| Variable | Prod | Staging | Source |
|---|---|---|---|
| `NODE_ENV` | `production` | `staging` | Cloud Run env |
| `DATABASE_URL` | yes | yes | Secret Manager |
| `SESSION_SECRET` | yes | yes | Secret Manager |
| `FIREBASE_PROJECT_ID` | yes | yes | Cloud Run env |
| `FIREBASE_CLIENT_EMAIL` | yes | yes | Cloud Run env |
| `FIREBASE_PRIVATE_KEY` | yes | yes | Secret Manager |
| `CORS_ORIGIN` | yes | yes | Cloud Run env |
| `COOKIE_DOMAIN` | yes | yes | Cloud Run env |
| `GCS_BUCKET_NAME` | yes | yes | Cloud Run env |
| `GCS_PROJECT_ID` | yes | yes | Cloud Run env |

## 11. Definition of done for go-live

1. Production backend and frontend deployed in `asia-south1`.
2. Production DB live (non-HA), backups and PITR enabled.
3. All required secrets configured in Secret Manager.
4. Migrations applied successfully.
5. Core module smoke tests pass in production.
6. Alerts and budget guardrails configured.
7. Staging created and defaulted to stopped state.
