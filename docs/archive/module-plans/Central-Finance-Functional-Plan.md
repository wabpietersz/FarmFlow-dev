# FarmFlow - Central Finance Functional Plan

**Version:** 1.0  
**Date:** April 4, 2026  
**Status:** Active planning document based on current repository audit  
**Recommended module name:** **Treasury**  
**Secondary internal description:** Central finance and cash-control layer

---

## 1. Naming Recommendation

`Fund Management` is too broad and too weak for what this module needs to do.

### Recommended module name

**Treasury**

### Why this name fits

- It clearly covers banks, current accounts, cash, petty cash, transfers, receipts, and disbursements
- It positions the module as the source of truth for money movement, not only reporting
- It works well with the current codebase, which already uses `treasury` as the backend and UI naming

### Optional user-facing subtitle

**Treasury**
Cash, Bank, Payroll, and Petty Cash Control

---

## 2. Business Objective

FarmFlow needs one place where the business can answer:

- how much money is available right now
- where that money sits
- what money has been received
- what money has been paid out
- what money is delegated as petty cash
- which operational transaction caused each money movement

This module must become the finance control layer for operational modules, while keeping the first phase lighter than a full accounting ERP.

---

## 3. Current Solution Status

The repository already contains partial implementation for this direction.

### 3.1 Already implemented

- Treasury account master exists for `bank`, `current`, `cash`, and `petty_cash`
- Treasury transaction ledger exists with transaction headers, entries, and source links
- Treasury UI page exists and is wired into navigation
- Payroll can already be marked paid against a treasury account, and this creates a treasury outflow
- Petty cash allocation and petty cash expense submission/review flows already exist
- Batch sales already support:
  - multi-lorry sale capture
  - auto-compiled sale totals
  - buyer-level receipts
  - multiple receipt lines and mixed payment methods
  - buyer overpayment carried as credit
  - buyer detail page with running ledger and balances

### 3.2 Partially implemented

- Sales receipt posting into treasury exists in schema, service, route, and UI design
- Buyer receipt lines carry `financeAccountId` and `treasuryTransactionId`
- Payment status changes can reverse treasury postings for bounced receipt lines
- Treasury overview shows sales, payroll, manual treasury, and petty cash activity

### 3.3 Not yet implemented end-to-end

- Purchase order and supplier payment integration into treasury
- Cheque book / cheque leaf lifecycle for current accounts
- Finance reports driven from treasury as the source of truth
- Reconciliation and cleared-balance workflows
- Universal enforcement that every money movement must create a treasury posting

### 3.4 Important implementation gap found in the audit

Sales and buyer receipt routes expect `financeAccountId`, but the backend payment validator does not currently accept that field.  
This means the treasury linkage for buyer receipts is designed in the codebase, but may not work reliably through validated API requests until that validator is corrected.

---

## 4. Recommended Functional Scope

### Phase 1 scope

- finance account master
- central treasury transaction ledger
- sales receipt integration
- payroll disbursement integration
- petty cash allocation and expense review
- manual cash/bank adjustments and internal transfers
- finance overview and drill-down reporting

### Phase 2 scope

- supplier payment integration from purchase orders / inventory receiving
- cheque issuance and cheque clearance workflow
- richer counterparty history
- bank reconciliation and cleared balances

### Out of scope for now

- full general ledger
- tax engine
- accrual accounting
- full accounts payable / accounts receivable subledger redesign beyond operational settlement already implemented

---

## 5. Target Operating Model

### Core rule

Every real money movement must create a treasury transaction.

### Separation of responsibilities

- operational modules create business obligations or claims
- treasury records actual money movement

Examples:

- creating a sale does not move money
- receiving a buyer payment does move money
- approving payroll does not move money
- paying payroll does move money
- creating a purchase order does not move money
- paying a supplier does move money

---

## 6. Integration Map

### Sales

Target behavior:

- buyer receipts must post to a selected treasury account
- sale detail must show receipt status, account, and treasury reference
- overpayments remain buyer credit and still appear as treasury inflow

Current status:

- buyer receipts, allocations, overpayments, and ledgers are implemented
- treasury posting logic exists
- validation gap must be fixed to make account-linked receipt posting reliable
- financial reports still use legacy `payments` reads in some places

### Payroll

Target behavior:

- a payroll record becomes paid only through treasury posting
- the paying account must be selected
- payroll detail should show treasury reference

Current status:

- implemented and connected

### Purchase Orders / Supplier Payments

Target behavior:

