# Treasury Gap-Fix Manual QA

**Date:** April 4, 2026  
**Scope:** Treasury-first reporting, cheque visibility, operational treasury references, and supplier payment visibility

---

## Preconditions

- Seed or staging data includes:
  - at least one posted buyer receipt
  - at least one bounced incoming buyer cheque
  - at least one outgoing cheque in `issued`
  - at least one paid payroll run
  - at least one petty cash allocation with approved expenses
  - at least one supplier payment linked to a purchase order
- Treasury accounts include readable account names for bank, current, cash, and petty cash accounts

---

## Manual QA Matrix

1. Reports page treasury-first cash metrics
   - Open Reports and confirm Financial Overview shows:
     - `Sales Revenue`
     - `Treasury Inflows`
     - `Treasury Outflows`
     - `Net Cash Movement`
     - `Customer Receipt Inflows`
     - `Payroll Outflows`
     - `Supplier Payment Outflows`
     - `Petty Cash Net`
   - Confirm recent activity rows are treasury transactions, not legacy sales payment rows.
   - Confirm totals reconcile to treasury posted or cleared transactions for the selected date range.

2. Buyer outstanding and advance summary
   - Open Reports and confirm the buyer outstanding / advance section shows buyer ledger based balances.
   - Verify buyer outstanding and buyer advance values do not change when unrelated treasury-only transactions are added.

3. Payroll disbursement summary
   - Open Reports and confirm payroll summary rows only reflect treasury `payroll_disbursement` transactions.
   - Check date range filtering and totals against paid payroll records.

4. Petty cash outstanding summary
   - Open Reports and confirm petty cash outstanding equals allocation minus approved expense movements.
   - Verify pending or rejected petty cash expenses do not reduce outstanding balance.

5. Supplier payment summary
   - Open Reports and confirm supplier payment rows reflect treasury-backed supplier payments.
   - Verify totals match supplier payment rows for the same period.

6. Treasury incoming cheque visibility
   - Open Treasury and confirm incoming cheques appear in two separate groups:
     - pending incoming receipts
     - bounced incoming receipts
   - Confirm pending incoming receipts still offer clear and bounce actions.
   - Confirm bounced incoming receipts are visible as history only and are not actionable.
   - Confirm bounced rows show receipt code, buyer, amount, account name, cheque details, original treasury transaction id, and reversal id when present.

7. Treasury outgoing cheque rules
   - In Treasury, confirm outgoing cheque actions are only available when status is `issued`.
   - Confirm no reversal option exists for already cleared outgoing cheques.

8. Buyer detail treasury references
   - Open a buyer detail page and inspect the receipts table.
   - Confirm each treasury-backed line shows:
     - treasury account name
     - treasury transaction reference
     - treasury reversal reference when bounced or reversed

9. Sale detail treasury references
   - Open a sale detail page with posted payments.
   - Confirm payment rows show selected treasury account name and treasury transaction or reversal ids.

10. Payroll detail treasury context
    - Open a payroll detail page for a paid payroll record.
    - Confirm the page shows:
      - treasury account name
      - payment method
      - cheque leaf and cheque number when payment method is cheque
      - treasury transaction reference

11. Procurement supplier payment visibility
    - Open a purchase order detail page and confirm supplier payments are visible there.
    - Open supplier payment history from the supplier-facing procurement UI and confirm payment history is available from the existing supplier payments API.

12. Treasury transaction traceability
    - Open Treasury transaction history and inspect a sales receipt, payroll payment, petty cash movement, supplier payment, and manual entry.
    - Confirm each row exposes enough source traceability to identify the origin business record.
    - Confirm manual treasury entries still have a source link and do not appear linkless.

---

## Acceptance Criteria

- All cash movement metrics on Financial Overview reconcile to treasury entries for the same period.
- Sales revenue remains visible as a separate commercial metric and is not mixed into treasury cash movement totals.
- Bounced incoming buyer cheques remain visible in Treasury after reversal and are not reopened for completion.
- Buyer, sale, payroll, and procurement screens show readable treasury account names and transaction references.
- Supplier payment visibility is available from both purchase order detail and supplier-facing procurement history.
- Every treasury transaction type remains traceable back to a source entity, including manual treasury entries.
