# FarmFlow rollout and testing plan

**Date:** 2026-10-02
**Runs on:** the test instance ([../Test-Instance-Plan.md](../Test-Instance-Plan.md)).

**The main aim is feedback from the people who do the work.** A small group (five to seven people who know the farm, mill, stores, sales, accounts and payroll processes) uses the app on made-up data and tells us where it matches how they work and where it doesn't. The test scripts are there to give each session a route to follow and to catch outright faults; the feedback is the product.

| Order | Area | Session script | Who should be in the session |
|---|---|---|---|
| 0 | Setup, access, approvals, alerts | [01-setup-and-access.md](01-setup-and-access.md) | Owner |
| 1 | Stock and buying | [02-stock.md](02-stock.md) | Whoever orders and receives stock; accounts |
| 1 | Feed mill | [03-feed-mill.md](03-feed-mill.md) | Mill operator |
| 2 | Farms and batches | [04-farms.md](04-farms.md) | A farm manager (and a supervisor if one does the daily book) |
| 3 | Sales | [05-sales.md](05-sales.md) | Whoever agrees prices and weighs lorries; accounts |
| 4 | People and payroll | [06-people-payroll.md](06-people-payroll.md) | Whoever prepares payroll; owner |
| 5 | Money and reports | [07-money.md](07-money.md) | Accounts; owner |

**The step-by-step tests for each session, with test data already loaded, are in [../testing/](../testing/README.md).** Use the session scripts here for the questions to ask first and the feedback to draw out, and the test plans there for what to click and what to expect.

[../Manual-Test-Plan.md](../Manual-Test-Plan.md) is the one-sitting run through everything on an empty system (about 85 minutes). The deployer runs it after every deploy so the group never meets a broken build.

---

## 1. Why this order

Money is fed by every other area, so it comes last, when there is realistic activity to read. Stock comes before the mill and farms because both draw from it. Payroll comes late because it needs attendance.

```
0  Setup & access ──┐
1  Stock ──► Feed mill ──┐
2  Farms & batches ◄─────┘
3  Sales  (needs a growing batch)
4  People & payroll  (needs attendance)
5  Money & reports  (reads everything above)
```

## 2. How each area is run

Three steps per area, about a week each. Areas can overlap if people are free.

| Step | What | How long | Who |
|---|---|---|---|
| **1. Show how it's done today** | Before opening the app, the person describes their current process: the books, forms and spreadsheets, who signs what, what goes wrong. Write it down in half a page. | 30 min | User talks, facilitator writes |
| **2. Guided session** | The user drives, on their own phone or laptop, following the session script. The facilitator watches and notes every hesitation, wrong turn and comment. Don't take the mouse. | 60–90 min | User + facilitator |
| **3. Free use** | The user enters a few days of real-shaped work on their own (yesterday's deaths, last week's delivery, a real lorry weight with the names changed) and sends feedback as it comes up. | 3–5 days | User alone |
| **4. Review** | Go through the feedback together, agree what changes, and show the fixes when they land. | 30 min | User + facilitator + owner |

### Rules for the facilitator

- The user's hands are on the device, not yours.
- Ask "what would you expect to happen next?" before they tap.
- When they get stuck, wait ten seconds before helping, and note where it was.
- Don't defend the design. Write the comment down.
- Use their words for things. If they call a house a "shed" and the app says "house", that is feedback.

## 3. Capturing feedback

One shared sheet, one row per item. Voice notes and photos over WhatsApp are fine as the raw input; the facilitator copies them into the sheet the same day.

| ID | Date | Area / screen | From | What they said or did | Type | How much it matters | Decision | Status | Fixed in (tag) | Shown back to user |
|---|---|---|---|---|---|---|---|---|---|---|

**Type**

| Type | Meaning | Example |
|---|---|---|
| Fault | The app did something wrong | Balance didn't change after a receipt |
| Doesn't fit | The app works but not the way the process really runs | "We weigh lorries twice a day, not once per sale" |
| Missing | Something they need isn't there | "Where do I record the gas cylinders?" |
| Hard to use | They could do it but it was slow or confusing | Couldn't find Today's check |
| Wording | A label or message they didn't understand | "What is a cost centre?" |
| Like | Something that worked well (keep it) | "The to-do list is what I look at first" |

**How much it matters**

| Level | Meaning | Rule |
|---|---|---|
| 1 | Wrong money, wrong stock, lost data, or someone sees what they shouldn't | Stop. Fix before anything else. |
| 2 | They couldn't finish a main task, or the app can't follow the real process | Fix before that area is signed off. |
| 3 | Works with a workaround, or slow | Fix before go-live, or the owner accepts it in writing. |
| 4 | Wording, layout, nice-to-have | Backlog. |

**Decision** is made at the review by the owner: *fix now*, *fix before go-live*, *later*, or *won't change* (with the reason told to the person who raised it). Every item gets an answer; nothing is silently dropped.

### Questions to ask at every review

1. Which parts would you use every day? Which would you never use?
2. What did you still write on paper while using it, and why?
3. What did the app ask for that you don't know at that moment?
4. What do you know at that moment that the app didn't ask for?
5. Is anything in the wrong order compared with how the work actually goes?
6. Which words didn't mean anything to you?
7. Would you trust this number? If not, what would you check it against?
8. Could you do this on your phone at the farm, with the signal you get there?

## 4. Timetable

