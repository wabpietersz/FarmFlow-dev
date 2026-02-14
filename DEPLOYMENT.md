# FarmFlow — GCP Deployment Plan (Free Tier)

**Estimated cost: ~$0/month** using free-tier services.

## Architecture

| Service | Platform | Tier | Cost |
|---|---|---|---|
| **Frontend** | Firebase Hosting | Free (Spark) | $0 |
| **Backend API** | Cloud Run | Free tier (2M req/mo) | $0 |
| **Database** | Neon PostgreSQL | Free tier (0.5 GB) | $0 |
| **Auth** | Firebase Auth | Free (50K MAU) | $0 |
| **File Storage** | Firebase Storage | Free (5 GB) | $0 |

### Free Tier Limits

- **Cloud Run**: 2M requests/mo, 360K vCPU-sec, 180K GiB-sec, 1 GiB outbound
- **Firebase Hosting**: 10 GB storage, 360 MB/day transfer
- **Neon PostgreSQL**: 0.5 GB storage, 190 compute hours/mo, auto-suspend after 5 min idle
- **Firebase Auth**: 50K monthly active users

## Prerequisites

1. GCP project with billing enabled (required for Cloud Run, even on free tier)
2. `gcloud` CLI installed and authenticated
3. Firebase CLI installed (`npm install -g firebase-tools`)
4. Neon account (https://neon.tech — sign up with GitHub)

## Step 1: Set Up Neon PostgreSQL

1. Go to https://neon.tech and create a free project
2. Create a database named `farmflow_prod`
3. Copy the connection string (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/farmflow_prod?sslmode=require`)

## Step 2: Enable GCP APIs

```bash
gcloud config set project farmflow-dev
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## Step 3: Deploy Backend to Cloud Run

```bash
# Build and push container
gcloud builds submit --tag gcr.io/farmflow-dev/farmflow-api packages/backend/

# Deploy to Cloud Run
gcloud run deploy farmflow-api \
  --image gcr.io/farmflow-dev/farmflow-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "DATABASE_URL=<neon-connection-string>" \
  --set-env-vars "CORS_ORIGIN=https://farmflow-dev.web.app" \
  --set-env-vars "COOKIE_DOMAIN=.web.app" \
  --set-env-vars "FIREBASE_PROJECT_ID=farmflow-dev" \
  --set-env-vars "FIREBASE_CLIENT_EMAIL=<service-account-email>" \
  --set-secrets "FIREBASE_PRIVATE_KEY=firebase-private-key:latest" \
  --set-secrets "SESSION_SECRET=session-secret:latest" \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2
```

Note the deployed URL (e.g., `https://farmflow-api-xxx-uc.a.run.app`).

## Step 4: Deploy Frontend to Firebase Hosting

```bash
# Initialize Firebase Hosting (one-time)
firebase init hosting

# Set the API URL for production build
VITE_API_URL=https://farmflow-api-xxx-uc.a.run.app/api npm run build:frontend

# Deploy
firebase deploy --only hosting
```

Firebase Hosting config (`firebase.json`):
```json
{
  "hosting": {
    "public": "packages/frontend/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "farmflow-api",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "/assets/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      }
    ]
  }
}
```

## Step 5: Run Database Migrations

```bash
DATABASE_URL=<neon-connection-string> npm run db:migrate
DATABASE_URL=<neon-connection-string> npm run db:seed
```

### Step 5.1: Verify Readiness (Schema + DB)

After migrations, verify runtime readiness before traffic cutover:

```bash
curl -sSf "https://farmflow-api-xxx-uc.a.run.app/api/health?readiness=true"
```

Expected:
- HTTP `200` when DB is reachable and required HR/payroll tables exist.
- HTTP `503` with `checks.hrPayrollSchema.missingTables` when schema migration is incomplete.

## Step 6: Update Firebase Auth Authorized Domains

1. Go to Firebase Console > Authentication > Settings
2. Add your Firebase Hosting domain (`farmflow-dev.web.app`) to authorized domains

## Result

- **Frontend**: `https://farmflow-dev.web.app`
- **API**: `https://farmflow-api-xxx-uc.a.run.app/api`
- **Database**: Neon PostgreSQL (auto-scales, auto-suspends)

## Alternative: Cloud SQL (paid)

If you prefer Google-managed PostgreSQL instead of Neon:

| Service | Cost |
|---|---|
| Cloud SQL (db-f1-micro) | ~$7-9/mo |
| Cloud SQL storage (10 GB) | ~$1.70/mo |
| **Total** | **~$9-11/mo** |

```bash
gcloud sql instances create farmflow-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-size=10GB
```
