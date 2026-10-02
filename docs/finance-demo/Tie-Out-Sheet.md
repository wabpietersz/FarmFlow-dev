# Tie-out sheet

The expected numbers at the end of the finance demo ([Demo-Script.md](Demo-Script.md)), and how they reconcile. All amounts in rupees.

**For the rehearsal:** tick each figure against the screen. Lines marked ⚠ depend on setup or on behaviour not confirmed by a live run; if they differ, note the actual figure and why.

## 1. Every money movement

| Step | What | Account | In | Out | Category | Cost centre |
|---|---|---|---|---|---|---|
| 1.1 | Owner puts money in | Current | 2,000,000 | | Owner Capital Introduced | — |
| 1.2 | Loan received | Current | 1,000,000 | | Loan Received | — |
| 2.4 | Pay Agri Feeds: corn | Current | | 384,000 | Feed Raw Materials | Feed Mill ⚠ |
| 2.4 | Pay Agri Feeds: vaccine | Current | | 5,000 | Medicine & Vaccines | Main Farm ⚠ |
| 3.3 | Chicks | Current | | 150,000 | Day-old Chicks | Main Farm / batch |
| 3.5 | Mill electricity | Current | | 16,000 | Electricity | Feed Mill |
| 4.1 | Petty cash float | Safe → Petty | 20,000 | 20,000 | Internal Transfer | — |
| 4.2 | Fuel from petty cash | Petty | | 8,000 | Fuel & Gas | Main Farm |
| 4.3 | Bank charges | Current | | 1,000 | Bank Charges | Admin |
| 4.4 | Salary advance | Safe | | 5,000 | Staff Advances & Loans | — |
| 4.6 | Wages | Current | | 40,000 | Wages & Salaries | Main Farm |
| 4.6 | EPF kept back | Current | 3,200 | | EPF Withheld | — |
| 4.6 | Advance taken back | Current | 5,000 | | Staff Advances & Loans | — |
| 4.7 | EPF paid over: employee share | Current | | 3,200 | EPF Withheld | — |
| 4.7 | EPF/ETF paid over: employer share | Current | | 6,000 | EPF / ETF Contributions | Main Farm |
| 5.3 | Fresh Mart receipt | Current | 1,000,000 | | Bird Sales | Main Farm / batch |
| 5.4 | Litter | Safe | 10,000 | | Other Farm Income | Main Farm |
| 6.1 | Loan principal | Current | | 50,000 | Loan Principal Repayment | — |
| 6.1 | Loan interest | Current | | 10,000 | Loan Interest | ⚠ |
| 6.2 | Owner takes money out | Current | | 100,000 | Owner Drawings | — |

⚠ The cost centre on each supplier payment line follows the purchase order. If one PO can only carry one cost centre, raise two POs (corn for the Feed Mill, vaccine for Main Farm).
⚠ Note which cost centre the loan interest lands on. It decides whether interest is shared to batches.

## 2. Account balances

| Account | Opening | In | Out | Closing | ✓ |
|---|---|---|---|---|---|
| Main Current Account | 750,000 | 4,008,200 | 765,200 | **3,993,000** | |
| Main Cash Safe | 120,000 | 10,000 | 25,000 | **105,000** | |
| Farm Petty Cash Float | 0 | 20,000 | 8,000 | **12,000** | |
| **Total** | **870,000** | | | **4,110,000** | |

Main Current, in: 2,000,000 + 1,000,000 + 3,200 + 5,000 + 1,000,000 = 4,008,200.
Main Current, out: 384,000 + 5,000 + 150,000 + 16,000 + 1,000 + 40,000 + 3,200 + 6,000 + 50,000 + 10,000 + 100,000 = 765,200.

**Check:** Home → Cash on hand = 4,110,000.

## 3. Profit & loss (this month, whole business)

| Income | | ✓ |
|---|---|---|
| Bird Sales | 1,000,000 | |
| Other Farm Income | 10,000 | |
| **Total income** | **1,010,000** | |

| Costs | | ✓ |
|---|---|---|
| Day-old Chicks | 150,000 | |
| Feed Raw Materials | 384,000 | |
| Medicine & Vaccines | 5,000 | |
| Electricity | 16,000 | |
| Fuel & Gas | 8,000 | |
| Wages & Salaries | 40,000 | |
| EPF / ETF Contributions | 6,000 | |
| Bank Charges | 1,000 | |
| Loan Interest | 10,000 | |
| **Total costs** | **620,000** | |

| **Net** | **390,000** | |
|---|---|---|

By cost centre (Compare) ⚠:

| | Main Farm | Feed Mill | Admin / not tagged |
|---|---|---|---|
| Income | 1,010,000 | | |
| Costs | 209,000 | 400,000 | 11,000 |
| Net | 801,000 | −400,000 | −11,000 |

