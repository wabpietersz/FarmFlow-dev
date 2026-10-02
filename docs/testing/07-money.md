# Test plan 07: Money

**For:** accounts and the owner.
**Time:** about 90 minutes.
**Sign in as:** a system admin, or Ruwan Fernando (accountant). The access checks use Nimal Perera and Sunil Bandara.
**Have open:** [Test-Data-Sheet.md](Test-Data-Sheet.md), section 7 (accounts, the loan, what is waiting, and **every money movement so far**).
**User guide:** [Money](../user-guide/06-money.md).

**The idea being tested:** nobody types a balance or a report. Every movement is one ledger line with an account, a category, a cost centre and the document behind it; balances, profit & loss and cash flow are those lines added up.

**What you will use** (already in the system):

| Record | How to recognise it |
|---|---|
| Three accounts | Main Current Account, Main Cash Safe, Farm Petty Cash Float. Balances in the data sheet |
| About sixty ledger lines | Listed one by one in the data sheet |
| A bank loan | Commercial Bank, Rs 3,000,000, two repayments made, Rs 2,750,000 still owed |
| A petty cash float | Held by Nimal Perera. One claim of Rs 2,400 (tea for the catching crew) waiting for review |
| An expense waiting for approval | Wayamba Water Supply, Rs 18,000, Main Farm |
| Service work | "House 2 fan motor rewind" Rs 35,000: approved, not paid. "Hammer mill screen replacement" Rs 28,000: waiting for approval |
| A cheque book | `CB-0001`, leaves 100101 to 100125. 100101 is used and cleared |

Other plans also move money. Where a balance matters, this plan has you write down the figure first and check the change.

---

## Part 1: Balances and the ledger

### Y-01 Balances

1. **Money → Overview**, then **Money → Accounts**.
2. **Home**: read Cash on hand.

**Expect**
- [ ] Three accounts. On untouched test data the balances are those in the data sheet.
- [ ] The three balances add up to Home's **Cash on hand**.

### Y-02 Work one balance out by hand

Use the data sheet's list of money movements.

1. Take **Main Cash Safe**: opening 200,000.
2. Add every "In" line for that account and take off every "Out" line.

**Expect**
- [ ] On untouched data: 200,000 + 300,000 + 20,000 − 2,400 − 50,000 − 10,000 = **Rs 457,600**, the balance shown.
- [ ] If others have been working, the app's balance equals your figure plus what they did since: open the account in the **Ledger** and account for each newer line.

### Y-03 The ledger

1. **Money → Ledger.**
2. Filter by category **Electricity**.
3. Clear that; filter by cost centre **Feed Mill**.
4. Clear that; filter by batch `MF-H1-001`.
5. Look for any line in category **Uncategorized**.

**Expect**
- [ ] Electricity: five payments (two for the mill, two for Main Farm, one for Expansion 1), unless others have added more.
- [ ] Feed Mill: raw material payments, mill electricity, the mill operator's wages and EPF/ETF.
- [ ] `MF-H1-001`: the chicks (300,000 out) and the receipts from its sales (400,000 and 1,382,400 in).
- [ ] No Uncategorized lines. Every income and expense line has a cost centre.

### Y-04 Follow a number back to the lorry

1. In the **Ledger**, find the **Bird Sales** line of Rs **1,382,400**.
2. Open it. Follow it to the receipt, then to the sale, then to the lorry weights, then to the batch.

**Expect**
- [ ] Ledger line → receipt from Fresh Mart → sale of 1,000 birds → lorry `WP LK-4521`, empty 3,200 kg, loaded 5,360 kg, 2,160 kg × Rs 640 → batch `MF-H1-001`.
- [ ] Each step shows who entered it.

---

## Part 2: Recording money by hand

### Y-05 Move money between your own accounts

1. Write down Main Current Account: Rs __________ and Main Cash Safe: Rs __________.
2. **Money → Transactions → Record Treasury Movement.**
3. Movement type **Internal Transfer**. Source **Main Current Account**, destination **Main Cash Safe**, Rs **100,000**, date today, narrative `Cash for the farms`. Save.

**Expect**
- [ ] Current is down by 100,000 and the Safe is up by 100,000. Cash on hand has not changed.
- [ ] It does not appear in **Profit & loss**.

### Y-06 An expense with no other document

1. **Record Treasury Movement.** Movement type **Manual Outflow**.
2. Account **Main Current Account**, Rs **25,000**, date today, category **Electricity**, cost centre **Expansion 1**, counterparty `CEB`, narrative `Expansion 1 electricity`. Save.

**Expect**
- [ ] Current is down by 25,000.
- [ ] The ledger line is tagged Electricity / Expansion 1.
- [ ] **Farms → Batches → EX-HA-001 → Performance & profit**: the farm costs include this bill (all of it, while `EX-HA-001` is the only batch on Expansion 1 this month; a share by bird-days if plan 09 has put a second batch there).

### Y-07 Re-tag a line

1. **Ledger** → the most recent **Bank Charges** line (Rs 2,500) → **Re-tag**.
2. Change the category to **Professional Fees**. Save. Then change it back to **Bank Charges**.

