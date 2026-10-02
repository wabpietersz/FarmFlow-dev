# Manual testing: plans and test data

Step-by-step test plans for each area of FarmFlow, and a ready-made set of test data so that each plan can be started straight away without first setting anything up.

They are written for people who know the work (the farm, the mill, the store, sales, payroll, accounts), not for people who know the software.

## The plans

| Plan | Area | Best done by | Time |
|---|---|---|---|
| [01 Setup, access and approvals](01-setup-and-access.md) | Sign-in, who sees what, approval limits, settings, alerts | Owner | 60 min |
| [02 Stock and buying](02-stock.md) | Request → order → receive → invoice → pay; stores; expiry | Store keeper, accounts | 90 min |
| [03 Feed mill](03-feed-mill.md) | Recipes, production runs, cost per kg, sending feed to farms | Mill operator | 60 min |
| [04 Farms and batches](04-farms.md) | New batch, daily check, health tasks, costs, house clean-out | Farm manager | 90 min |
| [05 Sales](05-sales.md) | Booking → sale → receipt; cheques; credit limits; who owes | Sales, accounts | 90 min |
| [06 People and payroll](06-people-payroll.md) | Attendance, advances, a month's payroll, EPF/ETF | Payroll, owner | 90 min |
| [07 Money](07-money.md) | Accounts, ledger, petty cash, cheques, owner and loans, profit & loss, cash flow | Accounts, owner | 90 min |
| [08 Reports and Home](08-reports-and-home.md) | Home, the bell, every report | Owner, accounts | 45 min |
| [09 Finance from start to finish](09-finance-end-to-end.md) | One small batch followed from funding to sale, then every money view tied together | Accounts, owner | 75 min |

[Test-Data-Sheet.md](Test-Data-Sheet.md) lists everything that is in the system before testing starts: codes, dates, quantities and balances. Each plan refers to it. Print it or keep it open beside the plan.

**How these fit with the other documents**

- [../rollout/](../rollout/README.md) is how the pilot is run: the questions to ask each person first, the feedback sheet, sign-off. Use it with these plans. The plans here replace the "Scripted steps" tables in the rollout sessions with fuller steps and real data.
- [../user-guide/](../user-guide/README.md) explains how each area is meant to work. Testers can look things up there.
- [../finance-demo/](../finance-demo/README.md) is a presentation for the owner on a clean system. Plan 09 covers the same ground as a test on the shared test data.

---

## Setting up (for whoever runs the testing)

### 1. Build the test data

```bash
npm run db:testdata
```

This creates a separate database called `farmflow_uat` beside the development one, applies all migrations, and fills it by calling the app's own functions (so stock, the money ledger and batch costs all agree with each other). It takes about a minute. It also rewrites [Test-Data-Sheet.md](Test-Data-Sheet.md) with the real codes and figures.

- The development database is never touched.
- People who can sign in to the development system today are copied across with the same role, so they can sign in to the test data with the same password.
- **Running it again wipes everything testers have entered** and puts the data back to the starting point. Do this between rounds of testing, never during one.
- All dates are counted from the day you build it. If the data is more than a few days old, rebuild it, or the "due today" and "catch tomorrow" items will have gone stale.

For a hosted test instance, point it at that instance's database (the name must contain `uat`, `demo` or `test`):

```bash
TESTDATA_DATABASE_URL=postgresql://user:password@host:5432/farmflow_uat npm run db:testdata
```

### 2. Start the app on the test data

```bash
npm run dev:backend:testdata
```

```bash
npm run dev:frontend
```

To go back to the development data, stop the backend and start it the usual way (`npm run dev:backend`).

### 3. Sign-ins

Two kinds of people are in the test data:

| Who | What they are for |
|---|---|
| **Your existing sign-ins** (copied from the development system) | Running the plans. A system admin can do every step |
| **Made-up staff** with `@farmflow.test` addresses, one per role (see the data sheet, section 1) | The access checks: "what does a farm worker see?", "can the Main Farm manager open an Expansion 1 batch?" |

The made-up staff have no password yet. To give them one:

```bash
npm run db:testdata:signins
```

This creates the sign-ins in Firebase and prints a link for each person. Open a link, choose a password, and that person can sign in. Links last an hour; run the command again for new ones. Run it again after every rebuild.

For your real testers, register each one under **Settings → Users → Register User** with their own email. For the first round, giving process testers the **System admin** role is simplest: nothing is hidden and nothing waits for approval, so they can concentrate on whether the process fits. Use the made-up staff for the access checks.

### 4. Check it worked

Sign in and open **Home**. Cash on hand should match section 7 of the data sheet, there should be two batches growing, and the To do list should not be empty.

---

## What is in the test data

A small broiler business two and a half months into a season:

