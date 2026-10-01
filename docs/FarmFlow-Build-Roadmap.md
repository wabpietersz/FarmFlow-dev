# FarmFlow — Gap Analysis & Build Roadmap

**Date:** 2026-10-01
**Target:** `docs/FarmFlow-Target-Functional-Spec.md`
**Rule:** build to the spec in dependency order. Deployment waits until the owner calls it.

---

## 1. Gap analysis (code audit, 2026-10-01)

### Foundations (these block everything else)
| Gap | Finding in code | Spec |
|---|---|---|
| G1 Money ledger lacks category & cost centre | `treasury_transaction_entries` has account/direction/amount only. Categories exist as free text on `operational_expenses` / `petty_cash_expenses` and nowhere else. | P1, §5 |
| G2 No cost-centre master | Costs are tagged ad hoc with `siteId` / `batchId`. The feed mill and admin aren't cost centres. Employees only carry `siteId`. | P3 |
| G3 Overheads split equally | `lib/batch-costs.ts` divides site/shared costs by the *count* of active batches, not bird-days. Labour uses gross salary ÷ active site batches. | D3 |
| G4 No site scoping for permissions | Roles are a hard-coded map in `lib/permissions.ts`. `users.siteId` exists but isn't enforced. | P6 |
| G5 No approvals engine | Approval is per-module (`status` fields). No thresholds and no inbox. | §4.8 |

### Farm & batch
| Gap | Finding |
|---|---|
| Batch = one cage | `batches.cageId` is a single house. Fine for now. |
| No vaccination/medication schedule templates | `vaccinations` records only what was done. |
| No vet visits, growth standards, house turnaround | Missing. |
| Live KPIs partial | FCR and mortality exist. No ADG, EPEF, target curves, or cost/kg live. |
| No batch close-out freeze | Costs are recomputed live every time. A closed batch's P&L can drift. |

### Feed mill
| Gap | Finding |
|---|---|
| Feed cost excludes mill overheads | Batch feed cost = `productionCost / actualQuantity × qty`. It's raw materials only. |
| No finished-feed stock | Distribution goes straight from a production run to a farm batch. There's no feed-type stock or remaining-balance ledger. |
| No mill cost centre / cost report | Missing. |

### Procurement & inventory
| Gap | Finding |
|---|---|
| Single stock location | `feed_inventory.quantity` is one global number. There are no mill/farm stores and no transfers. |
| No requisitions | POs are created directly. |
| Invoice ↔ GRN matching partial | Supplier invoices link to PO, but quantities and prices aren't matched. |
| No expiry on lots | `inventory_lots` has no expiry date. |

### Sales
| Gap | Finding |
|---|---|
| No sales order/booking | Missing. |
| Legacy `payments` table still read by some reports/tests | Needs cleanup onto buyer receipts. |
| No AR ageing | Missing. |

### Finance
| Gap | Finding |
|---|---|
| G1 above; no category master | |
| No capital / drawings / loans flows | Possible only as manual transactions with no category. |
| Reports not category/cost-centre based | Missing management P&L and cash-flow reports. |
| No AP ageing | Missing. |

### HR & payroll
| Gap | Finding |
|---|---|
| No EPF/ETF | Missing. |
| No salary advances / staff loans | Missing. |
| No payslip PDF / bank transfer list | Missing. |
| Labour not allocated by cost centre | Missing; labour is allocated per site only. |

### Quality
| Gap | Finding |
|---|---|
| Local DB/tests not verified since June | 12 backend suites. No inventory tests. No frontend tests. |

---

## 2. Build roadmap (dependency order)

Each phase ends with: migrations applied, backend tests green (with new tests for the phase), all 3 packages build, and a short UI smoke check.

### Phase 0: Baseline green — ✅ DONE (2026-10-01)
- Backend suite green (293/293).
- **Found and fixed:** migrations 0000–0017 couldn't build a fresh database (0002 and 0003 both created the feed tables), and 0008–0017 had no drizzle snapshots, so `db:generate` wanted to recreate half the schema. The code schema matched the dev DB exactly (apart from one unique index, now added to the code). So the history was **squashed into one baseline** `0000_baseline.sql`, and the dev DB was marked as applied. A fresh install now works, and `db:generate` reports no drift. Backup of the pre-squash dev DB: `/tmp/farmflow_dev_pre_squash.dump` inside the `farmflow-db` container.
- **Found:** CI has been red since Feb 2026 (no ESLint config in `packages/backend`). Spun off as a separate task.

