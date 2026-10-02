# Running all the plans in one go, finance first

For one person working through everything on a freshly built test database, starting with how money connects to every area.

## Before you start

1. Build the data (already done if you were handed this): `npm run db:testdata`
2. Start the backend on the test data: `npm run dev:backend:testdata` (stop the normal backend first; both use port 3001).
3. Start the frontend: `npm run dev:frontend`
4. Sign in with your usual sign-in. **Home → Cash on hand** should read the figure in [Test-Data-Sheet.md](Test-Data-Sheet.md), section 7. If it does, you are on the test data.
5. Only if you want to do the access checks: `npm run db:testdata:signins`, and open the links it prints.

## The order

| # | Plan | Time | Why here |
|---|---|---|---|
| 1 | [09 Finance from start to finish](09-finance-end-to-end.md) | 75 min | Needs untouched data: its "before" figures then match the ones printed in the plan |
| 2 | [07 Money](07-money.md) | 90 min | The rest of the money screens, while the ledger is still short enough to read |
| 3 | [02 Stock and buying](02-stock.md) | 90 min | Puts raw materials into the mill |
| 4 | [03 Feed mill](03-feed-mill.md) | 60 min | Uses those raw materials |
| 5 | [04 Farms and batches](04-farms.md) | 90 min | |
| 6 | [05 Sales](05-sales.md) | 90 min | |
| 7 | [06 People and payroll](06-people-payroll.md) | 90 min | |
| 8 | [01 Setup, access and approvals](01-setup-and-access.md) | 60 min | Needs the made-up staff sign-ins for most of it |
| 9 | [08 Reports and Home](08-reports-and-home.md) | 45 min | Last, so there is plenty to read |

About eleven hours in all. Each plan can be stopped and picked up later; the data stays as you left it until someone rebuilds.

## What doing plan 09 first changes in the later plans

Plan 09 adds a batch, a sale to Fresh Mart and several money movements. The later plans mostly say "goes up by" or "drops by", so they still hold. These are the places where a later plan quotes a figure "on untouched data" that will now be different:

| Plan | Test | Plan says | After plan 09 it is |
|---|---|---|---|
| All | Any account balance or Cash on hand quoted from the data sheet | Data sheet figure | Main Current Account and Cash on hand are **704,400 higher**. The Safe and the petty cash float are unchanged |
| 07 Money | Y-01, Y-02 | Balances as in the data sheet | Main Cash Safe still works out to 457,600. Main Current Account is 4,297,402.31 |
| 07 Money | Y-03 | Three kinds of line for `MF-H1-001`, five Electricity payments | Unchanged. You will also see plan 09's lines dated today |
| 07 Money | Y-06 | All of the Expansion 1 electricity goes to `EX-HA-001` | It is **shared** between `EX-HA-001` and `EX-HB-FLOW` for the days both were there this month. If `EX-HB-FLOW` is closed and sold out today, its share is small |
| 07 Money | Y-14 | Write down this month's net profit first | It starts at 304,400, not 0. The test only checks that it does **not move** |
| 07 Money | Y-15 | Loan still owed 2,750,000 → 2,625,000 | 2,700,000 → **2,575,000** |
| 07 Money | Y-17 | Compare view | Expansion 1 now shows income (the 400,000 received) |
| 02 Stock | S-03 | Vitamins & electrolytes: Expansion 1 store 5 | **14** (10 bought, 1 used) |
| 02 Stock | S-18 | Acme Suppliers shows only `INV-AC-2004` awaiting approval | Also lists `INV-FLOW-01` as paid in its statement |
| 03 Feed mill | "Leave the Broiler Starter run with 2,500 kg left alone" | 2,500 kg left | 1,500 kg left; plan 09 is finished with it, so it is free to use |
| 04 Farms | "Leave House B on Expansion 1 empty" | Empty | Being cleaned out after `EX-HB-FLOW` |
| 04 Farms | F-17 | Two closed batches | **Three**: `MF-H1-001`, `EX-HB-001` and `EX-HB-FLOW` |
| 04 Farms | F-18 | Three batches growing | Three (`EX-HB-FLOW` is closed, so it is not counted) |
| 05 Sales | L-01 | Fresh Mart has one sale, paid in full | Two sales; it owes **237,000** |
| 05 Sales | L-13 | Fresh Mart is not listed | Fresh Mart: **237,000**, not yet due |
| 05 Sales | L-14 | Statement shows two sales and ends at 0 | Three sales (add 637,000) and ends at **237,000** |
| 01 Setup | A-02 | Cash on hand equals the data sheet | 704,400 higher, plus whatever the other plans moved |
| 08 Reports | R-01, R-06 | Four test batches | Add `EX-HB-FLOW` and `MF-H3-003` |

## If you want to start again

`npm run db:testdata` puts everything back to the starting point in about a minute. It wipes everything entered, so note your findings first. Restart the backend afterwards.