| Week | Area | What happens |
|---|---|---|
| 1 | 0 | Instance set up, the group's sign-ins created, access agreed, baseline export taken and restored once |
| 2 | 1 | Stock and mill sessions and free use |
| 3 | 2 | A test batch placed with a back-dated placement date; the farm manager does Today's check on their phone daily, including one day with no signal |
| 4 | 3 | Bookings, a sale with real-looking lorry weights, receipts, a bounced cheque |
| 5 | 4 | A payroll month for made-up employees, EPF/ETF return |
| 6 | 5 | Month-end checklist, profit & loss, cash flow, batch close. Finance demo to the owner ([../finance-demo/README.md](../finance-demo/README.md)). |
| 7 | — | Fix and show back. Go/no-go meeting. |
| 8 | — | Production set up, opening data loaded, go-live |

## 5. Who does what

| Role | Person | Does |
|---|---|---|
| Rollout lead | Owner | Chooses the group, decides on each feedback item, signs off each area |
| Facilitator | (name) | Runs sessions, keeps the feedback sheet |
| Deployer | (name) | Deploys, restores baseline, makes fixes |
| Process users | One per area | Use it, say what they think |

The facilitator and deployer can be the same person.

## 6. When an area has passed

- The user has done the main daily task without help at least three times.
- Every test in the script is ticked or has a row in the feedback sheet.
- No open level 1 or 2 items in that area.
- Every item raised has a decision, and the person who raised it has been told.
- The user says they would use it instead of the current method. If they wouldn't, find out why before signing.
- The owner has signed the table in section 9.

## 7. Checks that apply to every area

Run once per area, on that area's screens.

| ID | Check | Expected |
|---|---|---|
| X-1 | Open the area on the user's own phone | Bottom bar shows; tables scroll; forms usable with one hand |
| X-2 | Switch to dark theme | Everything readable; status colours still distinct |
| X-3 | Sign in as a user with **None** for this area | The area is missing from the menu; typing its address shows "not authorised" |
| X-4 | Sign in as a user with **User** (not Admin) access | Daily entry works; approve, delete and setup actions are missing or refused |
| X-5 | Sign in as a user tied to Farm A | Only Farm A records appear; opening a Farm B record by address is refused |
| X-6 | Leave a required field empty and save | A clear message beside the field; nothing saved |
| X-7 | Change something in a locked month (after a period lock is set in area 5) | Refused, with a message naming the lock |

## 8. Go-live preparation

### Opening data to collect (start in week 1; it takes longest)

| Data | Source | Goes into | Who |
|---|---|---|---|
| Farms and houses with capacities | Site records | Farms → Sites & houses | Farm managers |
| Employees: names, start dates, pay, EPF numbers, bank details, farm / mill / admin | HR files | People → Employees | Accounts |
| Leave balances at go-live date | HR files | People → Attendance → Leave Balances | Accounts |
| Outstanding staff advances and loans | Ledger book | People → Payroll → Advances & loans | Accounts |
| Suppliers and their terms | Purchase records | Stock → Suppliers | Accounts |
| Stock items with reorder levels | Store records | Stock → Inventory | Store keeper |
| **Stock count** at go-live date, per store, with cost and expiry | Physical count | Stock (received as opening lots) | Store keeper + accounts |
| Feed recipes | Mill | Feed mill → Recipes | Mill operator |
| Buyers with credit limits and terms | Sales book | Sales → Buyers | Accounts |
| **Money owed by buyers** at go-live date | Sales book | Opening sales per buyer | Accounts |
| **Money owed to suppliers** at go-live date | Purchase book | Opening invoices per supplier | Accounts |
| Money accounts with **opening balances** matching bank statements | Bank statements, cash count | Money → Accounts | Accounts |
| Outstanding business loans | Loan statements | Money → Owner & loans | Owner |
| Batches currently growing | Farm books | Farms → Batches | Farm managers |
| Vaccination programme and breed growth curve | Vet, breed guide | Settings → Health & growth | Farm managers + vet |
| Approval limits | Owner decision | Settings → Approvals | Owner |
| EPF/ETF rates | Statute (8 / 12 / 3) | Settings → Payroll | Accounts |

**Decision needed:** how to bring in batches that are already growing. The cleanest option is to go live when new batches are being placed and finish the old ones on paper. The alternative is to enter each live batch with its real placement date and a summary of costs so far; its profit figure will be less exact.

### Cut-over

1. Pick a go-live date at a month start, so payroll and profit & loss start clean.
2. Freeze paper entries the evening before; count stock and cash.
3. Load opening data in the order of the table above.
4. Check: account balances equal bank statements and the cash count; stock totals equal the count; owed-to-you and payables equal the books.
5. Owner signs the opening position.
6. Run paper and FarmFlow side by side for the first month; compare at month-end, then drop paper.

### Go / no-go checklist

- [ ] All areas signed.
- [ ] No open level 1 or 2 items; level 3 fixed or accepted.
- [ ] Each process user says they would use it for their daily work.
- [ ] Finance demo delivered; owner accepts how the numbers tie together.
- [ ] Opening data checked and signed.
- [ ] Production security checklist complete (Test Instance Plan section 7, repeated for production).
- [ ] A backup has been restored successfully at least once.
- [ ] Every user has signed in to production and set their password.
- [ ] Someone is named as first contact for problems in the first month.

## 9. Sign-off

| Order | Area | Process user | Passed on | Open items accepted | Signed (owner) |
|---|---|---|---|---|---|
| 0 | Setup and access | | | | |
| 1 | Stock | | | | |
| 1 | Feed mill | | | | |
| 2 | Farms | | | | |
| 3 | Sales | | | | |
| 4 | People and payroll | | | | |
| 5 | Money and reports | | | | |
