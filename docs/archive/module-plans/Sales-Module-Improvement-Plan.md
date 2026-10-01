# FarmFlow - Sales Module Improvement Plan

**Version:** 0.2
**Date:** March 16, 2026
**Status:** In Progress
**Scope:** Functional requirements, data model, UX flow, and implementation roadmap for batch sales, buyer settlements, and running balances

---

## 1. Objective

FarmFlow's current sales module supports:

- buyers
- sale headers with aggregate birds and weight
- payments linked directly to one sale

The next phase must support operational batch dispatch and buyer receivables properly:

- one sale can contain multiple lorries
- sale totals must be compiled from lorry lines
- one buyer payment session can contain multiple lines and multiple methods
- buyer payments may exceed the current sale and create carry-forward credit
- buyer detail must show running sales, running payments, and current outstanding or advance balance

### March 16, 2026 implementation update

The sales settlement redesign is already partially implemented in the live codebase:

- `sale_lorries` exists and sale create/edit flows compile totals from lorry lines
- buyer-level receipts exist through:
  - `buyer_receipts`
  - `buyer_receipt_lines`
  - `buyer_receipt_allocations`
- buyer list and buyer detail already expose balance summaries
- buyer detail already exposes a chronological settlement ledger
- `POST /api/sales/:saleId/payments` already routes through the buyer receipt service

The main remaining gap is that these money-in flows are still tracked only inside sales/buyer settlement logic. They are not yet linked to treasury accounts or a central cash/bank ledger.

---

## 2. Current Gaps

Based on the current repository state, the remaining gaps are:

- buyer receipts capture collections, but they do not yet require a treasury account
- completed receipts update buyer balances, but they do not yet update a central cash/bank position
- cheque receipt status is handled in sales, but cheque custody and clearance are not yet tied to treasury
- the legacy `payments` table still exists and remains part of compatibility/read models
- buyer credit is calculated from sales-ledger data, but the finance side still has no central inflow ledger

The sales receivables model now supports buyer-level carry-forward credit and lorry-wise sale accounting, but it is not yet connected to the broader treasury model.

---

## 3. Target Operating Model

### Sale capture

- A batch sale is recorded against one buyer
- Each sale contains one or more lorry lines
- Each lorry line captures birds and weighing information
- Sale totals are derived from the lorry lines and stored on the sale header as a snapshot

### Buyer settlement

- Payments are received from a buyer, not only from a single sale
- One receipt can contain multiple payment lines using different methods
- Receipt amounts can be allocated to one sale, multiple sales, or remain as unapplied buyer credit
- Buyer credit carries forward automatically to future sales until consumed

### Buyer visibility

- Every buyer has a running receivables position
- Users can see total sales, total receipts, unapplied credit, and net outstanding
- Buyer detail shows a chronological ledger of sales, receipts, allocations, reversals, and current running balance

---

## 4. Core Functional Requirements

### IMP-SALES-1: Multi-lorry sale detail

- FR-SALES-1.1: Add child lorry records under each sale
- FR-SALES-1.2: A sale must allow one or more lorry lines
- FR-SALES-1.3: Each lorry line must capture at minimum:
  - lorry identifier or registration
  - line sequence
  - number of birds
  - previous lorry weight
  - after-load lorry weight
  - net bird weight
  - notes
- FR-SALES-1.4: Net bird weight defaults to `afterWeight - previousWeight`
- FR-SALES-1.5: Sale totals must be auto-compiled from lorry totals:
  - total birds
  - total net weight
  - total amount
- FR-SALES-1.6: Sale detail must show both per-lorry figures and compiled sale totals
- FR-SALES-1.7: Sale create and edit flows must validate that lorry totals are internally consistent before save

### IMP-SALES-2: Flexible payment capture

- FR-SALES-2.1: Payment entry must support multiple lines in one receipt action
- FR-SALES-2.2: Each payment line must support one payment method and one amount
- FR-SALES-2.3: Multiple payment lines with different methods must be allowed against the same buyer receipt
- FR-SALES-2.4: Supported methods for this phase remain:
  - cash
  - cheque
  - bank transfer
