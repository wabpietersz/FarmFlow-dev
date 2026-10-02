# 06 Money

For accounts and the owner.

## The one idea behind Money

Every time money moves, FarmFlow writes a line in the **ledger** with:

- the **account** (which bank or cash account)
- **in** or **out**, and the amount
- the **category**: what it was for
- the **cost centre**: which farm, the Feed Mill, or Admin (and the batch, where it applies)
- the **document** behind it: the sale, purchase order, payroll or expense

Nobody types a balance. Balances, profit & loss and cash flow are all added up from these lines. Most lines are written for you when someone records a receipt, pays a supplier or pays wages. You only type a line yourself for things that have no other document.

For a worked example from start to finish, see [../finance-demo/README.md](../finance-demo/README.md).

## The tabs

| Tab | Use it for |
|---|---|
| **Overview** | Balances and recent movement |
| **Ledger** | Every line, with category and cost centre. Filter and re-tag here |
| **Profit & loss** | Income and costs by category and month (accounts and owner only) |
| **Cash flow** | Opening balance to closing balance, by month (accounts and owner only) |
| **Payables** | What you owe suppliers |
| **Owner & loans** | The owner's own money, and business loans |
| **Accounts** | Bank, current, cash and petty cash accounts |
| **Cheques** | Cheque books; cheques issued and received |
| **Transactions** | Recording a movement by hand; reversing |
| **Petty Cash** | Floats given to managers and what they spent |
| **Setup** | Categories and cost centres |

---

## Accounts

**Accounts → Create Treasury Account.** Choose the type (bank, current, cash, petty cash), and enter the opening balance and its date. Only current accounts can have cheque books.

The balance is always: opening balance + money in − money out.

## Money that arrives by itself

You don't enter these under Money. They come from the other areas:

| What happened | Recorded under | Category in the ledger |
|---|---|---|
| Buyer paid for birds | Sales → Add Receipt | Bird Sales |
| Buyer paid for litter, manure, scrap | Sales → Other income | Other Farm Income |
| Buyer overpaid | Sales | Customer Advances |
| Supplier paid | Stock → Invoices | By item: Feed Raw Materials, Medicine & Vaccines… |
| Wages paid | People → Payroll | Wages & Salaries (and EPF Withheld, Staff Advances & Loans) |
| EPF/ETF paid over | People → Payroll → EPF / ETF | EPF / ETF Contributions |
| Staff advance or loan | People → Payroll → Advances & loans | Staff Advances & Loans |
| Repair or contractor settled | Farms → Farm control | Repairs & Maintenance, or as chosen |

## Recording a movement by hand

**Transactions → Record Treasury Movement.** Use it for things with no other document: electricity, bank charges, rent, insurance.

| Type | Use |
|---|---|
| Manual Outflow | Money out. Choose category and cost centre |
| Manual Inflow | Money in. Choose category and cost centre |
| Internal Transfer | Between your own accounts. Doesn't count as income or cost |

Choose the cost centre with care. It decides who carries the cost:

- **A farm:** shared among that farm's batches by bird-days.
- **Feed Mill:** goes into the cost per kg of feed.
- **Admin:** shared among all farms' batches by bird-days.

A movement over the approval limit, by someone who can't approve, waits. Until it's approved it isn't in any balance or report.

## Fixing mistakes

- **Wrong category or cost centre:** **Ledger** → the line → **Re-tag**.
- **Wrong amount, account or date:** reverse the transaction and enter it again. The original stays visible, marked reversed. Posted lines are never edited.
- **"Uncategorized" lines:** find them in the Ledger and re-tag them. There should be none at month-end.

## Petty cash

1. **Allocate Petty Cash:** give a manager a float from a cash account.
2. The manager uses **Submit Petty Cash Expense** for each spend: amount, category, farm, and a photo of the receipt.
3. Accounts reviews each expense.
4. Top the float up when it runs low.

## Cheques you write

**Cheques → Create Cheque Book** for a current account. When you pay by cheque, pick the next leaf. It goes issued → cleared (or bounced or voided). The Cheques tab shows what is still outstanding.

Cheques from buyers are covered in [05 Sales](05-sales.md).

## Owner & loans

**Owner money**

- **Put money in:** the owner's capital. Cash goes up. It is **not** income.
- **Take money out:** drawings. Cash goes down. It is **not** a cost.

**Business loans**

- **Loan received:** lender, amount, term, and the account it went into. Cash goes up. Not income.
- **Record repayment:** enter principal and interest separately. Principal reduces what you owe. **Only the interest is a cost.**

The register shows, for each loan, what has been paid and what is still owed.

## Payables

What you owe each supplier by lateness, invoices waiting for approval, advance payments made, and a statement for any supplier and period (CSV).

---

## Reading the reports

### Profit & loss

Income and costs by category, month by month. Choose **Whole business**, one cost centre (a farm, the Feed Mill, Admin), or **Compare** to see them side by side.

Things to know:

- **It counts money when it moves.** A sale on credit is income when the buyer pays, not when the invoice is raised.
- Buyer credit used on a later sale counts as sales on the day it's used.
- Owner money, loan principal, staff advances and transfers between accounts are **not** in it.
- Stock is a cost when it's paid for, not when it's used.
- "Not tagged to a cost centre" should be empty. If it isn't, re-tag those lines.

### Cash flow

```
Opening balance
+ Cash from trading          (the same income and costs as the profit & loss)
+ Owner, loans and advances  (capital, drawings, loans, staff advances, buyer credit, EPF held)
= Closing balance            (equals your account balances)
```

Choose all accounts or one. If the closing balance doesn't equal the bank statement, the difference is uncleared cheques or something not yet entered.

### Profit & loss against batch profit

| | Profit & loss | A batch's Performance & profit |
|---|---|---|
| Sales | When money is received | Full sale value on the sale date |
| Stock (feed materials, vaccine) | When paid | When used |
| Feed | Raw materials, when paid | Feed delivered, at mill cost per kg |
| Wages | When paid | Shared by bird-days |
| Period | A calendar month | The batch's life |

Over a whole batch, once everyone has paid and stock bought has been used, the two tell the same story. In any one month they'll differ.

### Other reports

**Reports → Cost Allocation** shows each pool of shared cost, how much was charged to batches or feed, and how much wasn't (for example a month when a farm had no birds).
**Reports → Profitability** and **Comparison** rank batches.

Both money reports download as CSV.

---

## Month-end

1. **Ledger:** no "Uncategorized" lines, nothing untagged.
2. **Cheques:** every cheque cleared, bounced, or known to be outstanding.
3. **Accounts:** each balance agrees with the bank statement and the cash count.
4. **Payables** and **Sales → Owed to you:** read them.
5. **Payroll** paid and **EPF/ETF** paid over.
6. **Profit & loss** and **Cash flow:** read them. Ask about anything unusual.
7. **Farms → Farm control → Period locks → Create Period Lock** for the month. After that, nothing dated in the month can be changed.

## Common questions

**Home's cash on hand doesn't match the bank.**
Check for buyer cheques not yet cleared, cheques you've written that haven't been presented, and movements waiting for approval.

**A payment isn't in the balance.**
It may be waiting for approval. Look under **Approvals**.

**There's no balance sheet.**
Correct. FarmFlow keeps a cash ledger for now. It is built so a full double-entry ledger can be added later without re-entering anything.
