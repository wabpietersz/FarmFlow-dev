# Test data sheet

> **Do not edit by hand.** This file is written by `npm run db:testdata` and replaced every time the test data is rebuilt.

**Built as of:** 2026-10-02. Every date below is counted back (or forward) from that day, so the picture is the same whenever it is rebuilt.

This sheet lists what is already in the system before any tester starts: the codes, dates and amounts the test plans refer to. Keep it open beside the plan you are working through. Once testers start changing things, the app is the truth and this sheet is the starting point.

| Name used in the plans | Month |
|---|---|
| **This month** | October 2026 |
| **Last month** (attendance complete, payroll not yet run) | September 2026 |
| **Two months ago** (payroll run and paid, EPF/ETF paid) | August 2026 |
| **Three months ago** (nothing happened; free for the period-lock test) | July 2026 |

## 1. Sign-ins

| Person | Email | Role | Farm | Can sign in now? |
| --- | --- | --- | --- | --- |
| System Admin | admin@farmflow.com | System admin | All farms | Yes (same password as the development system) |
| Warren Pietersz | warrenpietersz@gmail.com | System admin | All farms | Yes (same password as the development system) |
| Toto Wolff | manager1@farmflow.com | Farm manager | All farms | Yes (same password as the development system) |
| Nimal Perera | nimal.manager@farmflow.test | Farm manager | Main Farm | After `npm run db:testdata:signins` |
| Dilani Jayawardena | dilani.manager@farmflow.test | Farm manager | Expansion 1 | After `npm run db:testdata:signins` |
| Kamal Silva | kamal.supervisor@farmflow.test | Supervisor | Expansion 1 | After `npm run db:testdata:signins` |
| Ruwan Fernando | ruwan.accounts@farmflow.test | Accountant | All farms | After `npm run db:testdata:signins` |
| Saman Wijesinghe | saman.mill@farmflow.test | Feed mill operator | All farms | After `npm run db:testdata:signins` |
| Sunil Bandara | sunil.worker@farmflow.test | Farm worker | Main Farm | After `npm run db:testdata:signins` |
| Vinod Rathnayake | vinod.viewer@farmflow.test | Viewer | All farms | After `npm run db:testdata:signins` |

The people with `@farmflow.test` addresses are made-up staff, one per role. They exist so the access tests have someone to sign in as. See the README for how to give them passwords, or register your real testers under **Settings → Users** with the same role and farm.

**Approval limits:** purchase orders at or above Rs 1,000,000; money going out at or above Rs 250,000. System admins and accountants are approvers, so nothing they raise waits.

## 2. Farms, houses and batches

| Farm | House | State |
| --- | --- | --- |
| Main Farm | House 1 | Being cleaned out (turnaround in progress) |
| Main Farm | House 2 | occupied |
| Main Farm | House 3 | empty |
| Expansion 1 | House A | occupied |
| Expansion 1 | House B | empty |

| Batch | Farm / house | Status | Placed on | Age today | Chicks placed | Deaths | Sold | Live birds | Booked | Last daily check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **MF-H1-001** | Main Farm / House 1 | closed | 2026-07-24 | — | 2,000 | 60 | 1,940 | 0 | 0 | 2026-08-27 |
| **EX-HB-001** | Expansion 1 / House B | closed | 2026-07-26 | — | 2,500 | 125 | 2,375 | 0 | 0 | 2026-08-29 |
| **MF-H2-002** | Main Farm / House 2 | growing | 2026-08-30 | 33 days | 3,000 | 70 | 750 | 2,180 | 1,600 | 2026-10-01 |
| **EX-HA-001** | Expansion 1 / House A | growing | 2026-09-18 | 14 days | 2,500 | 28 | 0 | 2,472 | 0 | 2026-09-30 |

**Closed batches: the figures frozen when the batch was closed**

| Batch | Revenue (Rs) | Total cost (Rs) | Profit (Rs) | Birds sold | Kg sold | Mortality | FCR | Cost per kg (Rs) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **MF-H1-001** | 2,669,390 | 2,186,301.07 | 483,088.93 | 1,940 | 4,181 | 3% | 1.706 | 522.91 |
| **EX-HB-001** | 3,058,880 | 2,502,663.68 | 556,216.32 | 2,375 | 4,840 | 5% | 1.821 | 517.08 |

**Health tasks still to do**

