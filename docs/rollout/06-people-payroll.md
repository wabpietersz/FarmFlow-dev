# Session 4: People and payroll

**With:** whoever prepares payroll, and the owner (who approves it).
**Time:** 90 minutes.
**Guide:** [../user-guide/07-people-payroll.md](../user-guide/07-people-payroll.md)
**Before:** made-up employees on each farm, the mill and admin, with pay set up; shifts; money accounts. **No real salaries or bank details on the test instance.**

## Ask first: how it's done today

- Who is paid monthly, who daily, who by piece?
- How is attendance recorded, and by whom, on each farm?
- How is overtime agreed and paid?
- How are advances given and taken back?
- Who is in EPF/ETF and who isn't? How is the monthly return prepared?
- How are people paid: bank transfer, cash, both?
- Who checks payroll before the money goes?

## Scripted steps

The route: **advance → attendance → generate → review → approve → pay → EPF/ETF**.

| ID | Step | Expected | ✓ |
|---|---|---|---|
| P-1 | **People → Employees**: add an employee with farm, pay, EPF number, EPF member ticked, bank details. | Saved; cost centre follows the farm | |
| P-2 | Edit another employee: untick EPF member (casual). | Saved | |
| P-3 | Add an allowance and tick **Counts for EPF/ETF**; add another without it. | Both show in pay setup | |
| P-4 | **Attendance → Bulk Record Attendance** for a farm for several days. Mark one person absent and one on leave. | Summary counts match; leave balance drops for the person on leave | |
| P-5 | **Payroll → Advances & loans**: a salary advance to one person (from cash), and a loan with monthly instalments to another (from bank). | Both "Recovering"; **Money → Ledger** shows two outflows as Staff Advances & Loans | |
| P-6 | **Pay runs → Generate Payroll** for the month. Read the preview. | EPF 8% on basic + EPF-counting allowances for members only; advance and instalment shown; non-member has no EPF; pay is pro-rated by days attended | |
| P-7 | Generate. Open one payroll; add a one-off allowance and a deduction. | Gross and net recalculate | |
| P-8 | **Review** then **Approve** each (approver must be a different person if approvals are set that way). | Status moves forward only | |
| P-9 | **Month & payslips**: read the totals cards. | Gross, net, employer EPF + ETF and labour cost add up by hand | |
| P-10 | Download one **payslip** and the **bank transfer list**. | Payslip shows EPF, advance and employer contributions; the list warns about anyone with no bank details | |
| P-11 | **Pay all approved** from the bank account. | Bank balance drops by total **net** pay only; advance shows paid back; loan balance reduced by one instalment | |
| P-12 | **Money → Ledger** for one payment. | Wages out (gross), EPF withheld in, advance recovered in | |
| P-13 | **EPF / ETF** for the month. | EPF total = 20% and ETF = 3% of members' EPF earnings; non-members absent | |
| P-14 | **Pay EPF/ETF** with a reference. | Shows Paid; ledger shows the employer share as EPF/ETF expense split by each employee's farm, mill or admin | |
| P-15 | **Advances & loans → paid back directly**: a cash repayment on the loan. | Balance drops; cash account goes up | |
| P-16 | A batch on that farm → Performance & profit. | Labour = gross + employer EPF/ETF for that farm's staff, shared by bird-days | |

## Should be refused

| ID | Try | Expected |
|---|---|---|
| P-R1 | An advance recovery larger than the pay left after EPF | Recovery is capped; net pay never goes negative |
| P-R2 | Pay EPF/ETF twice for the same month | Refused |
| P-R3 | Move a paid payroll back to draft | Refused |
| P-R4 | Generate payroll twice for the same person and month | Refused or skipped |
| P-R5 | A farm manager opens payroll for another farm's staff | Refused |
| P-R6 | A farm worker opens the Payroll page | Not authorised |

## Feedback to draw out

- Does pro-rating by attended days match how monthly staff are really paid? What about paid leave and public holidays?
- Are daily-paid and casual workers handled the way you pay them?
- Is overtime entered where you'd expect?
- Which earnings count for EPF in your practice? Does the tick box cover it?
- Does the EPF/ETF return give you what the C-form needs?
- Does the bank transfer list match your bank's upload format?
- Would the payslip be given to staff as it is?
- Who should be allowed to see salaries? Is the access matrix tight enough?

## Passed when

A full month has been generated, approved, paid and the EPF/ETF return paid, with net pay, EPF and the bank movement checked by hand for at least two employees.
