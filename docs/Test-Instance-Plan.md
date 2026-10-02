# FarmFlow test instance plan

**Date:** 2026-10-02
**Goal:** put the app in the hands of the few people who actually run these processes (farm, mill, stores, sales, accounts, payroll) so they can use it on their own phones and laptops and tell us what fits their work and what doesn't. The instance is small and safe to break. Deployment, governance and security are covered below, sized for a handful of users and made-up data.

**Main output:** their feedback, turned into fixes, before any real data goes in. See [rollout/README.md](rollout/README.md) for how the sessions run and how feedback is captured.
**Companion documents:** [Deployment-Guide.md](Deployment-Guide.md) (the commands), [rollout/README.md](rollout/README.md) (what gets tested on the instance), [finance-demo/README.md](finance-demo/README.md) (the demo run on it).

---

## 1. Where we are today

| Area | State (checked in the repo on 2026-10-02) |
|---|---|
| Code | All 9 roadmap phases done on branch `feature/complete-system`, 14 commits ahead of `main`, pushed to GitHub. Not merged. |
| Tests | 273 backend unit, 246 integration (real Postgres), 18 frontend unit. No browser end-to-end tests. |
| CI | Two GitHub workflows (backend, frontend). They run **only** on pushes and pull requests to `main`, so the feature branch has never been through CI in its final state. |
| Images | `packages/backend/Dockerfile` and `packages/frontend/Dockerfile` build and run. The backend applies migrations on start. |
| Cloud | Firebase project `farmflow-dev` exists (used for local development sign-in). No Cloud Run service, Cloud SQL instance, bucket or secrets exist yet. There is no `firebase.json` in the repo. |
| Deployment | Manual commands only. No deploy pipeline. |

## 2. Decisions needed before starting

These are the owner's calls. Each has a recommendation so work isn't blocked.

| # | Decision | Recommendation | Why |
|---|---|---|---|
| T1 | Where the test instance runs | **Decided 2026-10-02: Cloud Run + Neon free Postgres, in Singapore, for the initial test run.** About USD 0–2 a month. | The aim is user feedback, not a rehearsal of the production database. The same two images and deploy steps are used as production; only the database connection differs. See section 2a for what this does and doesn't cover, and the Cloud SQL option kept as the step up. |
| T2 | Firebase project for test sign-ins | **A new project, `farmflow-test`** | Keeps test users, reset emails and service-account keys apart from development and from the future production project. |
| T3 | How the frontend is served | **Frontend image on Cloud Run**, proxying `/api` to the backend | Works today with no new config. Firebase Hosting needs a `firebase.json` that doesn't exist yet. One origin also means no CORS surprises. |
| T4 | Test address | The default `*.run.app` address | A custom domain adds nothing for testing. |
| T5 | Who gets access | **Five to seven named people at most:** the owner, plus one person who really does each process (accounts, a farm manager, the mill operator, whoever keeps the stores, whoever runs payroll). No general sign-up. | The point is feedback from people who know the process. A small group also keeps the security and support load low. |
| T6 | Test data | **Made-up data only.** No real salaries, bank details or ID numbers | The test instance has weaker controls than production will. |

## 2a. The initial test run setup, against production

| Layer | Initial test run | Production plan |
|---|---|---|
| Users | 5 to 7 named pilot users | All farm staff, by role |
| Web app | Frontend image on Cloud Run, default address | Firebase Hosting, own domain |
| Backend API | Cloud Run, scales to zero | Cloud Run, one warm instance |
| Database | **Neon free Postgres** | Cloud SQL with backups and point-in-time recovery |
| Sign-in | Firebase Auth, `farmflow-test` project | Firebase Auth, production project |
| Documents and secrets | Private bucket, Secret Manager | Private bucket, Secret Manager |
| Data | Made-up only | Real farm records |
| Region | Singapore (`asia-southeast1`; Neon `ap-southeast-1`) | Mumbai (`asia-south1`) |
| Monthly cost | About USD 0–2 | About USD 10–25 |

**Why Neon fits:** it is standard Postgres, so the backend's driver and the migrations-on-start run unchanged; only `DATABASE_URL` is different. It sleeps when idle, which suits a handful of users. It can branch a database, which makes resetting to the clean baseline quick.

**What this setup does not rehearse** (do a one-day rehearsal of each when production is built):

- Cloud SQL: the connector, automated backups, point-in-time recovery.
- Firebase Hosting with a custom domain.
- The warm backend instance that keeps the 30-minute notification check running on time.

**Things to accept or check:**

