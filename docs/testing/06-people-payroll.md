# Test plan 06: People and payroll

**For:** whoever prepares payroll, and the owner (who approves it).
**Time:** about 90 minutes.
**Sign in as:** a system admin (first round), or Ruwan Fernando (accountant). The access checks use Nimal Perera and Sunil Bandara.
**Have open:** [Test-Data-Sheet.md](Test-Data-Sheet.md), section 6 (employees, the expected pay table, advances and loans). You will check the app against the **"What last month's payroll should come to"** table.
**User guide:** [People and payroll](../user-guide/07-people-payroll.md).

The route being tested: **attendance → advance → generate → review → approve → pay → EPF/ETF**.

In this plan **last month** means the month before the one you are in, and **two months ago** the one before that. The data sheet names them.

**What you will use** (already in the system):

| Record | How to recognise it |
|---|---|
| Eight employees | Six on the two farms, the mill operator (wages go to the Feed Mill), the accountant (wages go to Admin). Everyone is made up: no real salaries |
| Attendance | Recorded for every working day (Monday to Saturday) of the last two months. Last month Kumari Dias was absent two days and Priya Rajapaksa took one day of casual leave |
| Payroll for two months ago | Generated, approved, **paid**, EPF/ETF paid |
| Payroll for last month | **Not yet run.** You will run it |
| A salary advance | Sunil Bandara, Rs 10,000, to be taken back from last month's pay |
| A staff loan | Kamal Silva, Rs 60,000 at Rs 10,000 a month. One instalment taken back so far: Rs 50,000 still owed |

---

## Part 1: Employees and attendance

### P-01 Read an employee's record

1. **People → Employees.** Open **Sunil Bandara**.

**Expect**
- [ ] Main Farm, Worker, permanent. EPF number EPF-1002, EPF member ticked.
- [ ] Pay: Rs 45,000 a month, plus **Cost of living allowance** Rs 3,500, which **counts for EPF/ETF**.
- [ ] Bank details and an emergency contact are filled in.
- [ ] Open **Nimal Perera**: his Transport allowance of Rs 5,000 does **not** count for EPF.
- [ ] Open **Ajith Kumara**: seasonal, Rs 2,000 a day, **not** an EPF member, no bank details.

### P-02 Attendance already recorded

1. **People → Attendance.** Choose last month.

**Expect**
- [ ] Every Monday to Saturday has a record for each permanent employee. Sundays have none.
- [ ] **Kumari Dias**: absent on two days. **Priya Rajapaksa**: one day of casual leave. The dates are in the data sheet under "Days not worked".
- [ ] **Ajith Kumara**: Mondays, Wednesdays and Fridays only.

### P-03 Mark today's attendance for a farm

1. **Attendance → Bulk Record Attendance.** Date **today**. Farm **Main Farm**. Shift **Day shift**.
2. Mark everyone **present**, except: **Kumari Dias absent**, and **Sunil Bandara on leave**, leave type **casual**. Save.
3. Open the **Leave Balances** tab.

**Expect**
- [ ] The day's summary shows the right counts of present, absent and on leave.
- [ ] Sunil Bandara's casual leave shows **1** day used of 7.
- [ ] Recording the same day again for the same people is refused or updates the existing records. It must not create duplicates.

---

## Part 2: Advances and loans

### P-04 What is already owed

1. **People → Payroll → Advances & loans.**

**Expect**
- [ ] Sunil Bandara: advance Rs 10,000, nothing taken back yet, **recovering**.
- [ ] Kamal Silva: loan Rs 60,000, Rs 10,000 taken back, **Rs 50,000** still owed.

### P-05 Give a new advance

1. **Advances & loans → Advance or loan.**
2. Employee **Priya Rajapaksa**, type **salary advance**, amount **8,000**, paid today from **Main Cash Safe** in cash, taken back from **this month**. Save.

**Expect**
- [ ] It is listed as recovering.
- [ ] **Money → Ledger**: Rs 8,000 out of Main Cash Safe, category **Staff Advances & Loans**. It is not a cost.
- [ ] Main Cash Safe is down by 8,000.
- [ ] It does **not** appear in last month's payroll below, because it is to be taken back from this month.

---

## Part 3: A month's payroll

### P-06 Generate last month's payroll

1. **People → Payroll → Pay runs → Generate Payroll.** Choose **last month**.
2. Read the preview carefully **before** generating. Compare each person with the data sheet's expected pay table.

