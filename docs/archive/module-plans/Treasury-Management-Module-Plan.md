# FarmFlow - Treasury Management Module Plan

**Version:** 0.1
**Date:** March 16, 2026
**Status:** Planned
**Scope:** Functional requirements, operating model, integrations, data design, and implementation roadmap for centralized cash, bank, cheque, and petty cash management

---

## 1. Naming Decision

The current working label `Fund Management` is too broad and too vague. It does not clearly communicate bank accounts, cash movement control, or payment operations.

### Recommended module name

**Treasury Management**

### Recommended user-facing navigation label

**Treasury**

### Why this is the best fit

- It clearly covers bank accounts, current accounts, cheque handling, cash transfers, and petty cash
- It positions this as the central place where money movement is controlled
- It supports transparency without implying a full ERP accounting/general ledger implementation on day one

### Alternative names considered

| Name | Assessment |
|------|------------|
| `Cash & Bank Management` | Clear, but narrower than the actual scope once payroll, supplier payments, petty cash, and reporting are included |
| `Finance Control Center` | Good for dashboards, but too generic for a transactional module |
| `Fund Management` | Too ambiguous and weak for a core finance control module |

---

## 2. Objective

FarmFlow needs a single finance control point where every movement of money is visible, attributable, and reflected in balances.

The **Treasury Management** module should become the source of truth for:

- all bank accounts
- current accounts used for cheque payments
- cash-on-hand and petty cash balances
- incoming money
- outgoing money
- internal transfers between accounts
- cheque issue and clearance status
- finance reporting and audit visibility

This module must integrate with the existing operational modules so that money movement is never tracked in isolation.

---

## 3. Current-State Analysis

FarmFlow already contains some finance-adjacent records, but they are fragmented:

- `sales` now supports buyer-level settlement through `buyer_receipts`, `buyer_receipt_lines`, and `buyer_receipt_allocations`
- `sales` and `buyers` already expose payment summaries, buyer balances, and a buyer ledger
- completed customer money-in events are still tracked only inside the sales settlement model and are not yet posted into treasury accounts
- `payroll` has `paidDate`, but no treasury account, payment instrument, or disbursement tracking
- `purchase_orders` and receiving exist in inventory/feed, but supplier payment is not modeled as a treasury event
- there is no central bank account master
- there is no current account + cheque book workflow
- there is no petty cash allocation and settlement workflow
- there is no shared cash ledger that updates balances across all modules

### Resulting gaps

1. Money can be recorded in different places without a common account balance impact
2. There is no reliable answer to “how much money do we currently have, and where?”
3. There is no clean separation between operational events and actual cash movement
4. Cheque payments cannot be tracked through issued, pending, cleared, voided, or bounced states
5. Petty cash issued to farm managers cannot be controlled or reviewed end-to-end

---

## 4. Target Operating Model

### Core principle

Every real movement of money must create a **Treasury transaction**. That transaction must:

- affect one or more internal finance accounts
- carry a transaction type
- carry a posting status
- link back to the originating business record or records
- preserve an immutable audit trail

### Important design distinction

The system must distinguish between:

- **operational documents**: sales, payroll records, purchase orders, inventory receipts, petty cash requests
- **treasury postings**: the actual money received, paid, transferred, issued, or reversed

Examples:

- creating a purchase order does **not** move money
- receiving stock does **not** automatically move money
- paying a supplier from a bank account **does** move money
- creating a sale does **not** move money
- receiving customer payment into a bank account **does** move money
- approving payroll does **not** move money
- disbursing payroll from a current account **does** move money

### Scope boundary for this phase

This plan focuses on **cash, bank, cheque, petty cash, and payment transparency**.

This plan does **not** require a full general ledger, tax engine, or full accrual accounting implementation in the first phase. The module should, however, be designed so those can be added later without reworking the treasury core.

---

## 5. Core Functional Requirements

### TM-1: Finance account master

The treasury module must maintain all internal accounts where money can reside.

**Functional requirements**

- FR-TM-1.1: Create a finance account master for:
  - bank accounts
  - current accounts
  - cash accounts
  - petty cash accounts
  - clearing accounts if needed later