- **Notifications:** with the backend scaled to zero, the bell's 30-minute check only runs while someone is using the app, and may be late. Fine for a pilot. Before production, move the check to a Cloud Scheduler job calling an endpoint.
- **First request after a quiet spell** takes a few seconds longer while the backend and database wake.
- **Region:** as far as we know Neon has no Mumbai region, so both the database and Cloud Run sit in Singapore to stay close to each other. Check the speed on a farm phone in the first week.
- **Free-tier limits:** roughly 0.5 GB of storage and a monthly compute allowance. Confirm the current limits on Neon's pricing page before starting. Made-up pilot data is far below them.
- **One more account:** Neon is a separate vendor. Its account needs two-step verification, and its connection string lives only in Secret Manager.
- **The database is reachable from the internet,** protected by TLS and a generated password. Acceptable for made-up data only; it is one more reason real data never goes in here.

**Step up if needed:** if Neon's limits or speed get in the way, switch the database to Cloud SQL `db-f1-micro` (about USD 10–12 a month more) by following Deployment Guide step 3 and changing `DATABASE_URL`. Nothing else changes.

## 2b. This setup is temporary; production will be enterprise-ready

The cheap setup above exists only to get feedback from the pilot group. It is **not** the starting point for production and will not be grown into it. When the production-ready version is available, production is built fresh, in its own project, on resources chosen for reliability rather than cost.

| Area | Initial test run (now) | Production (enterprise-ready) |
|---|---|---|
| Database | Free hosted Postgres, no guarantees | Cloud SQL, regional high availability, daily backups, point-in-time recovery, monthly restore drill |
| Backend | Scales to zero, cold starts accepted | Always-available instances sized for load, in Mumbai |
| Scheduled work | Runs only while the app is in use | Cloud Scheduler job, independent of web traffic |
| Web app | Default `run.app` address | Own domain, CDN hosting |
| Deploys | By hand, one person | Pipeline from a tagged commit, no stored keys, with an approval step |
| Monitoring | None; the deployer is in the chat group | Uptime checks, error-rate and latency alerts, database alerts, someone named to respond |
| Access | A handful of named users | Roles by job, second factor for admin and accounts, leaver process |
| Secrets | In Secret Manager | In Secret Manager, rotated on a schedule |
| Data | Made-up, disposable | Real, with retention and backup rules |
| Vendor | Google Cloud plus Neon | Google Cloud only |

**What carries over from the test run to production:**

- the application images and the way they are configured;
- the fixes in section 3;
- the security checklist in section 7, applied in full;
- the deployment rules in section 5;
- the feedback, and the changes made because of it.

**What does not carry over:**

- the Neon database and anything in it;
- the `farmflow-test` Firebase project and its users;
- any shortcut listed under "kept simple" in section 4.

The production build itself follows [Deployment-Guide.md](Deployment-Guide.md), which should be reviewed against this table before go-live: it currently starts production without high availability and with manual deploys.

## 3. Things to fix first

Found while reading the code for this plan. The first three should be done before the instance is shared with anyone.

| # | Finding | Where | Effect on a test instance | Fix |
|---|---|---|---|---|
| F1 | Security hardening is switched on only when `NODE_ENV` is exactly `production` | `packages/backend/src/config/index.ts`, `middleware/security.ts` | The staging runbook in the deployment guide sets `NODE_ENV=staging`. That turns off HSTS and upgrade-insecure-requests and loosens rate limits tenfold (1,000 requests and 100 sign-in attempts per 15 minutes) | Run the test instance with `NODE_ENV=production`. Correct the staging runbook. |
| F2 | The server starts with a known session secret if none is set | `config/index.ts` (`'dev-secret'`); `validateConfig()` only checks the database URL | A missed secret goes unnoticed | Make `validateConfig()` refuse to start in production without `SESSION_SECRET`, `CORS_ORIGIN` and the three Firebase values. |
| F3 | `npm run db:reset` drops the whole database with no check on which database it points at | `packages/backend/src/db/reset.ts` | One wrong `DATABASE_URL` in a terminal wipes the test (or later, live) data | Add a guard: refuse unless the host is `localhost` or a `--yes-wipe <dbname>` flag matches. |
| F4 | The backup status in the health data is invented | `packages/backend/src/lib/backup.ts` returns "last backup 24 hours ago" in production without asking anything, and its comments still describe Neon | Monitoring would show healthy backups even if none exist | Remove the fake status or read it from the real database service. Until then, check backups by hand (Neon console for the test run; Google Cloud console in production). |
| F5 | `docker-compose.production.yml` has fallback passwords (`farmflow_prod`, `change-this-in-production`) | repo root | Only matters if option "single VM" is chosen in T1 | Remove the fallbacks so a missing value fails loudly. |
| F6 | CI doesn't run on the working branch | `.github/workflows/*.yml` | Nothing proves the commit being deployed is green | Open a pull request to `main` (this triggers both workflows), and merge once green. |
| F7 | Approval limits are off by default | migration `0011` seeds `approvals.limits` as `null` | On a fresh instance nothing waits for approval until limits are set | Set limits in **Settings → Approvals** as part of instance setup (and answer the open question in the functional spec). |
| F8 | Documents fall back to a fake `local://` path when no bucket is set outside production | `lib/storage.ts` | Covered by F1 plus setting `GCS_BUCKET_NAME` | Create the bucket (step 4 below). |
| F9 | `/api/health` and the app are public on the internet | Cloud Run `--allow-unauthenticated` | Expected for a web app; sign-in protects everything else (a test proves all 250+ routes need it) | Accept. Keep the address out of public places. |

