# Finance demo: how the money ties together

**Audience:** the owner and accounts.
**Length:** 45 minutes to present, plus questions.
**Runs on:** the test instance, restored to the clean baseline.

## What the demo shows

One small batch, from the owner putting money in to the batch being sold, with every rupee followed through to four places:

1. the **account balances**
2. the **ledger** (what each rupee was for, and where it belongs)
3. the **batch's cost and profit**
4. the month's **profit & loss** and **cash flow**

The point to land: nothing is typed twice, and the four views agree. Where they differ, the difference can be explained line by line.

## The pack

| File | Use |
|---|---|
| [Demo-Script.md](Demo-Script.md) | What to click, what to say, and the number to expect at each step |
| [Money-Map.md](Money-Map.md) | One-page picture of how money flows, the category list, and the rules. Print or show as the opening and closing slide |
| [Tie-Out-Sheet.md](Tie-Out-Sheet.md) | The expected final numbers and how they reconcile. Hand out at the end; also the answer sheet for the rehearsal |

## Before the demo

### 1. Rehearse it once, end to end

**These numbers were worked out by hand from how the system is built. They have not yet been run through the app.** Do a full rehearsal on the test instance and tick every expected figure in the Tie-Out Sheet. If a figure differs, find out why before presenting: it is either a setup slip, a mistake in this script, or a fault worth knowing about. The lines most likely to need adjusting are marked ⚠ in the sheet.

### 2. Two ways to present

| Way | How | Good for |
|---|---|---|
| **Live** | Enter everything during the demo | Accounts, who need to see where each entry is made. About 75 minutes |
| **Prepared** (recommended for the owner) | Enter Acts 1–5 beforehand. In the demo, walk through what was entered, do the sale receipt and the owner drawing live, then spend the time on Acts 6–7 | The owner, who wants to see the numbers tie. About 45 minutes |

### 3. Set up (30 minutes)

Restore the clean baseline, then make sure these exist. All amounts are in rupees.

| What | Where | Values |
|---|---|---|
| Farm | Farms → Sites & houses | **Main Farm** with house **House 1** |
| Money accounts | Money → Accounts | **Main Current Account** opening 750,000 · **Main Cash Safe** opening 120,000 · **Farm Petty Cash Float** opening 0 |
| Supplier | Stock → Suppliers | **Agri Feeds** |
| Stock items | Stock → Inventory | **Corn** (feed type, kg) · **Newcastle vaccine** (health type, dose) |
| Recipe | Feed mill → Recipes | **Demo Grower**: 100% Corn (one ingredient keeps the arithmetic visible) |
| Buyer | Sales → Buyers | **Fresh Mart**, 7-day terms, credit limit 2,000,000 |
| Employee | People → Employees | **Demo Worker**, Main Farm, basic 40,000 a month, EPF member, no allowances |
| No other employees with pay | | Deactivate or leave others out of the month's payroll, so labour is one clean figure |
| EPF/ETF rates | Settings → Payroll | 8 / 12 / 3 |
| Approval limits | Settings → Approvals | Leave empty for the demo, or set above 400,000 so nothing waits |
| Health programme | Settings → Health & growth | At least one Newcastle vaccination task |

### 4. Dates

- Date **every** entry inside the current month. Mill overhead per kg and the profit & loss are worked out by month, so entries that straddle two months will change the figures.
- Place the batch on the 1st of the month.
- Mark the Demo Worker **present for every working day** of the month. Pay is pro-rated by attendance; missing days will reduce the 40,000.
- Only one batch should be growing anywhere in the system. Shared costs are split by bird-days, and with one batch it takes all of them, which keeps the numbers checkable.

## After the demo

Leave the data in place for a few days so accounts can explore it, then restore the baseline.

Collect feedback with the questions at the end of the script and add it to the rollout feedback sheet.
