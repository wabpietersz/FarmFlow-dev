# Test plan 09: Finance from start to finish

**For:** accounts and the owner, together if possible.
**Time:** about 75 minutes.
**Sign in as:** a system admin.
**Have open:** [Test-Data-Sheet.md](Test-Data-Sheet.md), and the [money map](../finance-demo/Money-Map.md) (one page on how money and cost move).

## What this plan proves

You follow **one small batch** from the day the owner funds it to the day it is sold and closed, entering each thing once, in the area where it belongs. Then you check that four views agree, to the rupee:

1. the **account balances**
2. the **ledger**
3. this month's **profit & loss** and **cash flow**
4. the **batch's own cost and profit**

Where two views differ, the plan has you explain the difference line by line.

## Before you start

- **Run this when nobody else is entering money.** The plan compares totals before and after. If someone else pays a supplier while you work, your sums will be out by that amount (you can still find it: every line is in the ledger).
- Date **every** entry **today**.
- This plan uses **House B on Expansion 1** and the **Broiler Starter** run that has 2,500 kg left. The other plans leave both alone.

### Write down where you start

| | Where to read it | Before |
|---|---|---|
| A. Main Current Account | Money → Accounts | Rs ______________ |
| B. Main Cash Safe | Money → Accounts | Rs ______________ |
| C. Farm Petty Cash Float | Money → Accounts | Rs ______________ |
| D. **Cash on hand** (A + B + C) | Home | Rs ______________ |
| E. Profit & loss, this month: total income | Money → Profit & loss | Rs ______________ |
| F. Profit & loss, this month: total costs | Money → Profit & loss | Rs ______________ |
| G. Profit & loss, this month: net (E − F) | | Rs ______________ |
| H. Fresh Mart owes | Sales → Owed to you | Rs ______________ |
| I. Commercial Bank loan still owed | Money → Owner & loans | Rs ______________ |
| J. Vitamins & electrolytes in the Expansion 1 store | Stock → Stores | ______ sachets |

On untouched test data: A 3,593,002.31 · B 457,600 · C 35,300 · D 4,085,902.31 · E 0 · F 0 · G 0 · H 0 · I 2,750,000 · J 5.

---

## Act 1: The owner funds the business

### E-01 Owner puts money in

1. **Money → Owner & loans → Put money in.** Rs **500,000** into **Main Current Account**, today, note `Capital for the new batch`.

**Expect**
- [ ] Main Current Account = A + 500,000.
- [ ] **Profit & loss** income is still E. Capital is not income.
- [ ] **Ledger**: one line, 500,000 in, category **Owner Capital Introduced**.

---

## Act 2: Buying

### E-02 Order, receive, bill, pay

1. **Stock → Purchase orders → new order.** Supplier **Acme Suppliers**, date today, cost centre **Expansion 1**. One line: **Vitamins & electrolytes**, **10** sachets at **460**. Save, then **Submit**.
2. **Receive stock**: into **Expansion 1 store**, 10 sachets, expiry one year from today.
3. **Stock → Invoices → Record Supplier Invoice**: Acme Suppliers, that order, reference `INV-FLOW-01`, dated today, due in 14 days, amount **4,600**.
4. **Farms → Farm control → Approvals**: approve `INV-FLOW-01`.
5. **Stock → Invoices** → `INV-FLOW-01` → **Pay supplier**: Main Current Account, bank transfer, **4,600**, today.

**Expect**
- [ ] After step 2: Expansion 1 store holds J + 10 sachets. **No money has moved.**
- [ ] After step 3: the invoice shows **Matches goods**.
- [ ] After step 5: Main Current Account is down by 4,600.
- [ ] **Ledger**: 4,600 out, category **Medicine & Vaccines**, cost centre **Expansion 1**. Nobody chose the category: it came from the item's type.

---

## Act 3: The batch

### E-03 Place the batch and pay for the chicks

1. **Farms → Batches → New batch.** Farm **Expansion 1**, house **House B**, code `EX-HB-FLOW`, chicks **500**, placement date **30 days ago**.
2. On the batch: **Chick Placement**. Supplier Lanka Hatcheries, placement date 30 days ago, delivered **500**, dead on arrival **0**, cost **150** each.
3. **Money → Transactions → Record Treasury Movement.** Manual Outflow, Main Current Account, Rs **75,000**, today, category **Day-old Chicks**, cost centre **Expansion 1**, batch `EX-HB-FLOW`, counterparty `Lanka Hatcheries`, narrative `Chicks for EX-HB-FLOW`.

**Expect**
- [ ] The batch's **Performance & profit** shows chicks **Rs 75,000** after step 2, before any money moved. The chick cost comes from the placement.
- [ ] After step 3: Main Current Account is down by 75,000; ledger line Day-old Chicks, tagged to the batch.
- [ ] The batch's chick cost is still 75,000, not 150,000. The payment is not counted a second time.

### E-04 Feed from the mill