## 4. Steps from here to a running test instance

Rough effort is for one person who has the Google Cloud access. Commands are in [Deployment-Guide.md](Deployment-Guide.md); only the differences are spelled out here.

### Stage A: get the code ready (half a day)

1. Fix F1, F2 and F3 on `feature/complete-system`.
2. Open a pull request from `feature/complete-system` to `main`. Wait for both CI workflows to pass.
3. Merge. Tag the merge commit `test-2026-10-xx`. **Only tagged commits are deployed to the test instance.**

### Stage B: create the cloud pieces (half a day, once)

4. **Firebase:** create project `farmflow-test`. Turn on Email/Password sign-in. Add a web app and note its config values. Create a service account key for the Admin SDK.
5. **Google Cloud** (the same project as Firebase): enable the APIs (Deployment Guide step 1; `sqladmin` isn't needed) and create an Artifact Registry repository called `farmflow` in `asia-southeast1`.
6. **Database (Neon):**
   - Create a Neon account with two-step verification, on the free plan.
   - Create a project `farmflow-test`, Postgres 15, region AWS `ap-southeast-1` (Singapore), database `farmflow_test`.
   - Copy the **direct** connection string (not the pooled one; the backend keeps its own small pool and runs migrations on start). It must end with `?sslmode=require`.
7. **Bucket:** create a private bucket `farmflow-test-documents` in `asia-southeast1`, uniform access, no public access.
8. **Secrets** in Secret Manager: `DATABASE_URL_TEST` (the Neon connection string), `SESSION_SECRET_TEST`, `FIREBASE_PRIVATE_KEY_TEST`, `SMTP_PASS_TEST`. Generate the session secret with `openssl rand -base64 48`.
9. **Service account for the backend:** create `farmflow-api-test@…` with only: Secret Manager Secret Accessor (on those four secrets) and Storage Object Admin (on that one bucket). Do not run the service as the default compute account.
10. **Budget alert** on the project at USD 10 a month, emailed to the owner.

### Stage C: deploy (two hours)

11. Build and push the backend image from the repository root, tagged with the git short hash (Deployment Guide step 5).
12. Deploy `farmflow-api-test` to Cloud Run in `asia-southeast1` with:
    - `NODE_ENV=production` (see F1)
    - `--service-account farmflow-api-test@…`
    - `--min-instances 0 --max-instances 2` (scales to zero; see section 2a on notifications)
    - no `--add-cloudsql-instances` flag (the database is reached over TLS using `DATABASE_URL`)
    - `CORS_ORIGIN` set to the frontend address from step 14 (deploy once, read the address, then update this value)
    - the `_TEST` secrets
13. Build the frontend image with the `farmflow-test` Firebase values as build arguments and `VITE_API_URL=/api`.
14. Deploy `farmflow-web-test` to Cloud Run in `asia-southeast1` with `BACKEND_URL=https://<farmflow-api-test address>`. This is the address testers use.
15. In Firebase → Authentication → Settings → Authorised domains, add the `farmflow-web-test` address.
16. Check: `curl -sSf "https://<api address>/api/health?readiness=true"`.

### Stage D: first data and users (two hours)

17. Run the dropdown seed against the test database from a development checkout, with `DATABASE_URL` set to the Neon connection string for that one command (Deployment Guide step 7; no proxy is needed). Don't save the string in a `.env` file, and don't run `db:reset` in that terminal (F3).
18. Create the first admin with `setup-admin.ts` using the owner's email. Open the printed link and set a password.
19. In the app, as admin:
    - **Farms → Sites & houses:** two farms and their houses.
    - **Money → Accounts:** the test money accounts.
    - **Settings → Approvals:** set the limits (F7).
    - **Settings → Users:** one test user per role, farm managers tied to their farm.
    - **Settings → Access & roles:** review the matrix.
20. Run section 0 of [Manual-Test-Plan.md](Manual-Test-Plan.md) as a smoke check.
21. Save the **"clean baseline"**: create a Neon branch named `clean-baseline`, and also take a `pg_dump` export as a copy that doesn't depend on Neon. Resetting to the baseline is how the instance is cleared between test rounds and before the finance demo. Prove the reset works once now.

### Stage E: hand over (one hour)

22. Send each person their sign-in link, the address, and the user guide for their area ([user-guide/README.md](user-guide/README.md)).
23. Book the first feedback session with each person (rollout plan, section 2).

### What a small pilot lets us keep simple

| Kept simple | Because |
|---|---|
| Manual deploys by one person | A handful of releases, a handful of users |
| A free hosted database instead of Cloud SQL | Made-up data; a reset to baseline is acceptable |
| Backend scales to zero | Notifications that arrive late don't matter in a pilot |
| Default `run.app` address, no custom domain | Nobody outside the group needs to find it |
| No uptime alerting | The deployer is in the same chat group as the users |

| Not relaxed | Because |
|---|---|
| `NODE_ENV=production`, real secrets, least-privilege service account | The instance is on the public internet, and bad habits carry into production |
| Separate Firebase project and database | Test accounts must never mix with real ones |
| Made-up data only | Controls here are lighter than production's |
| Every change through a pull request with CI green | Feedback fixes will come quickly; this is what stops them breaking something else |

**Total:** about two working days, most of it waiting on builds and cloud provisioning.

## 5. Deployment rules

| Rule | Detail |
|---|---|
| What gets deployed | Only a tagged commit on `main` that passed CI. |
| Image tags | The git short hash. Never `latest`. |
| Who deploys | One named person (the owner, or whoever holds the cloud role). |
| When | Not during a test session. Announce in the testers' group before and after. |
| Migrations | Run automatically on start. Before any deploy that includes a new migration file, take a database export first. Migrations only go forward; going back means restoring the export. |
| Roll back | Cloud Run keeps earlier revisions. Send traffic back to the previous revision. If the release included a migration, also restore the export taken before it. |
| Record | Add a line to the release log (below) for every deploy. |

### Release log (keep at the bottom of this file or in a sheet)

| Date | Tag / commit | Migrations included | Deployed by | Export taken | Notes |
|---|---|---|---|---|---|
| | | | | | |

### Later, not now

A GitHub Actions deploy job (build, push, deploy on tag) using Workload Identity Federation instead of stored keys. Worth adding before production; manual deploys are fine for a test instance with a handful of releases.

## 6. Governance

### Environments

| Environment | Purpose | Data | Who can sign in | Who can deploy |
|---|---|---|---|---|
| Local | Development | Made up | Developer | Developer |
| **Test** | Rollout testing, training, demos | Made up only | Named testers | One named person |
| Production (later) | Running the farm | Real | Staff, by role | One named person, after sign-off |

Each environment has its own Firebase project, database, bucket and secrets. Nothing is shared.

### Access

- **Cloud console:** two people at most with Owner or Editor. Two-step verification required on both Google accounts.
- **App system admin:** the owner plus one backup. Everyone else gets the lowest role that lets them do their job, and a farm where it applies.
- **Leavers:** deactivate in **Settings → Users** the same day. Review the user list at the start of each area.
- **Database:** no direct access for testers. The Neon account and connection string are held by the deployer only (and the owner as backup), with two-step verification on the account.

### Change control

1. Every change is a pull request to `main` with CI green.
2. A change that adds a migration says so in the pull request title.
3. Defects found in testing are logged (see the rollout plan) and fixed through the same route. No fixes typed straight into the test database.
4. The owner signs off each area before the next one starts.

### Data rules

- No real personal data in the test instance: no real NIC numbers, bank accounts or salaries. Use obviously fake values.
- Test exports are deleted from laptops after use.
- The test database is wiped or restored to "clean baseline" before production data entry begins, so test records can never be mistaken for real ones.

### Backups

| Item | Test | Production (for comparison) |
|---|---|---|
| Automated backup | Neon's built-in history only (short on the free plan; don't rely on it) plus the `clean-baseline` branch | Cloud SQL daily backups, 35 days kept, point-in-time recovery |
| Manual export (`pg_dump`) | Before every migration release and before each area starts. This is the real backup for the test run | Before every release |
| Restore practice | Once, in the first week, to prove the baseline restore works | Monthly |