- FR-TM-1.2: Each account must store:
  - account name
  - account code
  - account type
  - bank name
  - branch
  - account number or masked account number
  - currency
  - opening balance
  - opening balance date
  - active/inactive status
  - site or farm ownership where relevant
  - whether cheque issuance is allowed
- FR-TM-1.3: Current balance must be derived from posted treasury entries, not manually typed after setup
- FR-TM-1.4: The account list must show book balance and, where reconciliation exists, cleared balance
- FR-TM-1.5: The system must support multiple bank accounts and multiple petty cash holders

**Business rules**

- BR-TM-1.1: Only active accounts can receive new transactions
- BR-TM-1.2: An account marked `allowsCheque = true` must be of type `current`
- BR-TM-1.3: A petty cash account belongs to a responsible holder or site and cannot be unowned

---

### TM-2: Central treasury transaction ledger

All money movement must be posted through a shared transaction engine.

**Functional requirements**

- FR-TM-2.1: Create a treasury transaction header containing:
  - transaction code
  - transaction type
  - transaction date
  - status
  - narrative/notes
  - counterparty type and ID where applicable
  - created by / approved by / posted by
- FR-TM-2.2: Create treasury transaction entries to record account-level effects
- FR-TM-2.3: Support these transaction types at minimum:
  - customer receipt
  - supplier payment
  - payroll disbursement
  - petty cash allocation
  - petty cash expense
  - internal transfer
  - cheque issue
  - cheque clearance
  - cheque bounce/reversal
  - manual adjustment
  - opening balance
- FR-TM-2.4: Every transaction must support one or more source links back to business records
- FR-TM-2.5: Transactions must support attachments, reference numbers, and notes
- FR-TM-2.6: Transactions must show lifecycle statuses such as `draft`, `pending_approval`, `posted`, `cleared`, `cancelled`, `reversed`
- FR-TM-2.7: Posted transactions must update account balances immediately
- FR-TM-2.8: Reversals must create offsetting records, not destructive edits

**Business rules**

- BR-TM-2.1: No money movement may exist in sales, payroll, procurement, or petty cash without a treasury link once the integration is enabled
- BR-TM-2.2: Posted transactions are immutable except through reversal
- BR-TM-2.3: Internal transfers must always create two entries: one outflow and one inflow

---

### TM-3: Sales and customer receipt integration

Sales collections must flow into treasury so inflows are reflected by account.

**Functional requirements**

- FR-TM-3.1: Customer payments recorded against sales must require a target treasury account
- FR-TM-3.2: When a completed buyer receipt line is posted, the system must create a treasury transaction of type `customer_receipt`
- FR-TM-3.3: One receipt may be linked to one sale or allocated across multiple sales if partial settlement is needed later
- FR-TM-3.4: Payment method must determine workflow:
  - cash: posted directly into a cash account
  - bank transfer: posted into a bank/current account
  - cheque: posted as cheque received with pending clearance flow
- FR-TM-3.5: Sales and buyer receipt screens must show treasury posting status and receiving account
- FR-TM-3.6: Treasury transaction detail must show linked buyer, receipt code, and sale allocations

**Business rules**

- BR-TM-3.1: A completed customer receipt must always point to an internal account
- BR-TM-3.2: A cheque receipt should not be treated as cleared bank money until deposited/cleared

---

### TM-4: Procurement and supplier payment integration

Procurement must connect operational purchasing with actual cash outflow.

**Functional requirements**

- FR-TM-4.1: Add supplier payment capability linked to purchase orders, receipts, or supplier invoice references
- FR-TM-4.2: A supplier payment must create a treasury transaction of type `supplier_payment`
- FR-TM-4.3: Supplier payments must support:
  - cash
  - bank transfer
  - cheque
- FR-TM-4.4: Supplier payment detail must display linked supplier, linked PO or receipt references, payment account, instrument, and status
- FR-TM-4.5: Inventory and purchase order screens must display payment status summary such as `unpaid`, `partially_paid`, `paid`
- FR-TM-4.6: Treasury must provide a payable-style view showing upcoming and completed supplier payments

**Business rules**

- BR-TM-4.1: Purchase order creation and goods receipt do not change cash balances on their own
- BR-TM-4.2: A posted supplier payment must reduce the selected internal account immediately
- BR-TM-4.3: If cheque is used, the transaction stays outstanding until cleared or voided