| Batch | Task | Due | Uses |
| --- | --- | --- | --- |
| MF-H2-002 | Gumboro booster (IBD) | 2026-09-23 (overdue) | 3,000 × Gumboro vaccine |
| EX-HA-001 | Gumboro (IBD) | 2026-10-02 | 2,500 × Gumboro vaccine |
| EX-HA-001 | Newcastle disease booster (ND LaSota) | 2026-10-09 | 2,500 × Newcastle vaccine |
| EX-HA-001 | Gumboro booster (IBD) | 2026-10-12 | 2,500 × Gumboro vaccine |

## 3. Stock

| Item | Unit | Main store | Feed mill store | Main Farm store | Expansion 1 store | Total | Reorder level |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Corn | kg | 0 | 7,825 | 0 | 0 | 7,825 | 3,000 |
| Soya meal | kg | 0 | 1,270 | 0 | 0 | 1,270 | 1,000 |
| Fish meal | kg | 0 | 355 | 0 | 0 | 355 | 500 (**low**) |
| Vitamin premix | kg | 0 | 150 | 0 | 0 | 150 | 100 |
| Newcastle vaccine | dose | 6,000 | 0 | 1,000 | 500 | 7,500 | 2,000 |
| Gumboro vaccine | dose | 2,400 | 0 | 3,000 | 3,000 | 8,400 | 2,000 |
| Vitamins & electrolytes | sachet | 70 | 0 | 10 | 5 | 85 | 20 |
| Disinfectant | litre | 30 | 0 | 20 | 10 | 60 | 15 |
| Wood shavings | bag | 0 | 0 | 20 | 20 | 40 | 50 (**low**) |

**Lots that are expired or expire within 30 days**

| Lot | Item | Store | Left | Expiry |
| --- | --- | --- | --- | --- |
| LOT-20260803-001 | Gumboro vaccine | Main store | 400 dose | 2026-09-29 (**expired**) |
| LOT-20260724-005-T3 | Newcastle vaccine | Main Farm store | 1,000 dose | 2026-10-27 |

**Purchase orders**

| Order | Supplier | Ordered on | Status | Total (Rs) | Received / ordered | Note on the order |
| --- | --- | --- | --- | --- | --- | --- |
| **PO-20260722-001** | Agri Feeds | 2026-07-22 | received | 4,734,720 | Corn 14,520/14,520; Soya meal 7,200/7,200; Fish meal 1,566/1,566; Vitamin premix 564/564 | Opening raw materials for the mill |
| **PO-20260723-001** | Acme Suppliers | 2026-07-23 | received | 461,250 | Newcastle vaccine 17,000/17,000; Gumboro vaccine 20,000/20,000; Vitamins & electrolytes 105/105; Disinfectant 60/60; Wood shavings 400/400 | Health and bedding stock for the season |
| **PO-20260827-001** | Agri Feeds | 2026-08-27 | received | 2,748,500 | Corn 8,000/8,000; Soya meal 4,000/4,000; Fish meal 900/900; Vitamin premix 350/350 | Second raw material order |
| **PO-20260910-001** | Acme Suppliers | 2026-09-10 | received | 44,000 | Newcastle vaccine 8,000/8,000 | Newcastle vaccine top-up |
| **PO-20260927-001** | Agri Feeds | 2026-09-27 | partially received | 2,060,000 | Corn 5,000/8,000; Soya meal 0/4,000 | Third raw material order |
| **PO-20261001-001** | Acme Suppliers | 2026-10-01 | submitted | 50,500 | Newcastle vaccine 0/5,000; Vitamins & electrolytes 0/50 | Vaccine and vitamins, delivery expected |
| **PO-20261002-001** | Acme Suppliers | 2026-10-02 | draft | 48,000 | Disinfectant 0/40 | Disinfectant for the House 1 clean-out |
| **PO-20260801-001** | Acme Suppliers | 2026-08-01 | received | 2,400 | Gumboro vaccine 400/400 | Short-dated Gumboro lot |
| **PO-20261002-002** | Agri Feeds | 2026-10-02 | pending approval | 1,250,000 | Corn 0/10,000 | Corn while the price holds |

**Supplier invoices**