1. **Feed mill → Distribution → New Distribution.** Production batch: the **Broiler Starter** run with 2,500 kg left. Farm batch `EX-HB-FLOW`. Quantity **1,000** kg. Today.
2. Open the batch's **Performance & profit** and find the new feed line.

**Expect**
- [ ] **No money has moved.**
- [ ] The feed line reads "starter from PROD-… (materials …/kg + mill …/kg)". Write the two rates down: materials ________ + mill ________ = ________ per kg.
- [ ] Feed cost = 1,000 × that rate: about **Rs 213,000**.

### E-05 The daily check and a health task

1. Batch → **Today's check**: deaths **10**, cause **Weakness**, feed **900** kg. Save.
2. **Farms → Health & care → Due now** → **Vitamins & electrolytes (arrival)** for `EX-HB-FLOW` → **Done**, today. (The four vaccinations are also overdue because the batch is back-dated; **Skip** each with the reason `Test batch`.)

**Expect**
- [ ] Live birds: **490**.
- [ ] Vitamins in the Expansion 1 store: J + 10 − 1 = J + **9**.
- [ ] The batch's medicine cost is **Rs 450**: one sachet, at the price of the **older** delivery (450), because the delivery that expires first is used first. The ten you bought at 460 are still on the shelf.
- [ ] **No money has moved.**

### E-06 A running cost for the farm

1. **Money → Transactions → Record Treasury Movement.** Manual Outflow, Main Current Account, Rs **6,000**, today, category **Fuel & Gas**, cost centre **Expansion 1** (no batch), counterparty `Lanka IOC`, narrative `Diesel`.
2. Open `EX-HB-FLOW` → **Performance & profit** and find the Fuel & Gas line. Then do the same on `EX-HA-001`.

**Expect**
- [ ] Main Current Account is down by 6,000.
- [ ] The 6,000 is **shared** between the two Expansion 1 batches by bird-days. Each batch's line says "… of … bird-days". The two shares add up to **6,000**.
- [ ] `EX-HB-FLOW` also shows shares of last month's Expansion 1 costs (electricity, bedding) and of admin costs (bank charges, loan interest), because its placement date puts it on the farm last month.

---

## Act 4: Selling

### E-07 Sale, review, part payment

1. **Sales → Sales → New sale.** Buyer **Fresh Mart**, batch `EX-HB-FLOW`, today, **650** per kg. One lorry: `WP LK-4521`, birds **490**, empty **2,000**, loaded **2,980**. Save.
2. Open the sale → **Mark Reviewed**.
3. **Add Receipt**: bank transfer, Rs **400,000**, into Main Current Account, today.

**Expect**
- [ ] 980 kg × 650 = **Rs 637,000**.
- [ ] Outstanding on the sale: **Rs 237,000**.
- [ ] Main Current Account is up by 400,000.
- [ ] **Ledger**: 400,000 in, **Bird Sales**, tagged to `EX-HB-FLOW`.
- [ ] **Sales → Owed to you**: Fresh Mart = H + 237,000, not yet due.
- [ ] The batch's **Performance & profit** shows revenue **637,000**: the full sale, not just what has been paid.

---

## Act 5: The bank and the owner

### E-08 Loan repayment and drawings

1. **Money → Owner & loans** → Commercial Bank → **Record repayment**: principal **50,000**, interest **10,000**, from Main Current Account, today.
2. **Take money out**: Rs **50,000** from Main Current Account, today.

**Expect**
- [ ] Main Current Account is down by 110,000.
- [ ] Loan still owed = I − 50,000.
- [ ] Ledger: **Loan Principal Repayment** 50,000, **Loan Interest** 10,000, **Owner Drawings** 50,000.

---

## Act 6: Tie it together

### E-09 The balances

| | Before | Change | Should now be | Shown |
|---|---|---|---|---|
| Main Current Account | A | + 500,000 − 4,600 − 75,000 − 6,000 + 400,000 − 60,000 − 50,000 = **+ 704,400** | A + 704,400 | |
| Main Cash Safe | B | 0 | B | |
| Farm Petty Cash Float | C | 0 | C | |
| **Cash on hand** | D | **+ 704,400** | D + 704,400 | |

- [ ] **Money → Accounts** and **Home** show the "should now be" figures. On untouched data: Current **4,297,402.31**, cash on hand **4,790,302.31**.

### E-10 Profit & loss

1. **Money → Profit & loss**, this month, Whole business.

| | Change from what you entered |
|---|---|
| Bird Sales | + 400,000 |
| **Income** | **+ 400,000** |
| Medicine & Vaccines | + 4,600 |
| Day-old Chicks | + 75,000 |
| Fuel & Gas | + 6,000 |
| Loan Interest | + 10,000 |
| **Costs** | **+ 95,600** |
| **Net** | **+ 304,400** |

- [ ] Income = E + 400,000. Costs = F + 95,600. Net = G + 304,400.
- [ ] The 500,000 capital, the 50,000 principal and the 50,000 drawings are **not** in it.
- [ ] The 237,000 Fresh Mart still owes is **not** in it either.
- [ ] Choose **Compare**: the 4,600, 75,000 and 6,000 are under **Expansion 1**, with the 400,000 income. Note where the 10,000 interest sits (Admin).