### Phase 1: Finance foundations (G1, G2) — ✅ DONE (2026-10-01)
Delivered: `cost_centres` + `finance_categories` (34 system categories), migration `0001_finance_foundations` with backfill; every ledger line carries category / cost centre / batch, validated in one place (`lib/finance-tags.ts`); receipts split per sale; reversals mirror; supplier payments split by PO line category; payroll by employee cost centre; `/treasury/ledger` line-level ledger + re-tag endpoint; categories/cost-centre admin; Treasury **Ledger** and **Setup** tabs; tag pickers on manual movements, petty cash, supplier payments, work orders, suppliers, item types, POs, employees. Real-Postgres integration suite (`npm run test:integration`) — 15 tests. Also fixed: `PUT /sites/:id` only required `sites:read`.

Original plan:
- `cost_centres` master: type `site` | `mill` | `admin`, linked to `sites`. Seed Farm A, Farm B, Feed Mill and Admin.
- `finance_categories` master: income/expense/transfer/equity/loan, with a system code (GL-ready mapping key). Seed the default list.
- Add `category_id`, `cost_centre_id` and `batch_id` to ledger entries. Every existing poster (receipts, payroll, supplier payments, petty cash, operational expenses, manual) must supply them. Backfill existing rows.
- `employees.cost_centre_id` (defaults from the site).
- Ledger UI: filters by category, cost centre and batch; category/cost-centre pickers on manual entries and expenses.

### Phase 2: True batch & mill costing (G3, D2, D3) — ✅ DONE (2026-10-01)
Delivered: new costing engine (`lib/costing.ts`, `lib/bird-days.ts`).
- Batch cost = chicks (placement) + feed at mill cost (materials/kg + monthly mill overhead/kg) + stock used (FIFO) + pooled costs split by bird-days: farm costs across that farm's batches, admin across all farms, mill costs into feed.
- Uses the tagged money ledger, so petty cash, manual spends and settled expenses now reach batches. PO payments, chick payments, wages (taken from payroll) and equipment are excluded from the ledger side to avoid double counting.
- Batch close-out freezes costs, revenue and KPIs (FCR, livability, EPEF, cost/kg, profit). It refuses to close while birds are unaccounted for unless the variance is accepted, reports costs that arrive after closing, and supports reopen. Closed batches block edits, feed dispatch and stock use.
- 90-day stale-batch cap with a warning.
- New screens: batch **Performance & profit** panel and the **Reports → Cost Allocation** tab (pool totals, charged vs not charged, mill overhead/kg).
- Integration tests assert exact hand-calculated splits and that no rupee is lost.

Original plan:
- Bird-days allocation engine (live birds per day from daily records) for site overheads, shared overheads and labour.
- Mill cost centre: mill overheads (expenses, labour) absorbed into cost/kg per period.
- Finished-feed stock by feed type/production run. Dispatch to a batch charges actual mill cost/kg.
- Batch close-out: freeze the cost/revenue snapshot and KPIs on close.

### Design overhaul (option C "Open Air") — ✅ DONE (2026-10-01)
Top navigation bar (Home · Farms · Feed mill · Stock · Sales · Money · People · Reports; admin in the profile menu), phone bottom bar + "More" sheet, light/dark/match-device theme with no flash, Manrope, semantic colour tokens (status colours work in both themes, ~350 hard-coded colours converted), restyled base components, charts themed, new Home screen (`GET /dashboard/home`: cash, month in/out, growing batches, to-do list, spend by group), new login.

### Phase 3: Farm operations — ✅ DONE (2026-10-01)
Health programmes (templates by day of age, auto-applied to new batches, re-dated when placement changes, doses per 1,000 birds), health tasks with Done (records vaccination + FIFO stock charge in one transaction) / Skip; vet visits (+ "Vet Services" money category); growth standards with actual-vs-target (weight, mortality) and interpolation; **Today's check** phone screen (`/batches/:id/today`, live birds derived, works offline); house turnaround checklist (auto-starts when a batch is sold/closed, ends on next placement); batch history comparison with best FCR/EPEF/profit; FCR now uses logged feed. Seeded example programme and growth curve are labelled "confirm with your vet" / "replace with your breed guide". Health due/overdue tasks feed the Home to-do list. 7 new integration tests.

Original plan:
- Vaccination/medication schedule templates → auto-generated batch schedule, due/overdue, completion consumes stock.
- Vet visits (findings, treatment, cost).
- Breed growth standards and actual-vs-target (weight, FCR, mortality). Live ADG, EPEF, cost/bird and cost/kg.
- House turnaround (cleaning, litter, downtime).
- Batch comparison and house/site history.