| Invoice | Supplier | Order | Dated | Due | Amount (Rs) | Status | Match | Paid (Rs) | Still owed (Rs) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **INV-AF-1001** | Agri Feeds | PO-20260722-001 | 2026-07-24 | 2026-08-07 | 4,734,720 | approved | matched | 4,734,720 | 0 |
| **INV-AC-2001** | Acme Suppliers | PO-20260723-001 | 2026-07-24 | 2026-08-07 | 461,250 | approved | matched | 461,250 | 0 |
| **INV-AF-1002** | Agri Feeds | PO-20260827-001 | 2026-08-29 | 2026-09-12 | 2,748,500 | approved | matched | 1,500,000 | 1,248,500 |
| **INV-AC-2003** | Acme Suppliers | PO-20260910-001 | 2026-09-12 | 2026-10-12 | 44,000 | approved | matched | 0 | 44,000 |
| **INV-AF-1003** | Agri Feeds | PO-20260927-001 | 2026-09-29 | 2026-10-13 | 2,060,000 | recorded | over billed | 0 | 2,060,000 |
| **INV-AC-2002** | Acme Suppliers | PO-20260801-001 | 2026-08-03 | 2026-08-17 | 2,400 | approved | matched | 2,400 | 0 |

**Stock requests**

| Request | From | For | Items | Status |
| --- | --- | --- | --- | --- |
| REQ-20261002-001 | Nimal Perera | Main Farm | Vitamins & electrolytes × 20; Disinfectant × 10 | submitted |
| REQ-20261002-002 | Kamal Silva | Expansion 1 | Wood shavings × 80 | approved |

**Service work**

| Work order | What | Supplier | Amount (Rs) | Status |
| --- | --- | --- | --- | --- |
| WRK-20260923-001 | House 2 fan motor rewind | Ceylon Power Services | 35,000 | approved |
| WRK-20260928-001 | Hammer mill screen replacement | Ceylon Power Services | 28,000 | pending approval |

## 4. Feed mill

| Run | Recipe | Date | Status | Planned (kg) | Made (kg) | Sent to farms (kg) | Left at the mill (kg) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **PROD-20260726-001** | Broiler Starter | 2026-07-26 | completed | 3,000 | 3,000 | 3,000 | 0 |
| **PROD-20260727-001** | Broiler Starter | 2026-07-27 | completed | 1,600 | 1,600 | 1,600 | 0 |
| **PROD-20260807-001** | Broiler Grower | 2026-08-07 | completed | 3,000 | 3,000 | 3,000 | 0 |
| **PROD-20260808-001** | Broiler Grower | 2026-08-08 | completed | 3,400 | 3,400 | 3,400 | 0 |
| **PROD-20260817-001** | Broiler Finisher | 2026-08-17 | completed | 3,500 | 3,460 | 3,200 | 260 |
| **PROD-20260818-001** | Broiler Finisher | 2026-08-18 | completed | 4,000 | 4,000 | 4,000 | 0 |
| **PROD-20260831-001** | Broiler Starter | 2026-08-31 | completed | 4,000 | 4,000 | 1,500 | 2,500 |
| **PROD-20260913-001** | Broiler Grower | 2026-09-13 | completed | 5,000 | 5,000 | 4,300 | 700 |
| **PROD-20260926-001** | Broiler Finisher | 2026-09-26 | completed | 5,000 | 5,000 | 3,500 | 1,500 |
| **PROD-20261001-001** | Broiler Starter | 2026-10-01 | in progress | 1,500 |  | 0 |  |
| **PROD-20261002-001** | Broiler Grower | 2026-10-02 | planned | 2,000 |  | 0 |  |

## 5. Sales

| Buyer | Credit terms | Credit limit (Rs) | Owes now (Rs) |
| --- | --- | --- | --- |
| **Fresh Mart** | 14 days | 3,000,000 | 0 |
| **City Poultry** | 0 days | No limit | 419,150 |
| **Lanka Chicken Co** | 30 days | 2,000,000 | 979,840 |
| **Afflan Traders** | 7 days | 100,000 | 64,000 |
| **Wayamba Processors** | 7 days | 5,000,000 | 0 |