### E-11 Cash flow

1. **Money → Cash flow**, this month, all accounts.

| | Change from what you entered |
|---|---|
| Cash from trading | + 304,400 (the same as the profit & loss net) |
| Owner capital in | + 500,000 |
| Owner drawings | − 50,000 |
| Loan principal repaid | − 50,000 |
| **Owner, loans and advances** | **+ 400,000** |
| **Net change** | **+ 704,400** |

- [ ] The lines have moved by these amounts.
- [ ] **Closing balance** = Cash on hand from E-09. The cash flow explains exactly why cash went up by 704,400: 304,400 from trading and 400,000 net from the owner and the bank.

### E-12 Close the batch

1. **Farms → Batches → EX-HB-FLOW → Close this batch.**

**Expect**
- [ ] 500 placed − 10 died − 490 sold = 0. It closes without asking about missing birds.
- [ ] The frozen figures: revenue **637,000**; mortality **2%**; FCR 900 ÷ 980 = **0.92** (a test figure: this batch was "fed" for one day).
- [ ] House B starts a clean-out under **Health & care → Houses**.
- [ ] **Farms → Batches → Compare closed batches** now lists three batches.

### E-13 Why the batch's profit and the profit & loss differ

Open the closed batch's **Performance & profit**. Fill in the table from the screen.

**The batch's own account**

| | From the screen |
|---|---|
| Revenue | 637,000 |
| Chicks | 75,000 |
| Feed | ____________ (about 213,000) |
| Medicine and stock used on the batch (vitamins) | 450 |
| Its share of farm costs: this month's fuel | ____________ |
| Its share of farm costs from last month (electricity, bedding) | ____________ |
| Its share of admin costs (bank charges, loan interest) | ____________ |
| Labour | ____________ |
| **Total cost** | ____________ |
| **Batch profit** (revenue − total cost) | ____________ |

**From the profit & loss to the batch**

| | |
|---|---|
| Profit & loss net from what you entered (E-10) | 304,400 |
| + The sale not yet paid for (in Owed to you) | + 237,000 |
| + Fuel paid this month that the other Expansion 1 batch carries (6,000 − this batch's share) | + ____________ |
| + Vitamins paid for and still on the shelf (4,600 − 450 used) | + 4,150 |
| + Loan interest paid this month that this batch does not carry (10,000 − its share of this month's interest) | + ____________ |
| − Feed used, which was paid for in earlier months as raw materials and mill costs | − ____________ |
| − Its shares of costs paid in earlier months | − ____________ |
| − Labour | − ____________ |
| **= Batch profit** | ____________ |

- [ ] The second table arrives at the same batch profit as the first. On untouched data it is about **Rs 330,800**.
- [ ] Every line of the batch's cost can be opened to see where it came from.

**In words:** the profit & loss counts money when it moves; the batch counts what it earned and what it used. This batch earned 637,000 but only 400,000 has been paid. It used feed that was paid for months ago. And some of what was paid this month (most of the fuel, most of the vitamins, most of the interest) is not this batch's cost.

### E-14 Follow one rupee back

1. **Money → Profit & loss** → **Bird Sales** → the 400,000.
2. Follow it: ledger line → receipt → sale → lorry → batch.

**Expect**
- [ ] Four steps from a number in a report to the lorry `WP LK-4521` at 2,000 kg empty and 2,980 kg loaded.
- [ ] Each step shows who entered it and when.

---

## Checks that must hold whatever else is in the system

Tick these at any time, on any data:

- [ ] **Home → Cash on hand** = the account balances added together = **Cash flow** closing balance for the current month.
- [ ] **Cash flow → Cash from trading** = **Profit & loss** net for the same period.
- [ ] **Profit & loss → Compare**: the cost centre columns add up to Whole business.
- [ ] Each account's balance = opening balance + everything in − everything out in the **Ledger** for that account.
- [ ] **Sales → Owed to you** total = Home's Owed to you. **Money → Payables** total = Home's You owe suppliers.
- [ ] A loan's "still owed" = amount received − principal repaid. Interest never reduces it.
- [ ] No ledger line is **Uncategorized**.

## Questions for accounts and the owner

1. Would you trust these numbers? What would you check them against?
2. Is a cash-basis profit & loss what you want each month, or do you want sales counted when invoiced?
3. Is sharing a farm's costs between its batches by bird-days fair in your view?
4. Should loan interest and bank charges be shared across batches, or kept apart as a business cost?
5. The chicks were entered twice: once as a placement (the batch's cost) and once as a payment (the money). Is that clear, or would you expect one entry?
6. Paying for the chicks is a hand-entered movement, not a supplier invoice. Would you rather buy chicks through a purchase order?
7. What did you expect to see that was not there (a balance sheet, VAT, depreciation)?

## Passed when

Tables E-09, E-10 and E-11 match the screen to the rupee, and the two tables in E-13 arrive at the same batch profit.