---

### TM-5: Payroll disbursement integration

Payroll approval and payroll payment must become separate tracked steps.

**Functional requirements**

- FR-TM-5.1: Approved payroll records must be payable through treasury
- FR-TM-5.2: Support payroll disbursement by:
  - bank transfer
  - cheque
  - cash
- FR-TM-5.3: Payroll disbursement may pay one employee record or a payroll batch
- FR-TM-5.4: A payroll payment must create a treasury transaction of type `payroll_disbursement`
- FR-TM-5.5: Payroll detail must show payment status, paid account, payment date, and treasury reference
- FR-TM-5.6: Treasury must support export/reporting of payroll disbursement runs by period

**Business rules**

- BR-TM-5.1: `paidDate` on payroll should only be set when the treasury posting is successful
- BR-TM-5.2: A payroll record cannot be marked paid without a linked treasury transaction

---

### TM-6: Petty cash allocation, claims, and review

Petty cash must be controlled as a formal workflow, not an informal note.

**Functional requirements**

- FR-TM-6.1: Allow creation of petty cash accounts per farm manager, site, or operational unit
- FR-TM-6.2: Admin/accountant can allocate petty cash from a central cash/current/bank account into a petty cash account
- FR-TM-6.3: Allocation must create a treasury transaction of type `petty_cash_allocation`
- FR-TM-6.4: Farm managers must be able to submit petty cash expense claims with:
  - expense date
  - payee/supplier
  - amount
  - category
  - justification
  - notes
  - attachments or proof
  - optional link to batch, site, or inventory-related activity
- FR-TM-6.5: Petty cash expense claims must support statuses:
  - draft
  - submitted
  - under_review
  - approved
  - rejected
  - settled
- FR-TM-6.6: On approval, the system must post a treasury transaction of type `petty_cash_expense` against the manager’s petty cash account
- FR-TM-6.7: If unspent money is returned, the system must post an internal transfer back to the central account
- FR-TM-6.8: Admin must have a review screen showing:
  - outstanding petty cash by holder
  - submitted claims
  - supporting evidence
  - approved vs rejected claims
  - unreconciled balances

**Business rules**

- BR-TM-6.1: Petty cash allocation is an internal transfer, not an expense
- BR-TM-6.2: Petty cash becomes an expense only when a justified claim is approved and posted
- BR-TM-6.3: A petty cash expense must not exceed the available petty cash account balance

---

### TM-7: Cheque book and cheque lifecycle management

Current accounts must support cheque issue tracking.

**Functional requirements**

- FR-TM-7.1: Maintain cheque books by current account
- FR-TM-7.2: Track individual cheque leaves with:
  - cheque number
  - cheque book
  - issue date
  - payee
  - amount
  - linked treasury transaction
  - status
- FR-TM-7.3: Support cheque statuses:
  - available
  - issued
  - presented
  - cleared
  - bounced
  - voided
- FR-TM-7.4: Supplier payments and payroll disbursements by cheque must reserve and use a specific cheque number
- FR-TM-7.5: Treasury overview must show outstanding issued cheques not yet cleared
- FR-TM-7.6: Cleared cheque events must update cleared balances and cheque status

**Business rules**

- BR-TM-7.1: Only current accounts can own cheque books
- BR-TM-7.2: A cheque number cannot be reused
- BR-TM-7.3: Voiding a cheque requires a reason and must not silently delete records

---

### TM-8: Internal transfers and manual adjustments

The treasury module must also control non-module-specific money movement.

**Functional requirements**

- FR-TM-8.1: Support transfer between any two eligible internal accounts
- FR-TM-8.2: Support opening balance postings during account onboarding
- FR-TM-8.3: Support manual adjustments with approval and mandatory reason
- FR-TM-8.4: Manual adjustments must be separately reportable from normal business transactions

**Business rules**

- BR-TM-8.1: Manual adjustments require elevated permission
- BR-TM-8.2: Every adjustment must have a reason, approver, and audit trail

---

### TM-9: Reconciliation and audit transparency

The system must support finance confidence, not just transaction capture.

**Functional requirements**