| Sale | Buyer | Batch / item | Date | Due | Status | Birds | Kg | Amount (Rs) | Received (Rs) | Cheques not yet cleared (Rs) | Outstanding (Rs) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **SALE-20260828-001** | Fresh Mart | MF-H1-001 | 2026-08-28 | 2026-09-11 | completed | 1,000 | 2,160 | 1,382,400 | 1,382,400 | 0 | 0 |
| **SALE-20260828-002** | City Poultry | MF-H1-001 | 2026-08-28 | 2026-08-28 | reviewed | 600 | 1,290 | 819,150 | 400,000 | 0 | 419,150 |
| **SALE-20260828-003** | Lanka Chicken Co | MF-H1-001 | 2026-08-28 | 2026-09-27 | reviewed | 340 | 731 | 467,840 | 0 | 0 | 467,840 |
| **SALE-20260830-001** | Wayamba Processors | EX-HB-001 | 2026-08-30 | 2026-09-06 | completed | 2,375 | 4,840 | 3,058,880 | 3,058,880 | 0 | 0 |
| **SALE-20260901-001** | City Poultry | Used litter | 2026-09-01 | 2026-09-01 | completed | 0 | 0 | 20,000 | 20,000 | 0 | 0 |
| **SALE-20260930-001** | Lanka Chicken Co | MF-H2-002 | 2026-09-30 | 2026-10-30 | reviewed | 400 | 800 | 512,000 | 0 | 512,000 | 512,000 |
| **SALE-20260930-002** | Afflan Traders | MF-H2-002 | 2026-09-30 | 2026-10-07 | reviewed | 50 | 100 | 64,000 | 0 | 0 | 64,000 |
| **SALE-20261001-001** | City Poultry | MF-H2-002 | 2026-10-01 | 2026-10-01 | draft | 300 | 615 | 390,525 | 0 | 0 | 390,525 |

A cheque is not money until it clears: it stays in Outstanding, and out of the bank balance, until it is marked cleared. A draft sale is not counted in what a buyer owes until it is marked reviewed.

**Bookings**

| Booking | Buyer | Batch | Catch date | Birds | Expected kg each | Rs per kg | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BKG-20261003-001 | Fresh Mart | MF-H2-002 | 2026-10-03 | 1,000 | 2.100 | 640 | booked |
| BKG-20261005-001 | Lanka Chicken Co | MF-H2-002 | 2026-10-05 | 600 | 2.200 | 645 | booked |

**Cheques received from buyers**

| Cheque no. | Bank | Cheque date | Amount (Rs) | From | Status |
| --- | --- | --- | --- | --- | --- |
| **445501** | Sampath Bank | 2026-09-30 | 300,000 | Lanka Chicken Co | pending |
| **445502** | Sampath Bank | 2026-10-07 | 212,000 | Lanka Chicken Co | pending |

## 6. People and payroll

| Employee | Job | Works at | Cost goes to | Type | EPF no. | Pay | Allowances | Bank details |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Nimal Perera** | Farm Manager | Main Farm | Main Farm | permanent | EPF-1001 | Rs 85,000 a month | Transport allowance 5,000 | Yes |
| **Sunil Bandara** | Worker | Main Farm | Main Farm | permanent | EPF-1002 | Rs 45,000 a month | Cost of living allowance 3,500 | Yes |
| **Kumari Dias** | Worker | Main Farm | Main Farm | permanent | EPF-1003 | Rs 42,000 a month |  | Yes |
| **Ajith Kumara** | Worker | Main Farm | Main Farm | seasonal | Not a member | Rs 2,000 a day |  | **None** |
| **Kamal Silva** | Supervisor | Expansion 1 | Expansion 1 | permanent | EPF-1004 | Rs 60,000 a month |  | Yes |
| **Priya Rajapaksa** | Worker | Expansion 1 | Expansion 1 | permanent | EPF-1005 | Rs 42,000 a month |  | Yes |
| **Saman Wijesinghe** | Feed Mill Operator | Main Farm | Feed Mill | permanent | EPF-1006 | Rs 55,000 a month |  | Yes |
| **Ruwan Fernando** | Accountant | Main Farm | Admin / Head Office | permanent | EPF-1007 | Rs 75,000 a month |  | Yes |

| Month | Payroll status | People | Gross (Rs) | Net (Rs) |
| --- | --- | --- | --- | --- |
| 2026-08 | paid | 8 | 435,615.38 | 393,246.15 |

Attendance is recorded for every working day (Monday to Saturday) of August 2026 and September 2026, and for this month up to yesterday.

**Days not worked** (everyone else was present on every working day; Ajith Kumara works Mondays, Wednesdays and Fridays)