- purchase order and goods receipt remain operational records
- supplier payment becomes a treasury outflow linked back to PO, supplier, and receipt references

Current status:

- purchase order flows exist
- supplier payment treasury integration is missing

### Petty Cash

Target behavior:

- treasury allocates money to a manager/site petty cash account
- manager submits expenses with justification
- admin reviews and approves or rejects
- approved expenses reduce petty cash balance and remain auditable

Current status:

- implemented in broad form
- ready for refinement, not first-time build

### Reports

Target behavior:

- treasury should drive central finance reporting
- management should see account balances, inflows, outflows, petty cash exposure, receivables, and unpaid obligations

Current status:

- reports module exists
- finance reporting still leans on legacy sales payment tables rather than treasury-ledger truth

---

## 7. Required Features

### CF-1: Finance account master

- maintain multiple banks and multiple accounts
- distinguish `bank`, `current`, `cash`, and `petty_cash`
- mark which current accounts can issue cheques
- calculate current balance from treasury entries, not manual edits

### CF-2: Treasury transaction ledger

- record inflow, outflow, transfer, payroll disbursement, petty cash allocation, petty cash expense, supplier payment, receipt reversal
- support reference numbers, notes, source links, and audit trail
- support immutable posting with reversal, not destructive edits

### CF-3: Sales money-in integration

- require target treasury account for completed buyer receipts
- support mixed-method receipt lines
- keep buyer carry-forward credit on buyer ledger
- reflect money movement in treasury immediately after valid posting

### CF-4: Payroll money-out integration

- require treasury account when marking payroll as paid
- create outflow transaction with employee linkage
- show payment account and treasury reference on payroll detail

### CF-5: Petty cash control

- allocate petty cash from central account to manager/site account
- capture purpose at allocation time
- require justification for every petty cash expense
- support admin review and status history
- show outstanding petty cash by holder

### CF-6: Supplier payment control

- record supplier payment against supplier and PO/receipt references
- support cash, transfer, and cheque methods
- expose unpaid, partially paid, and paid supplier positions later if required

### CF-7: Reporting and transparency

- consolidated balances by account
- movement report by period and type
- inflow/outflow summary
- petty cash outstanding report
- buyer receipt vs outstanding summary
- payroll disbursement summary
- supplier payment summary once integrated

---

## 8. Recommended Delivery Roadmap

### Step 1: Stabilize what is already built

- fix receipt validation so `financeAccountId` is accepted in sales and buyer receipt APIs
- align tests with the current buyer-receipt + treasury path instead of relying mainly on legacy `payments`
- confirm treasury posting from sale receipts in UI and API end-to-end

### Step 2: Make treasury the finance source of truth

- rebase financial overview reporting onto treasury transactions
- expose treasury references consistently in sale, buyer, and payroll views
- add filters for account, transaction type, counterparty, and source module

### Step 3: Complete procurement integration

- add supplier payment records linked to PO / goods receipt / supplier
- post those payments into treasury
- add unpaid procurement obligations reporting if required

### Step 4: Add cheque and reconciliation workflows

- cheque book setup per current account
- issue, outstanding, cleared, bounced, voided lifecycle
- cleared balance vs book balance

---

## 9. Sales Batch Implementation Status

The requested batch-sales redesign is already mostly implemented.

### Implemented

- one sale can contain multiple lorry lines
- lorry lines capture birds, previous weight, loaded weight, net weight, and notes
- sale totals compile from lorry lines
- sale create and edit screens support lorry rows
- payments can be captured in multiple lines and multiple methods
- buyer overpayments become carry-forward credit
- buyer detail page exists with sales history, receipts, running ledger, outstanding, and advance credit
- sales list shows outstanding balance and settlement status

### Partial / needs cleanup

- some backend tests still exercise legacy sale-payment assumptions
- some reporting still reads legacy `payments` instead of the newer buyer receipt model
- treasury linkage for receipt posting needs validator alignment

### Missing

- no evidence yet of supplier-style settlement symmetry on the purchasing side
- no cheque-book lifecycle on the finance side, even though cheque receipt/payment concepts exist

---

## 10. Implementation Recommendation

Do not rebuild the sales settlement layer.  
Use the current buyer receipt and ledger design as the base, then finish the treasury integration cleanly around it.

The best next sequence is:

1. finish treasury posting correctness for sales receipts
2. standardize reporting on treasury + buyer ledger
3. add supplier payment integration
4. add cheque lifecycle and reconciliation

This gives a usable central finance module quickly without throwing away the work already completed in sales, payroll, and petty cash.