**Expect**
- [ ] The category changes and the amount, account and date do not.
- [ ] Profit & loss for that month moves 2,500 from one category to the other and back.

### Y-08 Correcting a wrong amount ⚠

The user guide says a wrong amount is corrected by reversing the transaction and entering it again.

1. Open the transaction from Y-06 and look for a way to reverse it.

**Expect**
- [ ] ⚠ **There is currently no reverse action on screen** (README, known item 8). Record this as *Missing* and say how you would expect to correct a wrong entry.

---

## Part 3: Petty cash

### Y-09 Review a claim

1. Write down Farm Petty Cash Float: Rs __________.
2. **Money → Petty cash.** Open Nimal Perera's allocation (Rs 50,000).
3. Review the claim waiting: Rs **2,400**, "Tea and snacks for the catching crew". Approve it.

**Expect**
- [ ] The float is down by 2,400.
- [ ] **Ledger**: Rs 2,400 out of the float, category **Staff Welfare**, cost centre **Main Farm**.
- [ ] The allocation shows 50,000 given, 17,100 spent (8,500 + 6,200 + 2,400), **32,900** left.

### Y-10 Give a float and spend from it

1. **Petty cash → Allocate Petty Cash.** From **Main Cash Safe** to **Farm Petty Cash Float**, farm manager **Dilani Jayawardena**, Rs **20,000**, date today, purpose `Expansion 1 float`.
2. On that allocation: **Submit Petty Cash Expense**: date today, category **Fuel & Gas**, cost centre **Expansion 1**, Rs **3,000**, justification `Petrol for the brush cutter`.
3. Review and approve it.

**Expect**
- [ ] After step 1: Safe down 20,000, float up 20,000. Shown as a transfer, not a cost.
- [ ] After step 3: float down 3,000; ledger line Fuel & Gas / Expansion 1.
- [ ] Before it is approved, the claim is not in the balance or the reports.

---

## Part 4: Expenses and service work

### Y-11 Approve and pay an expense

1. **Money → Transactions**, operational expenses → **Wayamba Water Supply, Rs 18,000**.
2. **Approve**. Then **Settle**: Main Current Account, bank transfer, today.

**Expect**
- [ ] Current is down by 18,000.
- [ ] Ledger: category **Water**, cost centre **Main Farm**.

### Y-12 Pay a repair by cheque

1. **Farms → Farm control → Service workflows.**
2. **Hammer mill screen replacement** (Rs 28,000): **Approve**.
3. **House 2 fan motor rewind** (Rs 35,000): **Settle**. Main Current Account, **cheque**, the next available leaf, today.
4. Write down Main Current Account: Rs __________.
5. **Money → Cheques → Outgoing Cheques.** Find that leaf. **Clear** it.

**Expect**
- [ ] After settling: the leaf is **Issued** for 35,000 to Ceylon Power Services. The bank balance has **not** moved.
- [ ] After clearing: Current is down by 35,000. Ledger: **Repairs & Maintenance**, **Main Farm**.

### Y-13 A new cheque book

1. **Money → Cheques → Create Cheque Book.** Account Main Current Account, book code `CB-0002`, start **200001**, end **200010**, issued today.

**Expect**
- [ ] Ten leaves, all **Available**.
- [ ] Trying to create a cheque book for **Main Cash Safe** is not possible: only current accounts have cheques.

---

## Part 5: The owner and the bank

### Y-14 Owner puts money in and takes money out

1. Open **Money → Profit & loss** for this month and write down net profit: Rs __________.
2. **Money → Owner & loans → Put money in.** Rs **500,000** into Main Current Account, today.
3. **Take money out.** Rs **50,000** from Main Current Account, today.
4. Open Profit & loss again.

**Expect**
- [ ] Current is up by 450,000 in all.
- [ ] Profit & loss has **not** changed. Capital is not income; drawings are not a cost.
- [ ] Ledger: **Owner Capital Introduced** 500,000 in; **Owner Drawings** 50,000 out.

### Y-15 Repay part of the loan

1. **Owner & loans** → Commercial Bank → **Record repayment**. Principal **125,000**, interest **27,500**, from Main Current Account, today.

**Expect**
- [ ] Current is down by 152,500.
- [ ] Still owed: 2,750,000 → **Rs 2,625,000** (down by the principal only).
- [ ] Profit & loss this month: **Loan Interest** up by 27,500. The 125,000 is nowhere in it.

### Y-16 A new loan

1. **Owner & loans → Loan received.** Lender `Peoples Leasing`, Rs **500,000**, received today, into Main Current Account, 14% a year, 12 months.

**Expect**
- [ ] Current is up by 500,000. Two loans in the register.
- [ ] Not in Profit & loss.

---

## Part 6: The reports

### Y-17 Profit & loss

1. **Money → Profit & loss.** Period: last month. View: **Whole business**.
2. Check three categories against the data sheet's list of movements for that month.
3. Change the view to **Compare**.