- FR-SALES-2.5: Payment lines must retain method-specific metadata such as cheque number, cheque date, bank name, or reference note where relevant
- FR-SALES-2.6: Sale detail must allow recording a receipt that is pre-linked to that sale but still belongs to the buyer ledger
- FR-SALES-2.7: Existing direct sale-payment behavior should be replaced or wrapped so all new payments flow through the buyer receipt model

### IMP-SALES-3: Buyer overpayment and carry-forward credit

- FR-SALES-3.1: The system must allow receipts that exceed a sale's current outstanding amount
- FR-SALES-3.2: Excess received amount must be stored as buyer advance credit
- FR-SALES-3.3: Buyer advance credit must remain available for future sales
- FR-SALES-3.4: When a new sale is created for a buyer with available credit, the system must show the carry-forward amount and allow it to be applied
- FR-SALES-3.5: Buyer-level outstanding or credit must be visible in:
  - buyer list
  - buyer detail
  - sale detail
  - sales table where relevant
- FR-SALES-3.6: Cheque receipts must affect buyer credit only after clearing; bounced cheques must reverse the credited amount

### IMP-SALES-4: Buyer ledger and detailed page

- FR-SALES-4.1: Add a buyer detail page focused on settlements and receivables
- FR-SALES-4.2: Buyer detail must show summary values for:
  - total sales billed
  - total receipts completed
  - unapplied credit
  - net outstanding balance
- FR-SALES-4.3: Buyer detail must show a chronological running ledger containing:
  - sales invoices
  - receipts
  - allocations
  - reversals or bounced payments
  - manual adjustments if enabled later
- FR-SALES-4.4: Each ledger row must show the running balance after the transaction
- FR-SALES-4.5: Buyer detail must provide drill-down links to sale detail and receipt detail

### IMP-SALES-5: Sale and buyer status visibility

- FR-SALES-5.1: Sale records must distinguish operational sale status from settlement status
- FR-SALES-5.2: Settlement status should support at least:
  - unpaid
  - partially_paid
  - paid
  - credit_balance
- FR-SALES-5.3: Buyer list must expose whether the buyer is in debit or credit position
- FR-SALES-5.4: Table-level badges and totals must reflect the latest computed balances

---

## 5. Business Rules

- BR-SALES-1: Sale header totals are derived from lorry lines; users should not key arbitrary totals once lorry lines exist
- BR-SALES-2: Lorry net weight must be positive
- BR-SALES-3: Sum of lorry birds sold cannot exceed the batch's available birds for sale
- BR-SALES-4: Sum of lorry net weight is the sale's chargeable weight unless an approved adjustment workflow is added later
- BR-SALES-5: Receipts belong to a buyer ledger first, then allocations apply them to sales
- BR-SALES-6: Overpayment is not rejected; it becomes buyer credit
- BR-SALES-7: Only completed cash or bank-transfer lines and cleared cheques affect buyer balances
- BR-SALES-8: A bounced cheque must reverse any prior completed credit and recalculate affected sales
- BR-SALES-9: A sale's outstanding balance equals sale amount minus applied credit or receipts
- BR-SALES-10: Cancelling a sale with allocations must require unallocation or system-generated reversal entries

---

## 6. Data Model Changes

### New tables

| Table | Purpose |
|-------|---------|
| `sale_lorries` | Lorry-wise dispatch lines under a sale |
| `buyer_receipts` | Buyer payment header for one receipt event |
| `buyer_receipt_lines` | Multi-method payment lines under one receipt |
| `buyer_receipt_allocations` | Amount applied from a receipt line to one sale |
| `buyer_ledger_entries` | Running buyer receivables ledger for sales, receipts, reversals, and adjustments |

### Modified tables

| Table | Change |
|-------|--------|
| `sales` | Keep buyer and batch references; store compiled totals, settlement status, applied credit, outstanding balance, and optional summary snapshot fields |
| `buyers` | Add cached balance fields only if needed for performance; ledger remains source of truth |
| `payments` | Retire from direct use or migrate into the buyer receipt model |