- **Two farms.** Main Farm (House 1, 2, 3) and Expansion 1 (House A, B).
- **Four batches.** `MF-H1-001` (Main Farm) and `EX-HB-001` (Expansion 1) are finished, sold and closed, so closed batches can be compared. `MF-H2-002` is about 33 days old and partly sold, with catches booked. `EX-HA-001` is two weeks old. House 3 and House B are empty; House 1 is being cleaned out.
- **A feed mill** with three recipes, nine completed production runs, one run in progress and one planned, and feed left over to send out.
- **Stock** in four stores, with purchase orders in every state: draft, waiting for approval, submitted, part received, received; invoices paid, part paid, unpaid and over-billed; a vaccine lot that has expired.
- **Five buyers** with different credit terms: two paid up, one late, one close to a small credit limit, two cheques waiting to clear.
- **Eight employees** across both farms, the mill and the office. Two months ago is fully paid. **Last month has attendance but payroll has not been run**: the payroll plan runs it.
- **Money:** three accounts, owner capital, a bank loan with two repayments, petty cash, and a ledger of about sixty movements that the balances can be checked against by hand.
- **Things waiting for someone:** a purchase order over the approval limit, a petty cash claim, an expense, an invoice, a service job, a stock request, a draft sale.

---

## For testers: how to work through a plan

1. Sign in with the sign-in you were given. Open your plan and the data sheet.
2. Do the tests **in order**. Each test says what it **uses** (records already in the system), the **steps**, and what you should **expect**.
3. Tick each expected result you see. If you see something else, don't try to fix it: write it down and carry on.
4. The "Should be refused" tests are meant to fail. The test passes when the app stops you with a clear message.
5. At the end, answer the questions at the bottom of your plan.

**Writing down a problem:** the test number, what you expected, what happened, and a screenshot. Send it to the person running the testing; they add it to the feedback sheet described in [../rollout/README.md](../rollout/README.md#3-capturing-feedback).

**Things that are not faults in the app**

- Figures that differ from the data sheet because someone else has already been working on the same data. The sheet is the starting point; the plans say "goes up by" or "drops by" wherever that can happen.
- The made-up names, prices and dates.

### Sharing one system

Everyone works in the same data, so each plan keeps to its own records:

| Plan | Works on |
|---|---|
| 02 Stock | The open purchase orders, the two stock requests, invoices `INV-AF-1003` and `INV-AC-2003`, the expired vaccine lot |
| 03 Feed mill | The run in progress, the planned run, feed left over from the **finisher** runs |
| 04 Farms | House 3 (new batch), today's check on `MF-H2-002`, health tasks, the House 1 clean-out |
| 05 Sales | Bookings, sales and cheques on `MF-H2-002` |
| 06 Payroll | Last month's payroll, advances |
| 07 Money | Petty cash claim, the expense, the two service jobs, owner and loan entries, the month from three months ago for the lock test |
| 01 Setup | The purchase order waiting for approval |
| 09 Finance | House B on Expansion 1 (its own new batch), feed left over from the **starter** run |

Two things to agree before starting:

- **Plans 02 and 03** both change raw material quantities at the mill. Either can go first; the plans allow for it.
- **Plan 09** compares totals before and after. Run it when nobody else is entering money, or the "before + change = after" sums will be off by whatever the other person entered.

---

## Known before you start

These came up while the test data and plans were being prepared (the plans' steps were run through the system once). They are listed so testers don't lose time on them. Where a test is affected it is marked ⚠ in the plan.

| # | Area | What happens | Plan |
|---|---|---|---|
| 1 | Sales | **Fixed during preparation.** Marking an *Other income* sale (litter, manure) as Reviewed failed with "Failed to update sale", so no receipt could be taken on it | 05 |
| 2 | Sales | Booking a catch checks birds placed − sold − booked, and **does not take off the birds that died**. A batch can be over-booked by the number of deaths | 05 |
| 3 | Farms | A daily check **dated before the batch was placed** is accepted | 04 |
| 4 | Stock | A user tied to one farm **can raise a stock request for another farm** | 02 |
| 5 | Feed mill | **Nutrition targets** (protein, energy, fibre, calcium) entered on a new recipe are not saved | 03 |
| 6 | Payroll | In **Generate Payroll**, "working days" starts equal to each person's days attended, and changing it changes both. Unless that is done carefully, an absent day does **not** reduce basic pay, which is not what the user guide says. To be confirmed on screen | 06 |
| 7 | Payroll | A day marked **on leave** is not counted as attended, so approved leave reduces pay. Is that how leave is paid? | 06 |
| 8 | Money | There is **no way to reverse a posted transaction** on screen, though the user guide describes it. Buyer cheques go received → cleared or bounced; there is no separate "deposited" step | 07, 05 |
| 9 | Money | Only purchase orders and money recorded by hand wait for approval over the limit. A **supplier payment, a staff advance or a payroll over the limit does not wait** | 01 |
| 10 | All | A few refusals come back as a general "failed" error rather than a clear validation message: paying an invoice that is not approved, a lorry whose loaded weight is less than its empty weight, settling an expense that is not approved, a movement dated in a locked month. The action is correctly refused | 02, 05, 07 |
| 11 | All | The server works out "today" in UTC. **Between midnight and 5:30 am Sri Lanka time it treats the date as yesterday**: ages are a day short, and a receipt dated today is left out of Owed to you until 5:30. This matters for catches and daily checks done before dawn | 04, 05 |
| 12 | Setup | A new installation has **no stock item types**; nothing can be added to stock until someone creates them under Settings. The test data creates six | 01 |
| 13 | Feed mill | A quality check can only be recorded while a run is **in progress**, not after it is completed | 03 |
| 14 | Farms | On a batch that is partly sold, **FCR and cost per kg are worked out on the kilos sold so far**, so they look far too high until the batch is sold out | 04 |
