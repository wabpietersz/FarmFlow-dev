# Test plan 08: Reports and Home

**For:** the owner and accounts; a farm manager for the batch reports.
**Time:** about 45 minutes. Best done **after** the other plans, when there is fresh activity to read.
**Sign in as:** a system admin. Two checks use Nimal Perera and Vinod Rathnayake.
**Have open:** [Test-Data-Sheet.md](Test-Data-Sheet.md).

This plan changes nothing. It checks that what the reports say agrees with what is in the system.

---

## Part 1: Home

### H-01 The tiles

1. **Home.**

**Expect**
- [ ] **Cash on hand** = the account balances under **Money → Accounts** added together.
- [ ] **Owed to you** = the total on **Sales → Owed to you**.
- [ ] **You owe suppliers** = the total on **Money → Payables**.
- [ ] **Waiting for approval** = the count on the **Approvals** page.
- [ ] **Live birds** = the live birds of the growing batches added together (**Farms → Batches**).
- [ ] Tapping a tile opens the screen it came from.

### H-02 To do

1. Read the **To do** list. Tap each item.

**Expect**
- [ ] Each item goes to the screen where it can be dealt with.
- [ ] Nothing is listed that has already been dealt with (for example a health task you marked done in plan 04).
- [ ] Nothing that needs attention is missing. Think: is there anything you know is overdue that is not on the list?

### H-03 The bell

1. Open the bell.
2. As a system admin: ask for a refresh if there is a button for it, or wait 30 minutes after doing something that should raise an alert.

**Expect**
- [ ] Alerts for: vaccinations due or overdue, stock low or expiring, buyer cheques waiting, approvals waiting, catches booked for tomorrow, buyers late paying.
- [ ] Each alert appears once, and tapping it goes to the right screen.
- [ ] Is 30 minutes quick enough for any of these?

### H-04 Home for someone tied to one farm

1. Sign in as **Nimal Perera** (Main Farm).

**Expect**
- [ ] Only Main Farm's batches. No Expansion 1 figures in his batch cards or his To do list.
- [ ] He does not see the profit tile or what suppliers are owed (owner and accounts only). Note what he does see, and whether that is what you want a farm manager to see.

---

## Part 2: Reports

Open **Reports**. For each tab below: choose a period that covers the last three months, and check the stated figures.

### R-01 Batch Performance

**Expect**
- [ ] The four test batches are listed (more if other plans have added some).
- [ ] `EX-HB-001`: 2,500 placed, 125 deaths, mortality 5%, FCR about 1.8.
- [ ] `MF-H1-001`: 2,000 placed, 60 deaths, mortality 3%, FCR about 1.7 (data sheet, "Closed batches").
- [ ] `MF-H2-002`: mortality a little over 2%.
- [ ] **Export CSV** downloads the same rows.

### R-02 Sales

**Expect**
- [ ] Sales by buyer and by month. The three sales of `MF-H1-001` (all on one day; data sheet, section 5) total **Rs 2,669,390**.
- [ ] Cancelled sales are not counted.

### R-03 Mortality

**Expect**
- [ ] A trend per batch from its daily checks. `EX-HA-001` shows more deaths in its first week than later.
- [ ] The causes are the ones recorded.

### R-04 Financial

**Expect**
- [ ] The four sub-views (Receipts, Payroll, Suppliers, Petty Cash) each agree with their own screens: receipts with **Sales**, payroll paid with **Payroll → Month & payslips**, supplier payments with **Stock → Invoices**, petty cash left with **Money → Petty cash**.

### R-05 Comparison

**Expect**
- [ ] Batches side by side on mortality, FCR, weight and cost.

### R-06 Profitability (owner and accounts)

**Expect**
- [ ] `MF-H1-001`: revenue **2,669,390**, with cost and profit close to the frozen figures in the data sheet.
- [ ] Each batch's cost splits into chicks, feed, medicine and stock, labour, and shared costs. The split adds up to the total.

### R-07 Inventory Usage (owner and accounts)

**Expect**
- [ ] What each batch used from stock: vaccines, vitamins, bedding. `MF-H1-001` used 4,000 doses of Newcastle vaccine and 4,000 of Gumboro vaccine.

### R-08 Cost Allocation (owner and accounts)

**Expect**
- [ ] For each month and each pool (each farm, Admin, Feed Mill): the total cost, how much was charged to batches or to feed, and how much was **not charged**.
- [ ] Nothing is unexplained. A month where a farm had costs but no birds shows the cost as not charged.
- [ ] The mill's overhead per kg for a month = that month's mill costs ÷ kg of feed made that month.

### R-09 HR & Attendance

**Expect**
- [ ] Attendance for the last two months: 8 employees; the absences and leave days listed in the data sheet are counted.
- [ ] Headcount by farm: Main Farm 6 (including the mill operator and the accountant, who are based there), Expansion 1 2.

### R-10 Feed Analytics

**Expect**
- [ ] Feed made by recipe and by month agrees with the data sheet, section 4.
- [ ] Feed sent to each batch agrees with what the batch's own page shows.

### R-11 Who can see the money reports

1. Sign in as **Vinod Rathnayake** (viewer). Open **Reports**.
2. Sign in as **Nimal Perera** (farm manager). Open **Reports**.

**Expect**
- [ ] Vinod sees the batch and feed reports and **not** Profitability, Inventory Usage or Cost Allocation.
- [ ] Nimal sees all of them, for Main Farm only.

---

## Questions for the tester

1. Which of these would you open every week? Which never?
2. Which number would you not trust until you had checked it against something else? Against what?
3. What do you report on today (to the owner, the bank, the vet) that is not here?
4. Are the report names the ones you would use?
5. On a phone, which reports are readable and which are not?

## Passed when

Every Home tile has been matched to its source screen, and each report has been read by someone who would use it.
