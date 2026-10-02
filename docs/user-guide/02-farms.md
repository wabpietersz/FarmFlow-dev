# 02 Farms

For farm managers and supervisors.

**Farms** in the top bar has four pages:

| Page | Use it for |
|---|---|
| **Batches** | Starting batches, daily checks, costs, closing |
| **Sites & houses** | Your farms and their houses |
| **Health & houses** | Vaccinations and treatments due, vet visits, house cleaning between batches |
| **Farm control** | Approving things, service work (repairs, contractors), farm-level usage, locking months |

---

## Your day

1. **Home → To do.** See what's due.
2. For each batch: **Today's check**.
3. **Health & houses → Due now.** Do or skip what's due.
4. Mark attendance (see [07 People and payroll](07-people-payroll.md)).
5. If you're short of anything: **Stock → Requests** (see [04 Stock](04-stock.md)).

---

## Starting a batch

1. **Farms → Batches → New batch.**
2. Choose the farm and house, enter the number of chicks and the placement date. Save.
3. Open the batch and record the **Chick Placement**: how many arrived, how many were dead on arrival, and what the chicks cost.

FarmFlow adds the vaccination programme for you. Each task is dated from the placement date. If you change the placement date, the tasks move with it.

A house can hold one batch at a time.

## Today's check

Open the batch → **Today's check**. It's built for a phone.

| Enter | Notes |
|---|---|
| Deaths | Pick a cause. If there were none, enter 0 so the day isn't flagged as missing |
| Culls | Birds removed on purpose |
| Feed used | In kg |
| Water | In litres |
| Average weight | When you weighed |
| Temperature | And humidity if you measure it |
| Notes | Anything unusual |

After saving you see live birds, and your actual weight against the target for that age.

**No signal?** Enter it anyway. It sends when you're back in range (see [01 Getting started](01-getting-started.md)).

**Made a mistake?** Open the batch's daily records and edit that day.

Live birds are always worked out for you: chicks placed − deaths − culls − birds sold.

## Health tasks

**Farms → Health & houses → Due now** lists every vaccination and treatment due or overdue across your batches.

- **Done**: records it and takes the vaccine or medicine from stock. Your farm's own store is used first, then the Main store. Stock with the nearest expiry date goes first. Expired stock is never used.
- **Skip**: you must give a reason.

If Done says there's no stock, move some to your farm's store or request it.

The other tabs:

| Tab | Use |
|---|---|
| **Houses** | The cleaning and rest checklist between batches. It starts by itself when a batch is sold or closed and ends when the next batch is placed |
| **Vet visits** | Record a visit: findings, treatment, cost |
| **Programmes** | The day-by-day health plans (set up with your vet) |
| **Growth curves** | Target weight by age (from your breed guide) |

The example programme and curve that come with FarmFlow are placeholders. Replace them with your vet's programme and your breed's guide.

## Farm costs that aren't stock

- **Small cash spending** (fuel, a repair part): petty cash. See [06 Money](06-money.md).
- **Repairs and contractors:** **Farm control → service work**. Create it, and settle it when the work is done and paid.
- **Usage on the farm not tied to one batch:** **Farm control → site consumption**.

These are shared between the batches on your farm by bird-days, so a big batch that was there all month takes more than a small one that arrived last week.

## What a batch has cost, and what it made

Open the batch → **Performance & profit**.

| Line | Where it comes from |
|---|---|
| Chicks | The chick placement |
| Feed | Feed sent from the mill, at the mill's real cost per kg (materials plus mill wages and running costs) |
| Medicine and vaccines | Stock used on health tasks, at what it was bought for |
| Labour | Your farm's wages plus employer EPF/ETF, shared by bird-days |
| Farm costs | Electricity, fuel, repairs and petty cash for your farm, shared by bird-days |
| Admin share | Office costs shared across all farms by bird-days |
| **Revenue** | Sales of birds from this batch |
| **Profit** | Revenue − total cost |

You also see FCR, mortality %, cost per bird and cost per kg. Tap a cost line to see where it came from.

While a batch is growing these numbers move every day.

## Closing a batch

When all birds are sold:

1. Open the batch → **Close this batch**.
2. FarmFlow checks that every bird is accounted for: placed − deaths − culls − sold should be 0. If it isn't, it tells you the difference. Find the missing entry, or choose **Close anyway and record the difference**.
3. Once closed, the costs, revenue and results are frozen. Nothing more can be entered against the batch.

If a cost arrives after closing, FarmFlow reports it rather than changing the frozen numbers. A batch can be reopened by someone with permission.

**Batches → history** compares closed batches and marks the best FCR, EPEF and profit.

## Sites and houses

**Farms → Sites & houses.** Open a farm to add or edit its houses and their capacity. Adding a farm also creates its store and its cost centre.

## Common questions

**Home says a daily log is missing, but there was nothing to report.**
Enter the check with 0 deaths and the feed used.

**The live bird count is wrong.**
Check the chick placement (dead on arrival), then each day's deaths and culls, then the sales.

**A batch has been growing more than 90 days.**
FarmFlow warns about this and stops charging shared costs to it. Close it, or correct its dates.

**I can't see the other farm.**
Your sign-in is tied to your farm. That's deliberate.
