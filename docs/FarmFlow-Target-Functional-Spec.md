# FarmFlow — Target Functional Spec

**Date:** 2026-10-01
**Status:** Draft v2: owner decisions from 2026-10-01 applied (see §7)
**Replaces:** the week-based implementation plan as the definition of "complete"

---

## 1. Vision

FarmFlow runs the whole broiler business from one system:

1. **Every rupee is traceable.** Money moves in when birds are sold, and out for purchases, payroll and expenses. Every movement lands in one central **money ledger** and links back to the document that caused it (PO, goods receipt, supplier invoice, sale, payroll run, expense claim).
2. **Every batch has a true cost and a true profit**, both while it's running and after it closes. The cost includes chicks, feed at real mill cost, medicine, vaccines, labour, utilities and overheads.
3. **The feed mill is its own cost centre.** It buys raw materials, produces feed and supplies the farms **at actual mill cost**, so you always know what feed really costs a batch. (Outside feed sales are out of scope.)
4. **People are managed end to end:** hire → attendance/leave → compensation → payroll → payment → ledger.
5. **Work is recorded on-site from a phone**, including offline. The owner sees the position of the business from anywhere.

### Current business shape
- 2 farms/sites (the design must allow more).
- Buy day-old chicks from hatcheries; no breeding.
- Sell live birds; no processing yet.
- The feed mill supplies own farms only. Outside feed sales are **not** in scope.

---

## 2. Design principles (these apply to every module)

| # | Principle | What it means in practice |
|---|---|---|
| P1 | **Single money ledger** | Every money-affecting action automatically posts a ledger transaction (account, amount in/out, **category**, **cost centre**, source document). Nobody types balances by hand. Account balances, cash flow and management P&L all come from this ledger. It's single-entry (cash ledger) for now, but structured so a double-entry GL can be added later without re-capturing data (see §5). |
| P2 | **Source-document traceability** | Every journal line links to its source document, and every document shows its postings. You can drill from P&L → account → journal → document → the person who created and approved it. |
| P3 | **Cost centres everywhere** | Every cost belongs to a cost centre: *Farm (site)*, *Batch*, *Feed Mill*, or *Admin/Head Office*. Batch and mill profitability come from this tagging. |
| P4 | **Documents have a lifecycle** | Draft → Submitted → Approved → Posted → (Reversed/Void). Posted documents are never edited, only reversed. Period locks stop anyone changing closed months. |
| P5 | **Inventory is lot/FIFO-costed** | All stock (feed raw materials, finished feed, medicine, vaccines, litter, consumables) moves through one stock-movement ledger with lot costs. |
| P6 | **Permission-ready** | Every action is a named permission (`module:action`), and every record carries a site/cost centre. That's enough for a later Roles & Permissions module to grant, for example, "Farm Manager — Site A only" with no rework. Roles stay hard-coded until then. |
| P7 | **Mobile-first capture, desktop-first analysis** | Daily farm entry, attendance and petty cash must work on a phone and offline. Finance, reports and setup are optimised for desktop. |
| P8 | **Full audit trail** | Who did what and when, with before/after values, on every create, update, approve, post or reverse. |

---

## 3. Users and their day

| Role | Normal day in FarmFlow |
|---|---|
| **Owner** | Opens the dashboard: cash position by account, live batches (age, mortality, FCR, projected profit), mill output and stock, payables/receivables due, pending approvals. Approves large POs, payments and payroll. Reviews P&L by farm, batch and mill. |
| **Farm Manager** (per site) | Records daily logs per house/cage (mortality with cause, feed used, water, weights, temperature, notes and photos). Follows the vaccination/medication schedule. Requests stock and feed. Records petty-cash spend with receipts. Marks worker attendance. Plans catching and loading for sales. |
| **Feed Mill Staff** | Receives raw materials against POs, runs production batches from recipes, records QC and waste, dispatches feed to farms (and later to external customers), and counts stock. |
| **Accounts** | Supplier invoices and payments, customer receipts and credit, cheques, bank reconciliation, expense entry, payroll payment, period close, financial reports. |
| **Worker** | Mostly offline from the system. At most: see their own attendance/payslip, or check in/out if we enable that later. |
| **System Admin** | Users, master data, settings. Later: roles and permissions. |

---

## 4. Modules and required functionality

Legend for current state (to be confirmed in the gap analysis): **✅ Built** · **🟡 Partial** · **🆕 New**

