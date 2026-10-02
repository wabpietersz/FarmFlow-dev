# Finance demo script

Set up first: see [README.md](README.md). All amounts in rupees. **Say** lines are suggestions; use your own words.

Running balances are shown after each step as:
`Current` (Main Current Account) · `Safe` (Main Cash Safe) · `Petty` (Farm Petty Cash Float)

**Start:** Current 750,000 · Safe 120,000 · Petty 0 · **Total 870,000**

---

## Opening (3 min)

Show [Money-Map.md](Money-Map.md).

**Say:** "Every rupee that moves gets three labels: what it was for, where it belongs, and the document behind it. Nobody types a balance or a report. We'll follow one batch of 1,000 birds from the day you fund it to the day it's sold, and then check that the bank balances, the batch's profit and the month's profit & loss all agree."

Show **Home**: cash on hand 870,000.

---

## Act 1: Funding the business (4 min)

| # | Where | Do | Balances after |
|---|---|---|---|
| 1.1 | Money → Owner & loans → **Put money in** | 2,000,000 into Main Current Account | Current 2,750,000 |
| 1.2 | Money → Owner & loans → **Loan received** | Lender "Demo Bank", 1,000,000, term 20 months, into Main Current Account | Current 3,750,000 |

**Show:** Money → **Profit & loss**. Income is still zero.

**Say:** "Three million came in and none of it is income. Your own money and borrowed money are never counted as profit. They show in the cash flow, under owner and loans."

---

## Act 2: Buying (6 min)

| # | Where | Do | Balances after |
|---|---|---|---|
| 2.1 | Stock → Purchase orders | PO to Agri Feeds: Corn 3,200 kg @ 120 = 384,000; Newcastle vaccine 1,000 doses @ 5 = 5,000. **Total 389,000**. Submit | no change |
| 2.2 | PO → **Receive** | Corn into **Feed Mill store**. Vaccine into **Main Farm store**, with an expiry date next year. (Two receipts if the screen takes one store per receipt) | no change |
| 2.3 | Stock → Invoices | Record invoice 389,000. Match shows **Matches goods**. Approve (Farm control) | no change |
| 2.4 | Invoice → **Record Supplier Payment** | 389,000 from Main Current Account | Current 3,361,000 |

**Show:** Money → **Ledger**. The one payment appears as two lines: Feed Raw Materials 384,000 and Medicine & Vaccines 5,000.

**Say:** "Receiving the goods didn't move any money. It put stock on the shelf with its price attached. The money moved when we paid, and the system split the payment by what was bought. Nobody chose those categories; they come from the item types."

---

## Act 3: The batch and the mill (8 min)

| # | Where | Do | Balances after |
|---|---|---|---|
| 3.1 | Farms → Batches → **New batch** | Main Farm, House 1, 1,000 chicks, placed on the 1st | no change |
| 3.2 | Batch → **Chick Placement** | 1,000 chicks, cost 150 each = 150,000 | no change |
| 3.3 | Money → Transactions → **Record Treasury Movement** | Manual Outflow 150,000 from Main Current Account. Category **Day-old Chicks**, cost centre Main Farm, batch = this batch | Current 3,211,000 |
| 3.4 | Feed mill → Production → **New Production Batch**, then **Complete Production** | Demo Grower, 3,200 kg made, using 3,200 kg Corn, no waste | no change |
| 3.5 | Money → Transactions → **Record Treasury Movement** | Manual Outflow 16,000 from Main Current Account. Category **Electricity**, cost centre **Feed Mill** | Current 3,195,000 |
| 3.6 | Feed mill → Distribution → **New Distribution** | 3,200 kg from that run to the batch | no change |
| 3.7 | Farms → Health & houses → Due now | Mark the Newcastle vaccination **Done** | no change |
| 3.8 | Batch → Today's check | Over the batch's life, deaths total **20** (one entry of 20 is enough for the demo). Feed used total 3,200 kg | no change |

**Show:**
- Feed mill → Production → **Cost Breakdown**: materials 384,000 ÷ 3,200 kg = **120 per kg**.
- Reports → **Cost Allocation**: mill overhead 16,000 ÷ 3,200 kg = **5 per kg**.
- Batch → **Performance & profit**: feed = 3,200 × 125 = **400,000**.

**Say:** "The mill doesn't sell feed to the farm at a made-up price. The batch is charged what the feed really cost: the corn at the price we paid, plus the mill's electricity spread over every kilo made this month. If the mill had wages, they'd be in there too."

**Say:** "Notice that making feed, sending it to the farm and giving the vaccine moved no money at all. They moved *cost* from the shelf to the batch."

---

## Act 4: Running costs and wages (8 min)