- FR-TM-9.1: Support period-based account reconciliation
- FR-TM-9.2: Reconciliation must capture statement closing balance and cleared transaction set
- FR-TM-9.3: Treasury transactions must be filterable by:
  - account
  - date range
  - transaction type
  - source module
  - source document
  - counterparty
  - status
- FR-TM-9.4: Every transaction detail page must show full source traceability
- FR-TM-9.5: Account statement view must behave like a cash/bank ledger

**Business rules**

- BR-TM-9.1: Reconciliation cannot modify historical transaction amounts
- BR-TM-9.2: Reconciliation differences must remain visible until resolved

---

### TM-10: Reporting

Treasury must provide complete overview reporting for cash transparency.

**Required reports**

- FR-TM-10.1: Cash position by account
- FR-TM-10.2: Daily cash book
- FR-TM-10.3: Bank ledger / account statement
- FR-TM-10.4: Inflows vs outflows by period
- FR-TM-10.5: Inflows vs outflows by module source
- FR-TM-10.6: Supplier payment report
- FR-TM-10.7: Customer receipt report
- FR-TM-10.8: Payroll disbursement report
- FR-TM-10.9: Outstanding cheque report
- FR-TM-10.10: Petty cash outstanding and settlement report
- FR-TM-10.11: Unreconciled transaction report

**Business rules**

- BR-TM-10.1: All treasury reports must drill down to transaction detail
- BR-TM-10.2: Reports must always display the linked source module/document where applicable

---

## 6. Data Model Design

### Recommended architectural choice

Use an **immutable treasury ledger design** rather than storing balances as manually maintained fields.

This should be implemented with:

1. a transaction header table
2. transaction entry rows that affect internal accounts
3. source-link rows that connect the transaction to business documents

This design is stronger than a single `cash_movements` table because it handles:

- internal transfers cleanly
- multi-document settlements
- cheque lifecycle events
- future reconciliation and accounting extensions

### New tables

| Table | Purpose |
|-------|---------|
| `finance_accounts` | Bank, current, cash, petty cash, and future clearing accounts |
| `treasury_transactions` | Header for each money movement event |
| `treasury_transaction_entries` | Account-level debit/credit style balance effects |
| `treasury_transaction_links` | Links treasury events to sales, payroll, PO, petty cash claims, or manual references |
| `cheque_books` | Cheque books owned by current accounts |
| `cheque_leaves` | Individual cheque numbers and lifecycle status |
| `petty_cash_claims` | Petty cash claim header |
| `petty_cash_claim_lines` | Detailed petty cash expense lines |
| `account_reconciliations` | Reconciliation period header by account |
| `account_reconciliation_items` | Cleared/unmatched treasury entries for a reconciliation |

### Modified existing tables

| Table | Change |
|-------|--------|
| `payments` | Add treasury linkage and receiving account reference |
| `payroll` | Replace `paidDate` as a standalone concept with treasury-linked disbursement state |
| `purchase_orders` or related procurement payment records | Add payment summary/linked treasury references |

### Recommended field concepts

#### `finance_accounts`

- `id`
- `accountCode`
- `accountName`
- `accountType`
- `bankName`
- `branchName`
- `accountNumberMasked`
- `currencyCode`
- `siteId` or site reference if applicable
- `responsibleEmployeeId` for petty cash holder accounts
- `allowsCheque`
- `openingBalance`
- `openingBalanceDate`
- `status`
- timestamps

#### `treasury_transactions`

- `id`
- `transactionCode`
- `transactionType`
- `transactionDate`
- `status`
- `referenceNumber`
- `counterpartyType`
- `counterpartyId`
- `counterpartyNameSnapshot`
- `narrative`
- `sourceModule`
- `createdBy`
- `approvedBy`
- `postedBy`
- timestamps

#### `treasury_transaction_entries`

- `id`
- `treasuryTransactionId`
- `financeAccountId`
- `entryDirection` (`inflow` / `outflow`)
- `amount`
- `valueDate`
- `clearedAt`
- `runningBalanceSnapshot` optional if later materialized
- `notes`

#### `treasury_transaction_links`

- `id`
- `treasuryTransactionId`
- `sourceModule`
- `sourceEntityType`
- `sourceEntityId`
- `sourceCodeSnapshot`
- `allocatedAmount`