### 4.1 Farm & Batch Operations
| Capability | State |
|---|---|
| Sites → houses/cages master data, capacity | ✅ |
| Batch lifecycle: planned → placed → growing → catching → closed | 🟡 |
| Chick purchase from hatchery via PO → placement (qty, DOA, chick cost into batch) | 🟡 (`chick_placements` exists) |
| Daily log per house: mortality with **cause**, culls, feed consumed, water, avg weight, temperature/humidity, photos | 🟡 (`daily_records` exists) |
| **Vaccination & medication schedule templates** (e.g. Day 7 ND/IB, Day 14 Gumboro) auto-generated per batch, with due/overdue alerts and a completion record that consumes stock | 🟡 (`vaccinations` exists, no templates) |
| Vet visits: findings, treatment, cost | 🆕 |
| Standard growth curves (breed targets for weight, FCR, mortality by age) with actual vs target | 🆕 |
| Live batch KPIs: age, live birds, mortality %, FCR, ADG, EPEF/PI, feed per bird, cost per bird / per kg so far | 🟡 |
| Batch close-out: final P&L, all KPIs frozen, comparison with previous batches in the same house/site | 🟡 |
| House turnaround: cleaning/disinfection, litter, downtime between batches | 🆕 |
| Farm-level expenses (electricity, gas/brooding fuel, litter, water, repairs), allocated to batches | 🟡 (`operational_expenses`; allocation 🆕) |

### 4.2 Feed Mill
| Capability | State |
|---|---|
| Raw material inventory with lots and FIFO cost | ✅ |
| Recipes: versioned, nutrition targets, cost roll-up, cost optimisation | ✅ |
| Production runs: planned vs actual materials, QC, waste, yield, cost per kg | ✅ |
| Finished-feed stock by feed type (starter/grower/finisher) with lots | 🟡 |
| Dispatch to farms: a delivery note moves finished feed into the farm's stock, and the batch is charged **at actual mill cost** when it consumes | 🟡 (`feed_distributions`) |
| Mill overheads (power, labour, maintenance) absorbed into cost per kg | 🆕 |
| Mill cost report: total spend vs feed produced/dispatched, cost per kg trend | 🟡 |
| Stock counts and variance posting | 🟡 |

### 4.3 Procurement & Inventory (all non-feed stock and all purchasing)
| Capability | State |
|---|---|
| Suppliers (hatchery, raw materials, medicine, equipment, services) with terms and contracts | ✅ |
| Purchase requisition (farm/mill asks) → PO (approval over a threshold) → goods receipt → supplier invoice → payment: a 3-way match | 🟡 (no requisitions; matching partial) |
| Item master: types/categories (medicine, vaccine, litter, consumable, spare part), UoM, reorder levels | ✅ |
| Stock per location (mill store, Farm A store, Farm B store), with transfers between locations | 🟡 |
| Issue/consume stock to batch or cost centre at FIFO cost | ✅ |
| Expiry tracking for medicines and vaccines | 🆕 |
| Service work orders (repairs, contractors) | 🟡 |

### 4.4 Sales & Receivables
| Capability | State |
|---|---|
| Buyers with credit limits and terms | 🟡 |
| Sales order/booking before catching (buyer, expected birds, price/kg, date) | 🆕 |
| Live-bird sale: multiple lorries, empty/loaded weighbridge weights, birds per lorry, price per kg, deductions | ✅ |
| Invoice → receipts (cash/bank/cheque, split lines) → allocation → buyer credit | ✅ |
| Buyer statement / ageing / running ledger | ✅ (ageing 🆕) |
| Cheque received → deposited → cleared/bounced (bounce reverses the posting) | ✅ |
| Revenue tagged to batch and site | 🟡 |
| Other income through the same engine (manure/litter sales, scrap) | 🆕 |

### 4.5 Finance (central money hub)
| Capability | State |
|---|---|
| **Income & expense categories** (e.g. Bird Sales, Chicks, Feed Raw Materials, Medicine, Wages, EPF/ETF, Electricity, Fuel, Repairs), with every ledger line tagged by category and cost centre | 🟡 |
| **Money ledger**: automatic postings from every module, manual entries with approval, reversals instead of edits | 🟡 (treasury ledger exists; categories/cost centres and universal posting to finish) |
| Treasury accounts: bank, current, cash, petty cash; balances derived from postings | ✅ |
| Internal transfers, deposits, withdrawals | ✅ |
| Cheque books and leaves (issue, outstanding, cleared, void) | ✅ |
| Bank reconciliation: book vs cleared balance | 🟡 |
| Accounts payable: supplier invoices, due dates, ageing, payments, allocation | 🟡 |
| Accounts receivable: see Sales | ✅ |
| Petty cash: float to manager → expenses with receipt photo → review → top-up | ✅ |
| General expenses not tied to a PO (utilities, fuel, fees) with cost centre | 🟡 |
| Owner capital in / drawings, loans received and repaid (principal and interest) as ledger categories | 🆕 |
| Fixed assets and depreciation | ⏸ Later (with full GL) |
| Period close and locks | ✅ |
| Budgets per cost centre (optional) | 🆕 |