| # | Where | Do | Balances after |
|---|---|---|---|
| 4.1 | Money → Petty Cash → **Allocate Petty Cash** | 20,000 from Main Cash Safe to the Farm Petty Cash Float | Safe 100,000 · Petty 20,000 |
| 4.2 | Money → Petty Cash → **Submit Petty Cash Expense**, then review it | 8,000, category **Fuel & Gas**, Main Farm | Petty 12,000 |
| 4.3 | Money → Transactions → **Record Treasury Movement** | Manual Outflow 1,000 from Main Current Account, category **Bank Charges**, cost centre **Admin** | Current 3,194,000 |
| 4.4 | People → Payroll → Advances & loans | Salary advance 5,000 to Demo Worker from Main Cash Safe, taken back this month | Safe 95,000 |
| 4.5 | People → Payroll → **Generate Payroll** for the month. Review, approve | Preview: basic 40,000, EPF 3,200, advance 5,000, **net 31,800** | no change |
| 4.6 | Month & payslips → **Pay all approved** | From Main Current Account | Current 3,162,200 |
| 4.7 | Payroll → EPF / ETF → **Pay EPF/ETF** | 9,200 from Main Current Account (3,200 employee + 4,800 employer EPF + 1,200 ETF) | Current 3,153,000 |

**Show:** Money → **Ledger**, the payroll payment:

| Line | In | Out | Category |
|---|---|---|---|
| Wages | | 40,000 | Wages & Salaries |
| EPF kept back | 3,200 | | EPF Withheld |
| Advance taken back | 5,000 | | Staff Advances & Loans |
| **Net effect on the bank** | | **31,800** | |

**Say:** "Only 31,800 left the bank, but the business's wage cost is 40,000, and the ledger says so. The 3,200 is the worker's money that we hold until we pay it to the fund. The 5,000 advance was never a cost: it went out last week and came back today."

**Say:** "When we paid the fund 9,200, only 6,000 of it was a new cost: the employer's share. The other 3,200 was the worker's own money passing through."

**Show:** the payslip PDF.

---

## Act 5: Selling (6 min)

| # | Where | Do | Balances after |
|---|---|---|---|
| 5.1 | Sales → Bookings → **Book a catch** | Fresh Mart, this batch, 980 birds, 2.0 kg, 650 per kg | no change |
| 5.2 | Booking → **Make the sale** | One lorry: 980 birds, empty 3,000 kg, loaded 4,960 kg → 1,960 kg × 650 = **1,274,000** | no change |
| 5.3 | Sale → **Mark Reviewed** → **Add Receipt** | 1,000,000 by bank into Main Current Account | Current 4,153,000 |
| 5.4 | Sales → **Other income** | Litter, 50 bags × 200 = 10,000, Fresh Mart, Main Farm, **no batch**. Review. Receipt 10,000 cash into Main Cash Safe | Safe 105,000 |

**Show:**
- Sales → **Owed to you**: Fresh Mart 274,000, not yet due.
- Money → Ledger: 1,000,000 as **Bird Sales** tagged to the batch; 10,000 as **Other Farm Income**.

**Say:** "The sale is worth 1,274,000. We've been paid a million. The 274,000 isn't lost and isn't income yet; it sits in Owed to you with a due date, and it'll turn up on Home if it goes late."

---

## Act 6: Loan and owner (3 min)

| # | Where | Do | Balances after |
|---|---|---|---|
| 6.1 | Money → Owner & loans → **Record repayment** | Principal 50,000 + interest 10,000 = 60,000 from Main Current Account | Current 4,093,000 |
| 6.2 | Money → Owner & loans → **Take money out** | 100,000 from Main Current Account | Current 3,993,000 |

**Show:** the loan register: 950,000 still owed.

**Say:** "Sixty thousand went to the bank. Fifty reduced what we owe; only the ten of interest is a cost. And the hundred thousand you took out is not a business expense, so it won't reduce the profit."

**End balances:** Current 3,993,000 · Safe 105,000 · Petty 12,000 · **Total 4,110,000**

---

## Act 7: The tie-out (12 min)

This is the part that matters. Take it slowly. Hand out [Tie-Out-Sheet.md](Tie-Out-Sheet.md).

### 7.1 The balances

**Show:** Home → Cash on hand **4,110,000**. Money → Accounts: 3,993,000 / 105,000 / 12,000.

**Say:** "We started with 870,000 and now have 4,110,000. Up 3,240,000. Let's see whether the reports can explain exactly that."

### 7.2 Profit & loss

**Show:** Money → **Profit & loss**, this month, Whole business.

| | |
|---|---|
| Bird Sales | 1,000,000 |
| Other Farm Income | 10,000 |
| **Income** | **1,010,000** |
| Day-old Chicks | 150,000 |
| Feed Raw Materials | 384,000 |
| Medicine & Vaccines | 5,000 |
| Electricity | 16,000 |
| Fuel & Gas | 8,000 |
| Wages & Salaries | 40,000 |
| EPF / ETF Contributions | 6,000 |
| Bank Charges | 1,000 |
| Loan Interest | 10,000 |
| **Costs** | **620,000** |
| **Net** | **390,000** |

Then choose **Compare**: Main Farm, Feed Mill and Admin side by side.

**Say:** "Three hundred and ninety thousand from trading. No capital, no loan, no drawings in here."