### Performance note

Balances should be **derived from posted entries**, but it is acceptable to maintain a materialized balance summary table or cached projection for dashboard performance, as long as the transaction ledger remains the source of truth.

---

## 7. Integration Design

### Sales integration

Sales now captures customer money-in through buyer receipts and receipt lines, with optional allocation to sales. Treasury should build on that model rather than on the older one-payment-per-sale concept.

**Implementation direction**

- keep buyer receipts and receipt lines as the settlement record
- require treasury account selection when creating or posting a completed receipt line
- create linked treasury transaction automatically
- show treasury reference back on buyer detail, receipt detail, and sale detail
- keep cheque receipt lines pending in treasury until cleared

### Payroll integration

Current payroll records contain `paidDate` but not a real disbursement trail.

**Implementation direction**

- keep payroll as the earning/liability record
- create payroll disbursement posting via treasury
- update payroll UI to show `unpaid`, `partially_paid`, `paid` from treasury-linked disbursement state

### Procurement / inventory integration

Current purchase orders and receipts are operational and inventory-focused.

**Implementation direction**

- keep PO and receiving in inventory
- add supplier payment record and treasury posting
- expose payment summary in PO detail and supplier history

### Petty cash integration

Petty cash should live primarily in treasury, but claims may optionally link to:

- site
- batch
- inventory item
- operational category

This allows admin to review why money was used and where the expense belongs operationally.

---

## 8. API Surface

### Account management

- `GET /api/treasury/accounts`
- `GET /api/treasury/accounts/:id`
- `POST /api/treasury/accounts`
- `PUT /api/treasury/accounts/:id`
- `GET /api/treasury/accounts/:id/statement`

### Treasury transactions

- `GET /api/treasury/transactions`
- `GET /api/treasury/transactions/:id`
- `POST /api/treasury/transactions`
- `POST /api/treasury/transactions/:id/approve`
- `POST /api/treasury/transactions/:id/post`
- `POST /api/treasury/transactions/:id/reverse`

### Internal transfers

- `POST /api/treasury/transfers`

### Cheques

- `GET /api/treasury/cheque-books`
- `POST /api/treasury/cheque-books`
- `GET /api/treasury/cheques`
- `POST /api/treasury/cheques/:id/present`
- `POST /api/treasury/cheques/:id/clear`
- `POST /api/treasury/cheques/:id/bounce`
- `POST /api/treasury/cheques/:id/void`

### Petty cash

- `GET /api/treasury/petty-cash/accounts`
- `POST /api/treasury/petty-cash/allocations`
- `GET /api/treasury/petty-cash/claims`
- `POST /api/treasury/petty-cash/claims`
- `PUT /api/treasury/petty-cash/claims/:id`
- `POST /api/treasury/petty-cash/claims/:id/submit`
- `POST /api/treasury/petty-cash/claims/:id/approve`
- `POST /api/treasury/petty-cash/claims/:id/reject`
- `POST /api/treasury/petty-cash/returns`

### Reconciliation

- `GET /api/treasury/reconciliations`
- `POST /api/treasury/reconciliations`
- `GET /api/treasury/reconciliations/:id`
- `POST /api/treasury/reconciliations/:id/close`

### Reports

- `GET /api/reports/treasury/cash-position`
- `GET /api/reports/treasury/cash-book`
- `GET /api/reports/treasury/account-ledger`
- `GET /api/reports/treasury/inflow-outflow`
- `GET /api/reports/treasury/cheques-outstanding`
- `GET /api/reports/treasury/petty-cash-summary`

---

## 9. UX and Navigation

### Navigation recommendation

Add a new top-level navigation entry:

- `Treasury`

This keeps the module easy to find and makes the financial source of truth explicit.

### Recommended Treasury page structure

Tabs:

- `Overview`
- `Accounts`
- `Transactions`
- `Cheques`
- `Petty Cash`
- `Reconciliation`
- `Reports`

### Key UX behaviors

- account cards show current balance, cleared balance, and recent movement
- transaction detail shows source links back to sales, payroll, PO, or petty cash
- sale, payroll, and purchase order detail pages show treasury status badges and clickable treasury references
- petty cash review page highlights overdue claims and unreconciled holders
- cheque views clearly separate issued vs cleared vs bounced vs voided