## 7. Security

### Already in place (verified in code)

- Every API route except sign-in requires a valid Firebase token; a static test and the smoke test enforce this.
- Role access matrix (None / User / Admin per area) and farm scoping on 55 routes.
- Security headers, HTTP parameter pollution protection, input sanitising, request timeouts and rate limits (when `NODE_ENV=production`).
- The first-admin script never sets or prints a password.
- Audit log of who changed what.
- Approvals engine with no self-approval; period locks.
- `.env` files and `important.md` are git-ignored.

### Checklist for the test instance

- [ ] `NODE_ENV=production` on the backend (F1).
- [ ] Startup refuses missing secrets (F2).
- [ ] Reset script guarded (F3).
- [ ] All secrets in Secret Manager; none in the Cloud Run environment list, in the repo, or in chat.
- [ ] Backend runs as its own least-privilege service account (step 9).
- [ ] Neon: account has two-step verification; the database password is generated, not chosen; the connection string uses `sslmode=require` and exists only in Secret Manager.
- [ ] No real data has been entered (the test database is reachable from the internet).
- [ ] Bucket is private with uniform access.
- [ ] `CORS_ORIGIN` is the exact frontend address, not `*`.
- [ ] Firebase authorised domains list contains only the test address and `localhost`.
- [ ] Firebase web API key restricted (Google Cloud → Credentials) to the test address and to the Identity Toolkit API.
- [ ] Firebase Authentication: email enumeration protection on; password policy set to at least 10 characters.
- [ ] `npm audit --omit=dev` reviewed on the tagged commit. Six known issues remain in Google client libraries (see roadmap Phase 9); nothing new should appear.
- [ ] Sign in as a farm-scoped user and confirm the other farm's batches, sales and staff can't be seen or opened by typing the address.
- [ ] Sign in as a farm worker and confirm Money and People are not reachable.
- [ ] Budget alert set.