Main Farm costs: chicks 150,000 + vaccine 5,000 + fuel 8,000 + wages 40,000 + EPF/ETF 6,000.
Feed Mill costs: corn 384,000 + electricity 16,000. The mill shows a loss here because the profit & loss follows money; the mill has no income. Its cost reaches the farm's batches through feed.

## 4. Cash flow (this month, all accounts)

| | | ✓ |
|---|---|---|
| Opening balance | 870,000 | |
| **Cash from trading** | **390,000** | |
| Owner capital in | 2,000,000 | |
| Owner drawings | −100,000 | |
| Loan received | 1,000,000 | |
| Loan principal repaid | −50,000 | |
| Staff advances (−5,000 + 5,000) | 0 | |
| EPF withheld (+3,200 − 3,200) | 0 | |
| **Owner, loans and advances** | **2,850,000** | |
| **Net change** | **3,240,000** | |
| **Closing balance** | **4,110,000** | |

**Check:** closing balance = section 2 total.

## 5. Feed cost

| | | ✓ |
|---|---|---|
| Corn used | 3,200 kg × 120 = 384,000 | |
| Feed made | 3,200 kg | |
| Materials per kg | 120.00 | |
| Mill overhead for the month | 16,000 | |
| Overhead per kg | 16,000 ÷ 3,200 = 5.00 | |
| **Feed cost per kg** | **125.00** | |
| Charged to the batch | 3,200 × 125 = **400,000** | |

## 6. Payroll

| | | ✓ |
|---|---|---|
| Basic (full attendance) ⚠ | 40,000 | |
| Employee EPF 8% | 3,200 | |
| Advance taken back | 5,000 | |
| **Net pay** | **31,800** | |
| Employer EPF 12% | 4,800 | |
| ETF 3% | 1,200 | |
| **Paid to the funds** | **9,200** | |
| **Labour cost to the business** | 40,000 + 6,000 = **46,000** | |

⚠ Basic is pro-rated by attendance. If any working day is unmarked, basic and everything below it will be lower.

## 7. Batch cost and profit

Let **V** = cost of vaccine used on the health task (doses used × 5). Write the actual figure here: V = ______

| | | ✓ |
|---|---|---|
| Chicks | 150,000 | |
| Feed | 400,000 | |
| Vaccine used | V | |
| Labour | 46,000 | |
| Farm costs (fuel) | 8,000 | |
| Admin share ⚠ | 1,000 bank charges, plus 10,000 loan interest if it is tagged to Admin | |
| **Total cost** | 604,000 + V + admin share | |
| Revenue | 1,274,000 | |
| **Profit** | 670,000 − V − admin share | |

With V = 5,000 (all 1,000 doses used) and admin share 11,000: cost **620,000**, profit **654,000**.

| Results | | ✓ |
|---|---|---|
| Birds sold | 980 | |
| Mortality | 20 ÷ 1,000 = 2.0% | |
| Live weight sold | 1,960 kg | |
| FCR | 3,200 ÷ 1,960 = 1.63 | |
| Cost per kg | total cost ÷ 1,960 (about 316) | |
| Birds accounted for | 1,000 − 20 − 980 = 0 | |

## 8. Why batch profit and the profit & loss differ

| | |
|---|---|
| Profit & loss net | 390,000 |
| + Sale invoiced but not yet received (Owed to you) | + 274,000 |
| − Litter income (not tagged to the batch) | − 10,000 |
| + Vaccine paid for but not used (still in stock) | + (5,000 − V) |
| + Admin costs not charged to the batch, if any ⚠ | + (11,000 − admin share) |
| **= Batch profit** | **670,000 − V − admin share** |

With V = 5,000 and admin share 11,000: 390,000 + 274,000 − 10,000 + 0 + 0 = **654,000**, the same as section 7.

In that case the batch's total cost (620,000) equals the profit & loss costs (620,000): every rupee spent this month ended up in the one batch. The whole difference between the two profits is the 274,000 not yet received, less the 10,000 of litter.

At the rehearsal, recompute this section with the V and admin share you see on screen. If the two profits still don't reconcile, a cost has reached one view and not the other; find it before presenting.

## 9. Other screens

| Screen | Expect | ✓ |
|---|---|---|
| Sales → Owed to you | Fresh Mart 274,000, not yet due | |
| Money → Payables | Nothing owed to Agri Feeds | |
| Money → Owner & loans | Demo Bank: 950,000 still owed | |
| Payroll → Advances & loans | Advance paid back | |
| Payroll → EPF / ETF | Paid | |
| Stock → Stores | Corn 0 in Feed Mill store; vaccine (1,000 − doses used) in Main Farm store | |
| Money → Ledger | No Uncategorized lines | |
| Reports → Cost Allocation | Mill overhead 16,000 over 3,200 kg; farm pool fully charged | |

## 10. Rehearsal notes

| Figure | Expected | Seen | Reason for difference |
|---|---|---|---|
| | | | |