| Date | Employee | Recorded as | Leave type |
| --- | --- | --- | --- |
| 2026-08-13 | Sunil Bandara | on leave | medical |
| 2026-08-21 | Kamal Silva | half day | casual |
| 2026-09-09 | Kumari Dias | absent |  |
| 2026-09-10 | Kumari Dias | absent |  |
| 2026-09-16 | Priya Rajapaksa | on leave | casual |

**What September 2026's payroll should come to** (it has not been run yet; the payroll plan has you run it). September 2026 has **26 working days**. Basic pay = basic ÷ working days × days attended; EPF 8% is taken on basic for days attended plus allowances that count for EPF; an advance or loan instalment is then taken back.

| Employee | Days attended | Basic for days attended | Allowances | Gross | Employee EPF 8% | Advance / loan taken back | **Net pay** | Employer EPF 12% | ETF 3% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Nimal Perera | 26 of 26 | 85,000 | 5,000 | 90,000 | 6,800 | 0 | **83,200** | 10,200 | 2,550 |
| Sunil Bandara | 26 of 26 | 45,000 | 3,500 | 48,500 | 3,880 | 10,000 | **34,620** | 5,820 | 1,455 |
| Kumari Dias | 24 of 26 | 38,769.23 | 0 | 38,769.23 | 3,101.54 | 0 | **35,667.69** | 4,652.31 | 1,163.08 |
| Ajith Kumara | 13 of 26 | 26,000 | 0 | 26,000 | 0 | 0 | **26,000** | 0 | 0 |
| Kamal Silva | 26 of 26 | 60,000 | 0 | 60,000 | 4,800 | 10,000 | **45,200** | 7,200 | 1,800 |
| Priya Rajapaksa | 25 of 26 | 40,384.62 | 0 | 40,384.62 | 3,230.77 | 0 | **37,153.85** | 4,846.15 | 1,211.54 |
| Saman Wijesinghe | 26 of 26 | 55,000 | 0 | 55,000 | 4,400 | 0 | **50,600** | 6,600 | 1,650 |
| Ruwan Fernando | 26 of 26 | 75,000 | 0 | 75,000 | 6,000 | 0 | **69,000** | 9,000 | 2,250 |
| **Total** |  |  |  | **433,653.85** | **32,212.31** | **20,000** | **381,441.54** | **48,318.46** | **12,079.62** |

EPF/ETF to pay over for September 2026: 32,212.31 + 48,318.46 + 12,079.62 = **Rs 92,610.38**. Labour cost to the business: gross + employer EPF + ETF = **Rs 494,051.92**.

**Advances and loans to staff**

| Code | Employee | Type | Amount (Rs) | Instalment (Rs) | Paid out | Taken back from | Taken back so far (Rs) | Still owed (Rs) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ADV-202608-001 | Kamal Silva | loan | 60,000 | 10,000 | 2026-08-15 | 2026-08 | 10,000 | 50,000 |
| ADV-202609-001 | Sunil Bandara | advance | 10,000 | 10,000 | 2026-09-20 | 2026-09 | 0 | 10,000 |

## 7. Money

| Account | Type | Opening (Rs) | In (Rs) | Out (Rs) | Balance (Rs) |
| --- | --- | --- | --- | --- | --- |
| **Main Current Account** | current | 1,500,000 | 11,883,649.23 | 9,790,646.92 | **3,593,002.31** |
| **Main Cash Safe** | cash | 200,000 | 320,000 | 62,400 | **457,600** |
| **Farm Petty Cash Float** | petty cash | 0 | 50,000 | 14,700 | **35,300** |
| **Cash on hand (Home)** |  |  |  |  | **4,085,902.31** |

Opening balances are dated 2026-07-01.

| Loan | Lender | Received | Amount (Rs) | Principal repaid (Rs) | Interest paid (Rs) | Still owed (Rs) |
| --- | --- | --- | --- | --- | --- | --- |
| LOAN-2026-001 | Commercial Bank | 2026-07-22 | 3,000,000 | 250,000 | 59,000 | 2,750,000 |

**Waiting for someone**