### Known gaps to close before production (not blockers for test)

| Gap | Note |
|---|---|
| No browser end-to-end tests | Needs the Firebase Auth emulator or the test project. The test instance makes this possible. |
| No uptime or error alerts | Add Cloud Monitoring uptime check on `/api/health` and an alert on 5xx rate. |
| Fake backup status (F4) | Fix or remove. |
| No second factor on app sign-in | Consider for system admin and accounts roles. |
| Notification schedule runs inside the web server | It only runs reliably on an instance whose CPU is always on, which costs about USD 50–65 a month. A Cloud Scheduler job calling an endpoint every 30 minutes is the cheaper and cleaner answer, and lets the backend scale to zero. Needs a small code change. |
| Cloud SQL and Firebase Hosting not rehearsed | The test run uses Neon and a Cloud Run frontend (section 2a). Rehearse both when production is built. |
| Secret rotation | Quarterly, per the deployment guide. |

## 8. Cost of the test instance

Estimates from list prices as recalled on 2026-10-02, not checked against the live pricing pages. Confirm before committing.

**Initial test run (chosen):**

| Item | While testing | Parked |
|---|---|---|
| Neon Postgres, free plan | USD 0 | USD 0 |
| Cloud Run backend, scales to zero | about USD 0 (inside the free allowance at pilot usage) | USD 0 |
| Cloud Run frontend, scales to zero | about USD 0 | USD 0 |
| Storage, secrets, image registry | under USD 1–2 | under USD 1 |
| **Total** | **about USD 0–2 a month** | **under USD 1** |

A new Google Cloud billing account also comes with trial credit that would cover this.

**Step-up options, if needed:**

| Change | Adds per month |
|---|---|
| Cloud SQL `db-f1-micro` instead of Neon | about USD 10–12 |
| One warm backend instance, normal billing (notifications still not reliably on time) | about USD 10–13 |
| One warm backend instance with CPU always on (notifications reliable) | about USD 50–65 |

## 9. Exit: when the test instance has done its job

- All areas signed off ([rollout/README.md](rollout/README.md)).
- Finance demo delivered and the owner accepts the numbers ([finance-demo/README.md](finance-demo/README.md)).
- No open defects of severity 1 or 2.
- "Before production" gaps in section 7 closed or accepted in writing.
- Then: build production as a separate, enterprise-ready project (section 2b). The free test setup has done its job at that point. For training and for trying each release before it goes live, stand up a proper staging environment that matches production rather than keeping the Neon instance.