### 7.3 Cash flow

**Show:** Money → **Cash flow**, this month, all accounts.

| | |
|---|---|
| Opening balance | 870,000 |
| Cash from trading | + 390,000 |
| Owner capital in | + 2,000,000 |
| Owner drawings | − 100,000 |
| Loan received | + 1,000,000 |
| Loan principal repaid | − 50,000 |
| Staff advances (5,000 out, 5,000 back) | 0 |
| EPF withheld (3,200 in, 3,200 out) | 0 |
| **Closing balance** | **4,110,000** |

**Say:** "Trading made 390,000. You and the bank put in a net 2,850,000. Together that's the 3,240,000 increase, to the rupee. The closing figure is the same number as Home."

### 7.4 The batch

**Show:** Batch → **Performance & profit**.

| | |
|---|---|
| Chicks | 150,000 |
| Feed (3,200 kg × 125) | 400,000 |
| Vaccine used | doses used × 5 |
| Labour (40,000 + 6,000 employer EPF/ETF) | 46,000 |
| Farm costs (fuel) | 8,000 |
| Admin share (bank charges, loan interest) | up to 11,000 |
| **Total cost** | **615,000 + vaccine used (620,000 if all 1,000 doses are used)** |
| Revenue | 1,274,000 |
| **Profit** | **about 654,000** |
| FCR | 3,200 ÷ 1,960 = 1.63 |
| Mortality | 20 ÷ 1,000 = 2% |

**Say:** "The batch made about 654,000. The profit & loss says 390,000. Both are right, and here is the whole difference."

### 7.5 Why the two profits differ

**Show:** the reconciliation on the Tie-Out Sheet.

| | |
|---|---|
| Profit & loss net | 390,000 |
| + Sale not yet paid for (in Owed to you) | + 274,000 |
| − Litter income (not a batch sale) | − 10,000 |
| + Vaccine paid for but still on the shelf | + (5,000 − vaccine used) |
| = Batch profit | ≈ 654,000 + unused vaccine |

**Say:** "The profit & loss counts money when it moves. The batch counts what it earned and what it used. When Fresh Mart pays the 274,000, the profit & loss catches up. The vaccine still in the fridge is paid for but hasn't been charged to any batch yet."

### 7.6 Follow one rupee back

Pick the Bird Sales line in the profit & loss.

**Do:** Ledger → filter category Bird Sales → open the line → the receipt → the sale → the lorry weights → the batch.

**Say:** "From a number in a report to the lorry on the weighbridge in four taps. Every line works that way, and each one shows who entered it and who approved it."

### 7.7 Close and lock

**Do:** Batch → **Close this batch**. 1,000 placed − 20 died − 980 sold = 0, so it closes cleanly.

**Say:** "These numbers are now frozen. If a late cost turns up, the system tells us; it won't quietly change a closed batch."

**Mention:** Farm control → Period locks does the same for a whole month.

---

## Closing (2 min)

Show [Money-Map.md](Money-Map.md) again.

**Say:** "Everything you saw was entered once, by the person doing the job: the store keeper receiving corn, the manager doing the daily check, accounts taking a receipt. The reports are just those entries added up in different ways."

**Be clear about what isn't there:**
- No balance sheet or trial balance yet. This is a cash ledger, built so a full double-entry ledger can be added later.
- Profit & loss is cash-basis. An invoiced view would be an addition.
- No VAT, SSCL or APIT; only EPF/ETF.
- No fixed assets or depreciation.

## Questions to ask the audience

1. Would you trust these numbers? What would you check them against?
2. Is a cash-basis profit & loss what you want to see each month, or do you want sales counted when invoiced?
3. Is splitting shared costs by bird-days fair in your view?
4. Should loan interest and bank charges be shared across batches, or kept apart as a business cost?
5. Are the categories the ones you'd use?
6. What report do you look at today that you didn't see here?
7. Which part would you want to see again more slowly?

Add the answers to the rollout feedback sheet ([../rollout/README.md](../rollout/README.md)).

## Questions you will probably get

| Question | Answer |
|---|---|
| "Why is profit different in two places?" | Section 7.5. Timing: money received against value earned; stock paid against stock used. |
| "Where's the 274,000?" | Sales → Owed to you. |
| "Why isn't my capital income?" | It's your money, not earnings. It's in the cash flow. |
| "What if someone enters the wrong category?" | Ledger → re-tag. The audit trail records who changed it. |
| "What if someone enters a wrong amount?" | Reverse and re-enter. The original stays visible. |
| "Can someone pay themselves?" | Over-limit payments wait for approval, and nobody approves their own. Set the limits in Settings → Approvals. |
| "What if two batches are on the farm?" | Farm costs and wages are split by bird-days: birds × days each batch was there. |
| "What if the farm is empty for a month?" | Its costs show under Reports → Cost Allocation as *not charged*. |
| "Does this match the bank statement?" | The balances should. Differences are uncleared cheques or entries not yet made. |
