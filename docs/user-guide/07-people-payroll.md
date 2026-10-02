# 07 People and payroll

For accounts and the owner. Farm managers use **Attendance**.

**People** in the top bar has three pages: **Employees**, **Attendance** and **Payroll**.

---

## Employees

**People → Employees → add employee.**

| Section | What to enter |
|---|---|
| Personal | Name, contact, start date, job |
| Where they work | Farm, Feed Mill or Admin. This decides where their wages are charged |
| Pay | Basic pay, employment type, recurring allowances and deductions |
| EPF | EPF number, and tick **EPF member**. Leave it unticked for casual workers |
| Bank | Account details for the bank transfer list |
| Emergency contact, documents | Next of kin; scanned ID, contract and so on |

On each allowance, tick **Counts for EPF/ETF** if it is part of the earnings EPF is worked out on.

**Compensation Templates** (on the payroll screens) hold standard pay setups you can apply to several people.

When someone leaves, end their employment on their record rather than deleting them. Their history stays.

## Attendance

**People → Attendance** has three tabs.

| Tab | Use |
|---|---|
| **Attendance** | **Record Attendance** for one person, or **Bulk Record Attendance** for a whole farm and day |
| **Leave Balances** | Days of each leave type each person has. **Set Leave Balance** or **Bulk Set Leave Balances** |
| **Shifts** | Shift names and times |

Marking someone on leave takes a day from their balance.

**Attendance matters for pay.** Basic pay is worked out as basic ÷ working days × days attended. Mark attendance for the whole month before generating payroll.

## Payroll

**People → Payroll.**

### Advances and loans

**Advances & loans → Advance or loan.**

- **Salary advance:** paid now, taken back in full from the next pay.
- **Staff loan:** paid now, taken back in monthly instalments.

Choose the account it's paid from. It goes out of that account as **Staff Advances & Loans** (not a cost: it comes back).

It is taken back from pay automatically, but never more than the pay left after EPF. Whatever couldn't be taken carries to next month. Staff can also repay directly (**paid back directly**), and a debt that won't be recovered can be written off.

### The monthly route

```
Generate  →  Review  →  Approve  →  Pay  →  Pay EPF/ETF
```

**1. Generate.** **Pay runs → Generate Payroll**, choose the month. The preview shows for each person: basic pay for days attended, allowances, EPF, and any advance or instalment being taken back. Check it, then generate. (**Create Payroll** makes one for a single person.)

**2. Review.** Open each payroll. Add one-off items with **Add Allowance** or **Add Deduction**. Gross and net update. Mark it **Reviewed**.

**3. Approve.** Mark it **Approved**. Status only moves forward: draft → reviewed → approved → paid. A draft can be deleted; nothing later can.

**4. Pay.** **Month & payslips** shows the month's register and totals: gross, net, employer EPF + ETF, and total labour cost.

- **Pay all approved:** choose the account and method.
- **Bank transfer list (CSV):** for the bank. It warns about anyone with no bank details.
- **Payslips (PDF):** one or all.
- **Register (CSV).**

**5. Pay EPF/ETF.** **EPF / ETF** shows the month's return: each member's earnings, the employee's 8%, the employer's 12%, and ETF 3%. After paying the fund, use **Pay EPF/ETF** with the account and reference. It can be paid once per month.

### How pay is worked out

```
Basic for days attended   = basic ÷ working days × days attended
Gross                     = basic for days attended + allowances + overtime
EPF earnings              = basic for days attended + allowances that count for EPF
Employee EPF (8%)         = taken from pay
Net pay                   = gross − employee EPF − other deductions − advance taken back

Employer EPF (12%) and ETF (3%) are extra costs to the business, not taken from pay.
```

The rates are set under **Settings → Payroll** and are fixed on each payroll when it's generated, so a later rate change doesn't alter past months.

### What happens in the money ledger

When a payroll is paid, only **net pay** leaves the bank. The ledger shows three lines so the full story is there:

| Line | Direction | Category |
|---|---|---|
| Full wage | Out | Wages & Salaries |
| EPF kept back from the employee | In | EPF Withheld |
| Advance taken back | In | Staff Advances & Loans |

When EPF/ETF is paid over:

| Line | Direction | Category |
|---|---|---|
| Employee's 8% (already kept back) | Out | EPF Withheld |
| Employer's 12% + 3% | Out | EPF / ETF Contributions |

Wages and employer contributions are charged to each employee's farm, the mill or admin. In batch costs, labour is gross pay plus employer EPF/ETF, shared by bird-days.

## Common questions

**Net pay looks too low.**
Check attendance for the month, then advances being taken back.

**Someone has no EPF on their payslip.**
EPF member isn't ticked on their employee record.

**The advance wasn't fully taken back.**
Pay after EPF wasn't enough. The rest carries forward.

**I approved a payroll with a mistake.**
If it isn't paid yet, ask an admin. If it's paid, correct it with an adjustment in next month's payroll.

**Pay EPF/ETF is refused.**
The month's payroll isn't all paid yet, or EPF/ETF for that month has already been paid.