### Phase 4: Procurement & inventory — ✅ DONE (2026-10-01)
Duplicate `/feed` supplier/PO routes removed (all on `/inventory`). Stores: Main and Mill stores seeded, each farm gets its own store on creation; lots carry a store; transfers split lots so cost and expiry travel with the stock; per-store balances. Receiving is one transaction (all lines checked first) into a chosen store (default: feed → Mill, farm order → that farm's store, otherwise Main) with expiry dates. Stock is used soonest-expiry first, expired stock is never used (except manual adjustments), expiring/expired lots show on Home and on Stock → Stores with write-off. Requisitions (request → approve/reject → draft PO). Invoices are matched to goods received (tolerance Rs 100 or 1%); over-billed invoices need a written reason to approve; matches refresh when more goods arrive. Stock page gains Stores and Requests tabs. 6 new integration tests.

Also done alongside: **role access matrix** (each module has None/User/Admin per role, stored in `role_module_access`, editable in Settings → Access & roles; system admin is always full admin), **Settings rework** (one page with sections: access, users, lists, stock item types, stores, money setup, health, alerts), **password reset fix** (server sends the email when SMTP is set; otherwise the app says so and gives a copyable link instead of claiming success; "Forgot password?" on login).

Original plan:
- Consolidate the duplicate supplier/PO endpoints (`/feed/*` and `/inventory/*` both exist and the UI calls both).
- Stock locations (mill store, farm stores), transfers, and per-location balances.
- Purchase requisitions → PO.
- GRN ↔ invoice quantity/price matching.
- Lot expiry and alerts.

### Phase 5: Sales completion — ✅ DONE (2026-10-01)
Receipts and their money-ledger posting now save in one transaction (also cheque clear/bounce), so a receipt can never exist without its money line. Old `payments` rows converted to buyer receipts (migration 0007; 3 rows in dev) and no code reads that table any more. **Bookings**: buyer + batch + catch date + birds + price/kg, guarded against over-booking a batch; "Make the sale" pre-fills the sale and links it (cancelling the sale re-opens the booking). **Other income**: manure, litter, scrap etc. as a sale type with item/qty/unit price, farm and optional batch; receipts post to *Other Farm Income*. **Credit**: buyers get a credit limit; a sale that takes them over it is blocked unless a sales admin gives a reason (kept on the sale). Sales get a due date (sale date + credit terms). **Owed to you**: receivables ageing (not due / 1–30 / 31–60 / 61–90 / 90+) per buyer, and a buyer statement for any period with PDF. Home to-dos: catches in the next 3 days, buyers late paying. 4 new integration tests.

Original plan:
- Make receipt creation + treasury posting one DB transaction (today a receipt can save without its ledger posting if posting fails).
- Sales orders/bookings → sale.
- Remove legacy `payments` reads and move tests onto buyer receipts.
- AR ageing and buyer statements. Other-income sales (manure/litter/scrap).

### Phase 6: HR & payroll completion — ✅ DONE (2026-10-01)
One pay engine (`lib/payroll-calc.ts`) for preview, generation and edits: **EPF** employee 8% (deducted) and employer 12%, **ETF** 3%, rates in Settings → Payroll and frozen on each payroll; worked out on basic + allowances marked "counts for EPF"; employees have EPF number and member flag. **Advances & loans**: paid out from Money (category *Staff Advances & Loans*), recovered automatically in payroll (instalments, capped so net pay never goes negative), or paid back directly; write-off. **Paying**: marking paid is now one transaction with the posting; pay a whole month at once; each payment posts Wages (gross less manual deductions) out, EPF withheld in, advance recovery in — so only net pay leaves the bank. **EPF/ETF return** per month with CSV, paid over in one posting split by each employee's cost centre (employee share clears *EPF Withheld*, employer share is *EPF/ETF* expense). Labour cost in batch costing = gross + employer EPF/ETF. **Payslip PDFs** (one or all), **payroll register** (CSV), **bank transfer list** (CSV). 3 new integration tests.

Original plan:
- EPF (8% / 12%) and ETF (3%): configurable rates, payroll lines, monthly contribution report, remittance posting.
- Salary advances and staff loans with payroll recovery.
- Payslip PDF, payroll register, bank transfer list.
- Payroll ledger postings split by employee cost centre.

### Phase 7: Finance reporting — ✅ DONE (2026-10-01)
Money page gains **Profit & loss** (income/expense by category × month; whole business, one cost centre, or all centres compared; CSV; buyer credit applied to a later sale is recognised as Bird Sales/Other Farm Income on the day it is applied), **Cash flow** (opening → trading → owner/loans/advances → closing, by month, per account or all; CSV), **Payables** (supplier ageing by due date, invoices awaiting approval, advance payments; supplier statements with CSV) and **Owner & loans** (owner money in/out as capital/drawings; business loan register — loan received posts *Loan Received*, repayments split principal *Loan Principal Repayment* vs interest *Loan Interest* expense; suggested monthly interest). Also: a sweep fixed correlated sub-queries that lost their table names (Money transactions list failed), feed routes shadowed by `/:id`, deep links lost on sign-in, and an API smoke test now calls every list endpoint against real Postgres. 2 new integration tests + 90-endpoint smoke test.

Original plan:
- When buyer credit (a Customer Advance) is later applied to a sale, the P&L must reclassify it as Bird Sales for that batch. No cash moves at that point, so this happens in reporting, not the ledger.
- Management P&L and cash flow by period × cost centre × category.
- AP ageing, supplier statements.
- Capital, drawings and loan flows (categories + loan register).

### Phase 8: Platform — ✅ DONE (2026-10-01)
**Farm scope** (`lib/site-scope.ts`): a user with a farm only sees and changes that farm — 55 routes guarded by record (batch, sale, employee, payroll, health task, vet visit, turnaround, farm), lists and reports filtered, creates for other farms refused; system admin and farm-less users see all. **Approvals** (`lib/approvals.ts`): limits in Settings → Approvals for purchase orders and money out; over-limit items by people who can't approve wait as *pending approval* (money isn't in balances or reports until approved); approve/reject with reason, no self-approval; rejected PO back to draft. **Approvals page** lists those plus every other review waiting (petty cash, expenses, supplier invoices, work orders, contracts, stock requests, payroll, draft sales). **Notifications** (`lib/notifications.ts`): bell in the top bar; every 30 minutes the server notifies the right people (by permission and farm) about vaccinations due/overdue, expiring/expired lots, low stock, buyer cheques to deposit, approvals waiting, catches tomorrow and late payers; each thing once; approval decisions notify the requester. **Owner dashboard**: Home shows this month's profit, owed to you, you owe suppliers and approvals waiting. 4 new integration tests.

