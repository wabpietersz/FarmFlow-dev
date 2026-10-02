# Session 5: Money and reports

**With:** accounts and the owner.
**Time:** 90 minutes, after the other areas have put activity into the system.
**Guide:** [../user-guide/06-money.md](../user-guide/06-money.md)
**Also:** the finance demo ([../finance-demo/README.md](../finance-demo/README.md)) is the walk-through of how these numbers tie together. Run it before or as part of this session.

## Ask first: how it's done today

- Which bank and cash accounts are there? Who holds petty cash?
- How do you know the cash position on a given morning?
- How is the month's profit worked out, and how long after month-end?
- How is the owner's own money kept apart from the business's?
- What loans are there, and how are repayments recorded?
- How often is the bank statement checked against the books?

## Scripted steps

| ID | Step | Expected | ✓ |
|---|---|---|---|
| Y-1 | **Money → Overview**. | Balance per account; total equals Home's "Cash on hand" | |
| Y-2 | **Accounts**: for one account, work out by hand opening balance + money in − money out from this pilot's activity. | Equals the balance shown | |
| Y-3 | **Ledger**: filter by category, then by cost centre, then by batch. | Each line has a category, a cost centre and a source; no "Uncategorized" | |
| Y-4 | Pick any line and follow it back to its document (sale, PO, payroll). | The document opens and shows the same amount | |
| Y-5 | **Transactions → Record Treasury Movement**: an internal transfer from bank to cash. | Both balances change; total cash doesn't; it doesn't appear in profit & loss | |
| Y-6 | Record a manual money-out (electricity for a farm). | Tagged; reaches that farm's batches by bird-days | |
| Y-7 | **Petty cash → Allocate Petty Cash** to a manager; **Submit Petty Cash Expense** with category and farm; review it. | Float goes down by the expense; the expense reaches the ledger tagged | |
| Y-8 | **Cheques → Create Cheque Book**; issue a cheque for a payment; clear it. | Leaf moves available → issued → cleared | |
| Y-9 | Reverse a wrong transaction. | A mirror entry is made; the original stays visible, marked reversed | |
| Y-10 | **Owner & loans → Put money in**. | Cash goes up; profit & loss doesn't change | |
| Y-11 | **Take money out**. | Cash goes down; profit & loss doesn't change | |
| Y-12 | **Loan received**, then **Record repayment** with principal and interest. | Loan balance drops by principal only; only interest appears as a cost in profit & loss | |
| Y-13 | **Profit & loss** for the month: whole business, then one farm, then **Compare**. | Income and costs by category; farms, mill and admin side by side; totals agree with the whole-business view | |
| Y-14 | **Cash flow** for the month. | Opening + trading + owner/loans/advances = closing; closing equals the account balances | |
| Y-15 | **Payables**. | What is owed per supplier by lateness; invoices awaiting approval | |
| Y-16 | **Reports → Cost Allocation**. | Shared costs: total, charged, not charged; nothing unexplained | |
| Y-17 | **Reports → Profitability / Comparison**. | Batches listed with cost per kg and profit | |
| Y-18 | Download the profit & loss and cash flow CSV files. | Open in a spreadsheet with the same totals | |
| Y-19 | **Farms → Farm control → Period locks**: lock last month. Try to add a movement dated in it. | Refused, naming the lock | |
| Y-20 | Work through the month-end checklist in the user guide. | Every step can be done; nothing is missing | |

## Should be refused

| ID | Try | Expected |
|---|---|---|
| Y-R1 | A money-out over the approval limit by a non-approver | Waits; not counted in balances or reports until approved |
| Y-R2 | Edit a posted transaction | Not possible; only reversal |
| Y-R3 | A manual movement with no category | Refused |
| Y-R4 | A user without Money access opens `/treasury` | Not authorised |
| Y-R5 | A non-accounts user looks for Profit & loss | The tab isn't shown |

## Things to explain, because they will be asked

- **Profit & loss counts money when it moves**, not when the invoice is raised. A sale on credit shows as income when the buyer pays. A batch's own profit page uses the full sale value. So the two can differ until everyone has paid.
- **Stock bought but not yet used** is already in the profit & loss as a cost (it was paid for), but reaches a batch's cost only when used.
- **Owner money and loan principal** never count as profit or cost.
- **There is no balance sheet or trial balance yet.** That comes with the later double-entry ledger.

## Feedback to draw out

- Are the categories the ones you'd use? Which are missing, which would you never use?
- Is cash-basis profit acceptable for the owner's monthly view, or is an invoiced (accrual) view needed too?
- Does the cash flow layout make sense to the owner without explanation?
- How would you reconcile to the bank statement here? Is that enough?
- Is petty cash handled the way managers actually hold and account for a float?
- What report do you prepare today that you couldn't get from this?
- Would you trust the profit figure? What would you check it against?

## Passed when

Accounts can explain every account balance from the ledger, the cash flow closing balance equals the accounts, and the owner has read the profit & loss and said what they'd question.