**Expect in the preview**
- [ ] Eight people.
- [ ] Working days for the month as in the data sheet (26 in a month with 26 Mondays-to-Saturdays).
- [ ] **Nimal Perera:** gross 90,000; EPF 6,800 (8% of 85,000; the transport allowance doesn't count); net 83,200.
- [ ] **Sunil Bandara:** gross 48,500; EPF 3,880 (8% of 48,500; his allowance counts); advance taken back 10,000; net **34,620**.
- [ ] **Kamal Silva:** gross 60,000; EPF 4,800; loan instalment 10,000; net **45,200**.
- [ ] **Ajith Kumara:** days attended × 2,000; **no EPF**.
- [ ] ⚠ **Kumari Dias** (absent two days) should be paid for 24 of 26 days: basic **38,769.23**, net **35,667.69**. **Priya Rajapaksa** (one day's leave) for 25 of 26: basic **40,384.62**. If the preview shows them on full basic pay, or shows "working days" equal to "days attended" for everyone, write that down: see README, known items 6 and 7.

3. If the preview's working days are not the month's working days, set them to the right number for Kumari Dias and Priya Rajapaksa and note what happens to their days attended.
4. Generate.

**Expect**
- [ ] Eight draft payrolls for last month, with the figures from the data sheet.

### P-07 A one-off allowance and deduction

1. Open **Nimal Perera's** draft payroll.
2. **Add Allowance**: `Bonus`, Rs **2,000** (does not count for EPF).
3. **Add Deduction**: `Uniform`, Rs **500**.

**Expect**
- [ ] Gross becomes **92,000**. EPF stays 6,800. Net becomes **84,700** (92,000 − 6,800 − 500).

### P-08 Review and approve

1. For each of the eight payrolls: open it, check it, mark **Reviewed**, then **Approved**.

**Expect**
- [ ] Status only moves forward: draft → reviewed → approved.
- [ ] Once approved, allowances and deductions can no longer be added.

### P-09 The month's totals

1. **Payroll → Month & payslips.** Choose last month.

**Expect** (data sheet totals, plus your Rs 2,000 bonus and Rs 500 deduction)

| | Data sheet | After P-07 |
|---|---|---|
| Gross | 433,653.85 | **435,653.85** |
| Employee EPF | 32,212.31 | 32,212.31 |
| Advances and loans taken back | 20,000 | 20,000 |
| Other deductions | 0 | 500 |
| Net pay | 381,441.54 | **382,941.54** |
| Employer EPF + ETF | 60,398.08 | 60,398.08 |
| Labour cost (gross + employer EPF + ETF) | 494,051.92 | **496,051.93** |

- [ ] The totals cards match the right-hand column (a cent either way is rounding).
- [ ] Add up the net pay column by hand for three people and check it.

### P-10 Payslip and bank list

1. Download **Sunil Bandara's payslip** (PDF).
2. Download the **bank transfer list** (CSV).

**Expect**
- [ ] The payslip shows basic 45,000, Cost of living allowance 3,500, EPF 8% 3,880, the advance (ADV-…) 10,000, net 34,620, and the employer's EPF and ETF.
- [ ] The bank list has seven people with bank details and warns that **Ajith Kumara** has none.
- [ ] Would you hand this payslip to staff? Would your bank accept this list?

### P-11 Pay the month

1. Write down the Main Current Account balance (**Money → Accounts**): Rs __________.
2. **Month & payslips → Pay all approved.** Account **Main Current Account**, bank transfer, date today.

**Expect**
- [ ] All eight show **paid**.
- [ ] Main Current Account has dropped by the **net pay total only: Rs 382,941.54**.
- [ ] **Advances & loans**: Sunil Bandara's advance is **paid back**. Kamal Silva's loan is down to **Rs 40,000**.

### P-12 What the ledger says

1. **Money → Ledger.** Find today's payroll lines for **Sunil Bandara**.

**Expect**

| Line | In | Out | Category | Cost centre |
|---|---|---|---|---|
| Wages | | 48,500 | Wages & Salaries | Main Farm |
| EPF kept back | 3,880 | | EPF Withheld | Main Farm |
| Advance taken back | 10,000 | | Staff Advances & Loans | Main Farm |
| **Effect on the bank** | | **34,620** | | |

- [ ] The three lines are there. Only 34,620 left the bank, but the wage cost shown is 48,500.
- [ ] Saman Wijesinghe's wages are tagged **Feed Mill**; Ruwan Fernando's **Admin / Head Office**.

---

## Part 4: EPF and ETF

### P-13 The return

1. **Payroll → EPF / ETF.** Choose last month.

**Expect**
- [ ] Seven members listed. **Ajith Kumara is not listed.**
- [ ] Each line: EPF earnings, employee 8%, employer 12%, ETF 3%. Check Kumari Dias by hand: earnings 38,769.23 → 3,101.54 / 4,652.31 / 1,163.08.
- [ ] Totals: employee **32,212.31**, employer **48,318.46**, ETF **12,079.62**. To pay: **Rs 92,610.39** (give or take a cent of rounding).

### P-14 Pay it over

1. **Pay EPF/ETF.** Account **Main Current Account**, date today, EPF reference `C-form 09`.

**Expect**
- [ ] The month shows **Paid**, with the reference.
- [ ] Main Current Account is down by 92,610.39.
- [ ] **Money → Ledger**: the employee's share (32,212.31) goes out as **EPF Withheld**: it was already kept back from pay, so it is not a new cost. The employer's share (60,398.08) goes out as **EPF / ETF Contributions**, split between Main Farm, Expansion 1, Feed Mill and Admin.

### P-15 A loan repaid directly

1. **Advances & loans** → Kamal Silva's loan → **paid back directly**: Rs **5,000**, cash, into **Main Cash Safe**, today.

**Expect**
- [ ] Rs **35,000** still owed.
- [ ] Main Cash Safe is up by 5,000.

### P-16 Wages reach the batches

1. **Farms → Batches → MF-H2-002 → Performance & profit.**

**Expect**
- [ ] The **Labour** line now includes a share of last month's Main Farm wages plus employer EPF/ETF, shared by bird-days. It is higher than before you paid the month.
- [ ] The closed batch `MF-H1-001` is not changed. If part of last month's wages belongs to it, the app reports a late cost instead of altering the frozen figures.

---

## Part 5: Adding and changing people

Do these after the pay run, so they don't disturb the figures above.

### P-17 Add an employee

1. **People → Employees → add employee.**
2. First name `Test`, last name `Helper`, job **Worker**, farm **Expansion 1**, permanent, join date today, EPF number `EPF-2001`, **EPF member** ticked.
3. Bank: holder `Test Helper`, bank `Peoples Bank`, account `0099887766`.
4. Pay: monthly, Rs **40,000**, effective from today. Add an allowance `Attendance bonus` Rs 2,000 and tick **Counts for EPF/ETF**. Save.

**Expect**
- [ ] Listed under Expansion 1. Wages will be charged to Expansion 1.
- [ ] The pay setup shows the base rate and the allowance.

### P-18 Change someone to a casual worker

1. Open **Test Helper** → edit → untick **EPF member**. Save.
2. **Payroll → Pay runs → Generate Payroll** for **this month** and read the preview only. **Do not generate.**

**Expect**
- [ ] In the preview, Test Helper has no EPF.
- [ ] Priya Rajapaksa's preview shows the Rs 8,000 advance from P-05 being taken back.

---

## Should be refused

| ID | Try | Expect | ✓ |
|---|---|---|---|
| P-R1 | Before P-08: mark a **draft** payroll **Approved** directly | Refused: it must be reviewed first | |
| P-R2 | Before P-11: **Pay EPF/ETF** for last month | Refused: pay the remaining payrolls for the month first | |
| P-R3 | After P-11: **Generate Payroll** for last month again | Nobody is paid twice: all eight are skipped as already existing | |
| P-R4 | After P-11: move a **paid** payroll back to reviewed, or delete it | Not possible | |
| P-R5 | After P-14: **Pay EPF/ETF** for last month again | Refused: already paid, with the date | |
| P-R6 | As **Sunil Bandara** (farm worker), type `/payroll` at the end of the address | Not authorised | |
| P-R7 | As **Nimal Perera** (farm manager), look for Payroll | Not in his menu. He can see Employees and Attendance for Main Farm only | |
| P-R8 | A salary advance to **Ajith Kumara** of Rs **60,000** from Main Cash Safe, taken back from this month. Then preview this month's payroll | The advance is allowed, but the amount taken back is capped at his pay after EPF: net pay never goes below zero, and the rest carries forward | |

---

## Questions for the tester

1. Does paying by days attended match how monthly staff are really paid? What about approved leave and public holidays?
2. Who decides the number of working days in a month, and should the app know it without being told?
3. Are daily-paid and casual workers handled the way you pay them?
4. Where would you enter overtime, and did you find it?
5. Which earnings count for EPF in your practice? Does the tick box cover it?
6. Does the EPF/ETF page give you what the C-form needs?
7. Does the bank list match your bank's upload format?
8. Who should be allowed to see salaries?

## Passed when

A full month has been generated, approved and paid and the EPF/ETF paid over, with net pay, EPF and the bank movement checked by hand for at least two employees.