### 4.6 HR & Payroll
| Capability | State |
|---|---|
| Employee records, documents, bank details, emergency contacts, assigned site/cost centre | ✅ |
| Shifts, attendance (bulk entry by manager), leave types and balances | ✅ |
| Compensation with revisions, recurring allowances/deductions, templates | ✅ |
| Overtime | ✅ |
| **Salary advances and staff loans** with recovery through payroll | 🆕 |
| **EPF / ETF**: employee EPF 8%, employer EPF 12%, employer ETF 3% (rates configurable), monthly contribution report, payment posted to ledger | 🆕 |
| Payroll run: preview → review → approve → pay (posts to ledger by cost centre) | ✅ (GL posting by cost centre 🆕) |
| Payslips (PDF), payroll register, bank transfer list | 🟡 |
| Labour cost allocated to farm/batch/mill via the employee's cost centre | 🆕 |

### 4.7 Reporting & Dashboards
| Report | State |
|---|---|
| Owner dashboard: cash, live batches, approvals, alerts | 🟡 |
| **Batch P&L** (live and closed), batch comparison, house/site performance history | 🟡 |
| **Feed mill cost report**, cost per kg trend, raw material price trend | 🆕 |
| **Cash flow** and **management P&L** (income vs expense by category): by period and cost centre | 🟡 |
| Balance Sheet, Trial Balance | ⏸ Later (with full GL) |
| Payables/receivables ageing, supplier/buyer statements | 🟡 |
| Stock valuation, movement and expiry | 🟡 |
| Payroll and statutory reports | 🟡 |
| Export (CSV/PDF), scheduled email reports | ✅ |

### 4.8 Platform
| Capability | State |
|---|---|
| Auth, users, hard-coded roles with `module:action` permissions | ✅ |
| **Site scoping on records** (ready for per-site permissions) | 🆕 |
| Approvals engine: configurable thresholds (for example POs over Rs. X need owner approval) and an approval inbox | 🆕 |
| Notifications: in-app first; SMS/WhatsApp later (vaccination due, low stock, cheque due, payroll pending) | 🟡 |
| Document numbering series, attachments/photos on any document | 🟡 |
| Audit log | ✅ |
| Offline capture and PWA | ✅ |
| Roles & Permissions admin module | ⏸ Later (the design above keeps it possible) |

---

## 5. The money flows that must be fully traceable

Every ledger line carries: **date · account (bank/cash/petty) · in/out · amount · category · cost centre (site / batch / mill / admin) · source document · created/approved by**.
Non-cash costs (stock consumed, feed dispatched, labour allocated) are tracked in the **cost ledger** (inventory and batch costing). They aren't bank movements, but they tie back to the purchase that paid for them.

```
PURCHASE        Requisition → PO → Goods Receipt (stock + lot cost)
                → Supplier Invoice (payable) → Supplier Payment ──► MONEY OUT  [category from item, cost centre]

FEED MILL       Raw material lots → Production (cost/kg incl. mill overheads)
                → Dispatch to Farm (at mill cost) ──────────────► batch cost (no cash)

FARM / BATCH    Chick PO → Placement ───────────────────────────► batch cost
                Feed / meds / vaccines consumed ────────────────► batch cost
                Utilities, shared labour, overheads ─(bird-days)► batch cost
                Bird sale → Invoice → Receipt ──────────────────► MONEY IN   [Bird Sales, batch]

PEOPLE          Attendance → Payroll (advances, EPF/ETF) → Pay ─► MONEY OUT  [Wages, by employee cost centre]
                EPF/ETF remittance ─────────────────────────────► MONEY OUT  [EPF/ETF]

OTHER           Petty cash, utilities, fuel, repairs, loans, capital, drawings ─► MONEY IN/OUT [category, cost centre]
```

**GL-ready rule:** because every line has a category, cost centre and source document, mapping categories to a chart of accounts later lets double-entry journals be generated from existing data.

---

## 6. Definition of "complete"

The system is complete when:

1. Any rupee in any bank/cash account can be traced back to its source documents, and the Trial Balance balances.
2. A monthly cash flow and management P&L (income vs expense by category) come straight from the system, split by Farm A, Farm B, Feed Mill and Admin. Every account balance reconciles to the bank statement.
3. Every batch (live or closed) shows full cost per bird and per kg, FCR, mortality and profit, compared with target curves and past batches.
4. The feed mill shows its true cost per kg, and every kg dispatched is charged to the receiving batch at that cost.
5. Payroll runs every month with attendance, advances, EPF/ETF and payment, posted by cost centre.
6. Farm managers do all daily entry on their phone, including offline.
7. Every action is permission-named and site-scoped, so a Roles module can be added without rework.

---

## 7. Owner decisions

| # | Decision | Answer (2026-10-01) |
|---|---|---|
| D1 | Accounting depth | **Cash ledger now.** Designed so a full double-entry GL can be added later. |
| D2 | Feed price to farms | **At actual mill cost.** No outside feed sales. |
| D3 | Overhead allocation to batches | **By bird-days per site.** |
| D4 | Statutory / tax | **EPF / ETF on payroll only.** No APIT or VAT/SSCL for now. |

### Still open
- **Approval thresholds:** which actions need owner approval, and above what amount (POs, supplier payments, expenses, payroll)?
- **Anything to drop** from §4?