### Recommended modeling note

The current `payments.saleId NOT NULL` design is too restrictive for buyer-level carry-forward credit. The preferred direction is:

- treat the current `payments` table as legacy
- introduce buyer receipts plus receipt allocations
- calculate sale settlement from allocations rather than raw payment rows

That structure supports:

- multi-line mixed-method receipts
- unapplied buyer credit
- future-sale carry-forward
- auditable reversal handling

---

## 7. API Changes

### Sales

- `GET /api/sales`
  - includes compiled sale totals, settlement status, paid amount, outstanding amount, and buyer balance summary
- `GET /api/sales/:id`
  - includes lorry lines, payment and receipt summary, and outstanding amount
- `POST /api/sales`
  - accepts lorry lines and derives totals
- `PUT /api/sales/:id`
  - supports editing lorry lines and sale notes while enforcing compiled totals

### Buyer receipts

- `POST /api/buyers/:id/receipts`
  - creates one receipt with multiple payment lines
- `POST /api/sales/:saleId/payments`
  - creates a buyer receipt and auto-allocates it to the selected sale
- `PUT /api/payments/:id`
  - updates payment status for legacy payments and new receipt lines
- buyer detail endpoints already expose receipts and ledger data derived from the new receipt model

### Buyers

- `GET /api/buyers`
  - include outstanding, advance credit, and net balance columns
- `GET /api/buyers/:id`
  - return buyer summary, sales summary, receipts summary, and running ledger
- `GET /api/buyers/:id/ledger`
  - return chronological ledger with running balance

### Compatibility note

`POST /api/sales/:saleId/payments` is now effectively a compatibility write path that already calls the buyer receipt service internally. The next compatibility step is treasury integration, followed by eventual retirement of legacy direct-payment handling.

---

## 8. UX Notes

### Sales detail page

- Header summary with buyer, batch, sale date, settlement status, outstanding, and available buyer credit
- `Lorries` section with line entry grid and compiled totals footer
- `Receipts` section showing applied receipts and quick add receipt action
- `Balance` section showing sale total, applied amount, outstanding, and any buyer advance remaining

### Buyer list page

- Columns for buyer name, credit terms, total sales, total received, outstanding, advance credit, and net balance
- Quick visual distinction between buyers who owe the farm and buyers with prepaid balances

### Buyer detail page

- Summary cards for billed, received, credit, and outstanding
- Tabs or stacked sections for `Ledger`, `Sales`, and `Receipts`
- Ledger should show running balance after each transaction

---

## 9. Reporting Impact

- Sales summary reports must distinguish:
  - invoiced sales
  - received cash
  - unapplied buyer credit
  - outstanding receivables
- Buyer statement export should become possible from the buyer ledger
- Batch sale reports must support lorry-level drill-down

---

## 10. Implementation Phases

### Phase 1: Data foundation

- add sale lorry table
- add buyer receipt, receipt line, allocation, and ledger tables
- add settlement fields to sale responses

Status: substantially implemented

### Phase 2: Backend behavior

- update sale create and detail flows for lorry lines
- replace direct sale payment logic with buyer receipt allocation logic
- implement running balance recalculation services

Status: substantially implemented, with legacy payment compatibility still present

### Phase 3: Frontend workflows

- add lorry grid to sale detail
- add multi-line receipt dialog
- add buyer detail page and buyer balance columns

Status: substantially implemented

### Phase 4: Migration, treasury integration, and cleanup

- migrate existing payment history into buyer receipts and allocations where possible
- link completed buyer receipt lines into treasury inflow postings
- deprecate legacy direct-payment entry points
- extend tests and reports for the new settlement model

---

## 11. Validation and Test Focus

- sale totals compile correctly from multiple lorries
- overpayments create buyer credit instead of failing validation
- next sale can consume prior buyer credit
- mixed-method receipts post correctly
- cheque pending, clearance, and bounce flows recalculate balances correctly
- buyer ledger running balance remains consistent after edits or reversals
