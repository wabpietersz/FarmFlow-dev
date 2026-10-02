# 03 Feed mill

For the mill operator.

**Feed mill** in the top bar has four tabs:

| Tab | Use it for |
|---|---|
| **Inventory** | Raw materials on hand, their deliveries (lots) and cost |
| **Recipes** | What goes into each feed |
| **Production** | Making feed |
| **Distribution** | Sending feed to batches |

Buying raw materials is done under **Stock** (see [04 Stock](04-stock.md)). Deliveries of feed materials go into the **Feed Mill store**.

---

## Your day

1. Check **Production** for runs planned today.
2. Check **Inventory** has enough of each material.
3. Make the feed and **Complete Production** with the real quantities.
4. Send feed to the farms under **Distribution**.

---

## Raw materials

**Feed mill → Inventory** lists each material with its quantity and a count of lots.

- **View Lots** shows each delivery: when it came, from whom, how much is left, and what it cost per unit.
- When a run uses a material, the oldest delivery is used first, at that delivery's price. So the feed's cost is what the materials really cost.
- An item below its reorder level raises a low-stock alert. Use **Stock → Requests** to ask for more.

## Recipes

1. **Recipes → new recipe.** Name it and choose the feed type (starter, grower, finisher).
2. Add each ingredient from the stock list with its amount.
3. Enter the nutrition targets (protein, energy, fibre, calcium) if you use them.
4. Save. The recipe shows its cost per kg at today's material prices.

**Changing a recipe** makes a new version. Old versions are kept, so past production still shows what was actually used.

## Making feed

1. **Production → New Production Batch.** Choose the recipe, the quantity you plan to make, and the date.
2. FarmFlow shows how much of each material is needed.
3. When it's made: **Complete Production**. Enter:
   - the quantity actually made
   - the quantity of each material actually used, if different from plan
   - waste, with a reason
4. The materials come out of stock, oldest first.

**Quality check:** record a pass or fail with notes on the run.

**Cost Breakdown** on a completed run shows each material, which deliveries it came from, their prices, the total, and the cost per kg.

## Sending feed to the farms

1. **Distribution → New Distribution.**
2. Choose the production run, the batch receiving it, the quantity and date.
3. Save.

The batch is charged for that feed at the mill's real cost per kg. You can't send more than the run produced, and you can't send to a closed batch.

## What a kilo of feed costs

Feed cost per kg = **materials per kg** + **mill overhead per kg**.

- *Materials per kg* is what went into the run, at delivery prices.
- *Mill overhead per kg* is the month's mill wages (with employer EPF/ETF) and mill running costs (electricity, repairs, anything tagged to the Feed Mill), divided by the kg of feed made that month.

See it under **Reports → Cost Allocation** (mill overhead, feed produced, overhead per kg) and **Reports → Feed Analytics**.

This is why mill expenses must be tagged to the **Feed Mill** cost centre when they're entered.

## Common questions

**Complete Production says there isn't enough of a material.**
Check **View Lots**. The delivery may have been received into the wrong store; move it to the Feed Mill store under **Stock → Stores**.

**The cost per kg jumped.**
A new, dearer delivery of a material has started being used, or the month had little production to carry the overhead.

**I entered the wrong quantity on a completed run.**
Ask accounts. Completed runs have already moved stock and cost.