| What | Detail | Amount (Rs) |
| --- | --- | --- |
| Over the approval limit | Purchase order PO-20261002-002, raised by Nimal Perera | 1,250,000 |
| Petty cash spend to review | 2026-09-30 · Tea and snacks for the catching crew | 2,400 |
| Expense | OPE-20260929-001 · Wayamba Water Supply · pending approval | 18,000 |
| Supplier invoice to approve | INV-AF-1003 (over billed) | 2,060,000 |
| Service work to review | Hammer mill screen replacement | 28,000 |
| Stock request to review | REQ-20261002-001 from Nimal Perera |  |
| Draft sale to review | SALE-20261001-001 · City Poultry | 390,525 |

### Every money movement so far

For the "work the balance out by hand" checks. In and out are per account; a transfer between accounts appears once on each.

| Date | Transaction | Account | In (Rs) | Out (Rs) | Category | Cost centre | Batch | What |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-19 | TRX-20260719-001 | Main Current Account | 4,000,000 |  | Owner Capital Introduced | Admin / Head Office |  | Owner · Owner capital to start the season |
| 2026-07-20 | TRX-20260720-001 | Main Current Account |  | 300,000 | Internal Transfer |  |  | Internal transfer · Cash drawn for the safe |
| 2026-07-20 | TRX-20260720-001 | Main Cash Safe | 300,000 |  | Internal Transfer |  |  | Internal transfer · Cash drawn for the safe |
| 2026-07-22 | TRX-20260722-001 | Main Current Account | 3,000,000 |  | Loan Received | Admin / Head Office |  | Commercial Bank · Loan from Commercial Bank |
| 2026-07-24 | TRX-20260724-001 | Main Current Account |  | 300,000 | Day-old Chicks | Main Farm | MF-H1-001 | Lanka Hatcheries · Day-old chicks for MF-H1-001 |
| 2026-07-26 | TRX-20260726-001 | Main Current Account |  | 375,000 | Day-old Chicks | Expansion 1 | EX-HB-001 | Lanka Hatcheries · Day-old chicks for EX-HB-001 |
| 2026-08-01 | TRX-20260801-001 | Main Current Account |  | 252,250 | Medicine & Vaccines | Main Farm |  | Acme Suppliers · Supplier payment SPY-20260801-001 |
| 2026-08-01 | TRX-20260801-001 | Main Current Account |  | 69,000 | Farm Consumables | Main Farm |  | Acme Suppliers · Supplier payment SPY-20260801-001 |
| 2026-08-01 | TRX-20260801-001 | Main Current Account |  | 140,000 | Litter & Bedding | Main Farm |  | Acme Suppliers · Supplier payment SPY-20260801-001 |
| 2026-08-03 | TRX-20260803-001 | Main Current Account |  | 4,734,720 | Feed Raw Materials | Feed Mill |  | Agri Feeds · Supplier payment SPY-20260803-001 |
| 2026-08-05 | TRX-20260805-001 | Main Cash Safe |  | 2,400 | Medicine & Vaccines | Main Farm |  | Acme Suppliers · Supplier payment SPY-20260805-001 |
| 2026-08-08 | TRX-20260808-001 | Main Current Account |  | 60,000 | Insurance | Admin / Head Office |  | Ceylinco Insurance · Annual stock insurance premium |
| 2026-08-13 | TRX-20260813-001 | Main Current Account |  | 45,000 | Electricity | Feed Mill |  | CEB · Mill electricity |
| 2026-08-13 | TRX-20260813-002 | Main Current Account |  | 30,000 | Electricity | Main Farm |  | CEB · Main Farm electricity |
| 2026-08-15 | TRX-20260815-001 | Main Current Account |  | 60,000 | Staff Advances & Loans | Expansion 1 |  | Kamal Silva · Staff loan to Kamal Silva |
| 2026-08-18 | TRX-20260818-001 | Main Current Account |  | 2,500 | Bank Charges | Admin / Head Office |  | Commercial Bank · Monthly bank charges |
| 2026-08-21 | TRX-20260821-001 | Main Current Account |  | 125,000 | Loan Principal Repayment | Admin / Head Office |  | Commercial Bank · Repayment of LOAN-2026-001 to Commercial Bank |
| 2026-08-21 | TRX-20260821-001 | Main Current Account |  | 30,000 | Loan Interest | Admin / Head Office |  | Commercial Bank · Repayment of LOAN-2026-001 to Commercial Bank |
| 2026-08-23 | TRX-20260823-001 | Main Cash Safe |  | 50,000 | Internal Transfer |  |  | Nimal Perera · Main Farm day-to-day float |
| 2026-08-23 | TRX-20260823-001 | Farm Petty Cash Float | 50,000 |  | Internal Transfer |  |  | Nimal Perera · Main Farm day-to-day float |
| 2026-08-27 | TRX-20260827-001 | Farm Petty Cash Float |  | 8,500 | Fuel & Gas | Main Farm |  | Fuel & Gas: Diesel for the generator |
| 2026-08-28 | TRX-20260828-001 | Main Current Account | 400,000 |  | Bird Sales | Main Farm | MF-H1-001 | City Poultry · Buyer receipt RCT-20260828-001 |
| 2026-08-30 | TRX-20260830-001 | Main Current Account |  | 465,000 | Day-old Chicks | Main Farm | MF-H2-002 | Lanka Hatcheries · Day-old chicks for MF-H2-002 |
| 2026-08-31 | TRX-20260831-001 | Main Current Account |  | 42,000 | Wages & Salaries | Main Farm |  | Kumari Dias · Payroll disbursement for Kumari Dias |
| 2026-08-31 | TRX-20260831-001 | Main Current Account | 3,360 |  | EPF Withheld from Staff (to pay over) | Main Farm |  | Kumari Dias · Payroll disbursement for Kumari Dias |
| 2026-08-31 | TRX-20260831-002 | Main Current Account |  | 26,000 | Wages & Salaries | Main Farm |  | Ajith Kumara · Payroll disbursement for Ajith Kumara |
| 2026-08-31 | TRX-20260831-003 | Main Current Account |  | 42,000 | Wages & Salaries | Expansion 1 |  | Priya Rajapaksa · Payroll disbursement for Priya Rajapaksa |
| 2026-08-31 | TRX-20260831-003 | Main Current Account | 3,360 |  | EPF Withheld from Staff (to pay over) | Expansion 1 |  | Priya Rajapaksa · Payroll disbursement for Priya Rajapaksa |
| 2026-08-31 | TRX-20260831-004 | Main Current Account |  | 55,000 | Wages & Salaries | Feed Mill |  | Saman Wijesinghe · Payroll disbursement for Saman Wijesinghe |
| 2026-08-31 | TRX-20260831-004 | Main Current Account | 4,400 |  | EPF Withheld from Staff (to pay over) | Feed Mill |  | Saman Wijesinghe · Payroll disbursement for Saman Wijesinghe |
| 2026-08-31 | TRX-20260831-005 | Main Current Account |  | 90,000 | Wages & Salaries | Main Farm |  | Nimal Perera · Payroll disbursement for Nimal Perera |
| 2026-08-31 | TRX-20260831-005 | Main Current Account | 6,800 |  | EPF Withheld from Staff (to pay over) | Main Farm |  | Nimal Perera · Payroll disbursement for Nimal Perera |
| 2026-08-31 | TRX-20260831-006 | Main Current Account |  | 46,769.23 | Wages & Salaries | Main Farm |  | Sunil Bandara · Payroll disbursement for Sunil Bandara |
| 2026-08-31 | TRX-20260831-006 | Main Current Account | 3,741.54 |  | EPF Withheld from Staff (to pay over) | Main Farm |  | Sunil Bandara · Payroll disbursement for Sunil Bandara |
| 2026-08-31 | TRX-20260831-007 | Main Current Account |  | 58,846.15 | Wages & Salaries | Expansion 1 |  | Kamal Silva · Payroll disbursement for Kamal Silva |
| 2026-08-31 | TRX-20260831-007 | Main Current Account | 4,707.69 |  | EPF Withheld from Staff (to pay over) | Expansion 1 |  | Kamal Silva · Payroll disbursement for Kamal Silva |
| 2026-08-31 | TRX-20260831-007 | Main Current Account | 10,000 |  | Staff Advances & Loans | Expansion 1 |  | Kamal Silva · Payroll disbursement for Kamal Silva |
| 2026-08-31 | TRX-20260831-008 | Main Current Account |  | 75,000 | Wages & Salaries | Admin / Head Office |  | Ruwan Fernando · Payroll disbursement for Ruwan Fernando |
| 2026-08-31 | TRX-20260831-008 | Main Current Account | 6,000 |  | EPF Withheld from Staff (to pay over) | Admin / Head Office |  | Ruwan Fernando · Payroll disbursement for Ruwan Fernando |
| 2026-09-01 | TRX-20260901-001 | Main Cash Safe | 20,000 |  | Other Farm Income (manure, litter, scrap) | Main Farm |  | City Poultry · Buyer receipt RCT-20260901-001 |
| 2026-09-04 | TRX-20260904-001 | Main Current Account | 1,382,400 |  | Bird Sales | Main Farm | MF-H1-001 | Fresh Mart · Buyer receipt RCT-20260904-001 |
| 2026-09-06 | TRX-20260906-001 | Main Current Account | 3,058,880 |  | Bird Sales | Expansion 1 | EX-HB-001 | Wayamba Processors · Buyer receipt RCT-20260906-001 |
| 2026-09-10 | TRX-20260910-001 | Farm Petty Cash Float |  | 6,200 | Repairs & Maintenance | Main Farm |  | Repairs & Maintenance: Drinker line fittings |
| 2026-09-12 | TRX-20260912-001 | Main Current Account |  | 48,000 | Electricity | Feed Mill |  | CEB · Mill electricity |
| 2026-09-12 | TRX-20260912-002 | Main Current Account |  | 32,000 | Electricity | Main Farm |  | CEB · Main Farm electricity |
| 2026-09-12 | TRX-20260912-003 | Main Current Account |  | 8,067.69 | EPF Withheld from Staff (to pay over) | Expansion 1 |  | EPF/ETF for 2026-08 |
| 2026-09-12 | TRX-20260912-003 | Main Current Account |  | 15,126.92 | EPF / ETF Contributions | Expansion 1 |  | EPF/ETF for 2026-08 |
| 2026-09-12 | TRX-20260912-003 | Main Current Account |  | 13,901.54 | EPF Withheld from Staff (to pay over) | Main Farm |  | EPF/ETF for 2026-08 |
| 2026-09-12 | TRX-20260912-003 | Main Current Account |  | 26,065.39 | EPF / ETF Contributions | Main Farm |  | EPF/ETF for 2026-08 |
| 2026-09-12 | TRX-20260912-003 | Main Current Account |  | 6,000 | EPF Withheld from Staff (to pay over) | Admin / Head Office |  | EPF/ETF for 2026-08 |
| 2026-09-12 | TRX-20260912-003 | Main Current Account |  | 11,250 | EPF / ETF Contributions | Admin / Head Office |  | EPF/ETF for 2026-08 |
| 2026-09-12 | TRX-20260912-003 | Main Current Account |  | 4,400 | EPF Withheld from Staff (to pay over) | Feed Mill |  | EPF/ETF for 2026-08 |
| 2026-09-12 | TRX-20260912-003 | Main Current Account |  | 8,250 | EPF / ETF Contributions | Feed Mill |  | EPF/ETF for 2026-08 |
| 2026-09-17 | TRX-20260917-001 | Main Current Account |  | 1,500,000 | Feed Raw Materials | Feed Mill |  | Agri Feeds · Supplier payment SPY-20260917-001 |
| 2026-09-17 | TRX-20260917-002 | Main Current Account |  | 2,500 | Bank Charges | Admin / Head Office |  | Commercial Bank · Monthly bank charges |
| 2026-09-18 | TRX-20260918-001 | Main Current Account |  | 375,000 | Day-old Chicks | Expansion 1 | EX-HA-001 | Lanka Hatcheries · Day-old chicks for EX-HA-001 |
| 2026-09-20 | TRX-20260920-001 | Main Current Account |  | 125,000 | Loan Principal Repayment | Admin / Head Office |  | Commercial Bank · Repayment of LOAN-2026-001 to Commercial Bank |
| 2026-09-20 | TRX-20260920-001 | Main Current Account |  | 29,000 | Loan Interest | Admin / Head Office |  | Commercial Bank · Repayment of LOAN-2026-001 to Commercial Bank |
| 2026-09-20 | TRX-20260920-002 | Main Cash Safe |  | 10,000 | Staff Advances & Loans | Main Farm |  | Sunil Bandara · Salary advance to Sunil Bandara |
| 2026-09-24 | TRX-20260924-001 | Main Current Account |  | 12,000 | Electricity | Expansion 1 |  | CEB · Expansion 1 electricity |
| 2026-09-25 | TRX-20260925-001 | Main Current Account |  | 150,000 | Owner Drawings | Admin / Head Office |  | Owner · Owner drawings |