**Expect**
- [ ] Income and costs by category. Owner money, loan principal, staff advances, EPF withheld and transfers are **not** there.
- [ ] Each category equals the total of that category's ledger lines dated in the month.
- [ ] Compare shows Main Farm, Expansion 1, Feed Mill and Admin side by side. Their income, costs and net add up to the Whole business figures.
- [ ] The Feed Mill shows a loss: it has costs and no income. Its cost reaches the farms through the feed.
- [ ] "Not tagged to a cost centre" is empty.

### Y-18 Cash flow

1. **Money → Cash flow.** Period: this month, all accounts.

**Expect**
- [ ] Opening balance + cash from trading + owner, loans and advances = closing balance.
- [ ] **Cash from trading** equals this month's Profit & loss net.
- [ ] **Closing balance** equals the three account balances added together, and Home's Cash on hand.
- [ ] Owner capital, drawings, loan received, loan principal repaid, staff advances and EPF withheld are each on their own line.

### Y-19 Payables

1. **Money → Payables.**

**Expect** (on untouched data; the stock plan pays some of these)
- [ ] **Agri Feeds**: `INV-AF-1002` Rs 1,248,500, late; `INV-AF-1003` Rs 2,060,000, awaiting approval.
- [ ] **Acme Suppliers**: `INV-AC-2003` Rs 44,000, not yet due.
- [ ] Total owed equals **Home → You owe suppliers**.
- [ ] A statement for Agri Feeds downloads as CSV with every invoice and payment.

### Y-20 Download

1. Download the Profit & loss and the Cash flow as CSV. Open them in a spreadsheet.

**Expect**
- [ ] The same categories and totals as on screen.

---

## Part 7: Locking a month

Use the month from **three months ago** (the data sheet names it). Nothing happened in it, so locking it disturbs nobody.

### Y-21 Lock, try, release

1. **Farms → Farm control → Period locks → Create Period Lock.** From the first to the last day of that month, scope **all**, note `Month checked`.
2. **Money → Transactions → Record Treasury Movement**: Manual Outflow, Rs 100, Electricity, Admin, **dated the 15th of the locked month**. Save.
3. Back in **Period locks**: **Release** the lock, with a note.

**Expect**
- [ ] The lock is listed as active.
- [ ] The movement is refused, naming the closed period. ⚠ The message may appear as a general failure (README, known item 10).
- [ ] After release, the lock shows as released.

### Y-22 Month-end checklist

1. Work through the month-end list in the [user guide](../user-guide/06-money.md#month-end) for last month, without locking it.

**Expect**
- [ ] Every step can be done from the screens named.
- [ ] Note any step where you would want a report or a check that is not there (for example matching the bank statement line by line).

---

## Should be refused

| ID | Try | Expect | ✓ |
|---|---|---|---|
| Y-R1 | **Record Treasury Movement**, Manual Outflow, with no category | Refused: category is required | |
| Y-R2 | Manual Outflow with a category and no cost centre | Refused: cost centre is required | |
| Y-R3 | Internal Transfer from an account to itself | Refused | |
| Y-R4 | **Settle** an expense that has not been approved (create one first: Transactions → operational expense, Rs 1,000, Water, Main Farm) | Refused: it must be approved first. ⚠ May show as a general failure | |
| Y-R5 | **Record repayment** on the Commercial Bank loan with principal **5,000,000** (more than is owed) | Should be refused. Cancel if it is not, and note it | |
| Y-R6 | As **Sunil Bandara** (farm worker), type `/treasury` at the end of the address | Not authorised | |
| Y-R7 | As **Nimal Perera** (farm manager: Money at "User" level), open **Money** | He sees accounts and the ledger and can submit petty cash claims against his own float. He has **no** Record Treasury Movement, and should not see Profit & loss or Cash flow | |
| Y-R8 | As Nimal Perera, submit a petty cash expense against **Dilani's** float (from Y-10) | Refused: only your own allocation | |
| Y-R9 | Edit the amount of a posted ledger line | Not possible | |

---

## To explain to testers, because it will be asked

- **Profit & loss counts money when it moves.** A sale on credit is income when the buyer pays. A batch's own profit page uses the full sale value from the day of the sale. The two differ until everyone has paid.
- **Stock bought but not yet used** is a cost in Profit & loss as soon as it is paid for. It reaches a batch only when it is used.
- **A cheque is not money until it clears**, whether you wrote it or a buyer gave it to you.
- **There is no balance sheet or trial balance.** This is a cash ledger.

## Questions for the tester

1. Are the categories the ones you would use? Which are missing? Which would you never use?
2. Is a cash-basis profit acceptable for the owner's monthly view, or do you need sales counted when invoiced?
3. Does the cash flow make sense to the owner without explanation?
4. How would you check these balances against the bank statement? Is what's here enough?
5. Is petty cash handled the way managers really hold and account for a float?
6. How do you want to correct a wrong entry?
7. What report do you prepare today that you could not get from this?
8. Would you trust the profit figure? What would you check it against?

## Passed when

You can explain every account balance from the ledger, the cash flow's closing balance equals the accounts, and the owner has read the profit & loss and said what they would question.
