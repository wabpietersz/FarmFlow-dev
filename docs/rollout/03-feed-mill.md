# Session 1b: Feed mill

**With:** the mill operator.
**Time:** 60–90 minutes.
**Guide:** [../user-guide/03-feed-mill.md](../user-guide/03-feed-mill.md)
**Before:** raw materials received into the Feed Mill store (Session 1a), with known prices.

## Ask first: how it's done today

- How is a recipe written down? How often does it change?
- How do you decide what to make and how much?
- What is weighed, and what is estimated?
- How is waste or spillage recorded?
- How does feed leave the mill: bags or bulk, by which vehicle, with what paper?
- Does anyone know today what a kilo of feed costs?

## Scripted steps

| ID | Step | Expected | ✓ |
|---|---|---|---|
| M-1 | **Feed mill → Inventory.** | Raw materials show quantities and a lot count; **View Lots** lists each delivery with its cost | |
| M-2 | **Recipes**: create a recipe from stock items, with percentages or quantities and the nutrition targets. | Saved; shows a cost per kg worked out from current stock prices | |
| M-3 | Change the recipe. | A new version is made; the old one is kept in the history | |
| M-4 | **Production → New Production Batch** from the recipe, with a planned quantity and date. | Listed as planned; needed materials shown | |
| M-5 | **Complete Production**: enter the actual quantity made and any waste with a reason. | Raw materials drop, oldest stock first; status completed | |
| M-6 | Open **Cost Breakdown** on the completed run. | Each material with the lots used and their actual cost; total and cost per kg | |
| M-7 | Record a quality check (pass, with a note). | Saved against the run | |
| M-8 | **Distribution → New Distribution**: send feed from the run to a growing batch. | The batch's feed cost goes up by quantity × mill cost per kg | |
| M-9 | Record a mill expense (**Money → Transactions → Record Treasury Movement**, money out, category Electricity, cost centre Feed Mill). | Appears in the ledger tagged to the mill | |
| M-10 | **Reports → Cost Allocation.** | Shows mill overhead, feed produced, and overhead per kg for the month | |
| M-11 | Reopen the batch that received feed. | Its feed cost now includes the overhead per kg | |
| M-12 | **Reports → Feed Analytics.** | Production and usage charts make sense for what was entered | |

## Should be refused

| ID | Try | Expected |
|---|---|---|
| M-R1 | Complete a run that needs more of a material than is in stock | Refused, naming the material |
| M-R2 | Distribute more feed than the run produced | Refused |
| M-R3 | Distribute feed to a closed batch | Refused |
| M-R4 | Delete a completed run that has been distributed | Refused or warned |

## Feedback to draw out

- Is a "production run" the right unit? Do you make one recipe per run, or several in a day?
- Is feed kept in the mill for a while before it goes to a farm, and do you need to see that stock by feed type (starter, grower, finisher)?
- Do you dispatch to a **farm** and the farm then feeds several houses, or straight to a **batch**? (The app charges a batch.)
- Is waste something you actually measure?
- Would you enter this at the mill on a phone, or at the end of the day from a notebook?
- Do the cost per kg figures look believable against what you'd pay outside?

## Passed when

The operator has made a run and sent feed to a batch unaided, and the cost per kg has been checked by hand once (materials used ÷ kg made, plus overhead per kg).