---

## 10. Permissions and Control Model

Recommended new permission set:

- `treasury:read`
- `treasury:accounts:manage`
- `treasury:transactions:create`
- `treasury:transactions:approve`
- `treasury:transactions:post`
- `treasury:reconcile`
- `treasury:petty_cash:submit`
- `treasury:petty_cash:review`
- `treasury:reports:read`

### Role direction

- `system_admin`: full treasury access
- `accountant`: full treasury transaction and reporting access
- `farm_manager`: petty cash submission, petty cash visibility for owned accounts, limited treasury read where approved
- `viewer`: report-only access if needed

---

## 11. Implementation Roadmap

### Phase 1: Treasury foundation

**Goal:** establish accounts, ledger, transfers, and manual transactions.

Deliver:

- `finance_accounts`
- `treasury_transactions`
- `treasury_transaction_entries`
- `treasury_transaction_links`
- Treasury page, navigation, permissions
- account statement and balance views
- internal transfers
- manual receipt/payment/adjustment posting

### Phase 2: Operational integrations

**Goal:** make treasury the source of truth for real inflows and outflows from core modules.

Deliver:

- sales payment to treasury integration
- payroll disbursement to treasury integration
- supplier payment to treasury integration
- treasury status badges on sales, payroll, and PO detail

### Phase 3: Petty cash and cheque control

**Goal:** formalize the highest-risk manual cash processes.

Deliver:

- petty cash account setup
- petty cash allocation workflow
- petty cash claims, approvals, returns, and review
- cheque books, cheque leaves, cheque lifecycle status

### Phase 4: Reconciliation and reporting

**Goal:** complete transparency and finance control.

Deliver:

- reconciliation workflow
- outstanding cheque reporting
- cash position dashboards
- inflow/outflow analysis
- module-level treasury drill-down reporting

---

## 12. Codebase Implementation Notes

### Backend

- Add new schema file: `packages/backend/src/db/schema/treasury.ts`
- Export treasury schema from `packages/backend/src/db/schema/index.ts`
- Add treasury routes under `packages/backend/src/routes/treasury.ts`
- Extend:
  - `packages/backend/src/routes/sales.ts`
  - `packages/backend/src/routes/payroll.ts`
  - procurement/payment routes when added or expanded from inventory
- Extend permissions in `packages/backend/src/lib/permissions.ts`

### Shared types

- Add new shared types file: `packages/shared/src/types/treasury.ts`
- Export from `packages/shared/src/types/index.ts`

### Frontend

- Add Treasury page and route
- Add Treasury hooks in `packages/frontend/src/hooks`
- Add validations in `packages/frontend/src/lib/validations`
- Add navigation entry in `packages/frontend/src/config/navigation.ts`
- Add integration badges/components in sales, payroll, and inventory/procurement detail screens

---

## 13. Acceptance Criteria

- [ ] Treasury module exists as a separate navigable module
- [ ] Multiple bank/current/cash/petty cash accounts can be created and managed
- [ ] Account balances update from treasury postings, not manual edits
- [ ] Sales receipts post to treasury and reflect on selected accounts
- [ ] Supplier payments post to treasury and reflect on selected accounts
- [ ] Payroll payments post to treasury and reflect on selected accounts
- [ ] Petty cash can be allocated to farm managers and reviewed with justification and proof
- [ ] Current accounts support cheque issue and cheque status tracking
- [ ] Internal transfers between accounts are supported
- [ ] Treasury reports provide a complete inflow/outflow and balance overview
- [ ] Every posted money movement is traceable back to its source document

---

## 14. Recommended First Build Slice

To reduce implementation risk, the first production slice should be:

1. Treasury account master
2. Central ledger tables and transaction posting
3. Sales receipt integration from buyer receipt lines into treasury
4. Manual receipt/payment/transfer flows
5. Basic cash position and account statement reports

This gives immediate visibility into where money sits, starts with a live money-in workflow that already exists in sales, and proves the ledger design before payroll, supplier payment, petty cash, cheque lifecycle, and reconciliation are layered on top.