Original plan:
- Site-scoped data access (users see only their site's data unless their scope is global) (G4).
- Approvals engine: configurable thresholds and an approval inbox (G5).
- Notifications (vaccination due, low stock, expiring lots, cheques due, approvals).
- Owner dashboard rebuilt on the above.

### Phase 9: Hardening — ✅ DONE (2026-10-01)
**Security:** a static test proves all 250+ routes require sign-in (except login) and the smoke test proves every list endpoint answers 401 without a token; farm scope enforced (Phase 8); first-admin script no longer contains a password (prints a set-password link). Dependencies: production audit 29 issues (4 critical) → 6 (0 critical); upgraded drizzle-orm 0.45 (SQL escaping fix), drizzle-kit 0.31, nodemailer 10, firebase-admin 14, @google-cloud/storage 8, react-router-dom 7.18. The 6 left are in the Firebase web SDK's Firestore/gRPC parts (not bundled; only "fix" is a 2022 downgrade) and Google client libraries. **Quality:** ESLint now runs in all packages (backend/shared had no ESLint 9 config) with 0 errors; dead code removed; effects that copied server data into state replaced by render-time reset (`useResettableState`). **Performance:** 35 join indexes; sales list batched (was ~5 queries per row); a year-of-data volume test keeps every heavy report and list well under 2.5 s (slowest Home 266 ms). **Deployability:** the compiled backend previously crashed on start (shared emitted extension-less ESM imports) — fixed (NodeNext); backend image applies migrations on start (verified on a blank database and as a running container); frontend image takes `BACKEND_URL`; Node 22 everywhere (CI, Docker, engines); seed no longer overwrites lists edited in Settings. **Tests:** 273 backend unit, 246 integration against real Postgres (incl. 98-endpoint smoke ×2 and volume), 18 frontend unit. **Docs:** user guide, README, deployment guide steps rewritten. Browser end-to-end tests were not added: sign-in is Firebase (hosted), so they need a Firebase Auth emulator or a dedicated test project — recommended as the next step before go-live.

Original plan:
- Frontend unit tests on critical flows, E2E happy paths, performance pass, docs.
