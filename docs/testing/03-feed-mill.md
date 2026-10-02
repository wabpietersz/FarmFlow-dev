# Test plan 03: Feed mill

**For:** the mill operator.
**Time:** about 60 minutes.
**Sign in as:** a system admin (first round), or Saman Wijesinghe (feed mill operator) to test with the access a mill operator really has. Test M-11 needs someone with Money access.
**Have open:** [Test-Data-Sheet.md](Test-Data-Sheet.md), sections 3 (stock in the Feed mill store) and 4 (runs).
**User guide:** [Feed mill](../user-guide/03-feed-mill.md).

**What you will use** (already in the system):

| Record | How to recognise it |
|---|---|
| Raw materials in the Feed mill store | Corn, Soya meal, Fish meal (low), Vitamin premix |
| Three recipes | Broiler Starter (55 / 35 / 8 / 2), Broiler Grower (60 / 30 / 7 / 3), Broiler Finisher (65 / 28 / 5 / 2): corn / soya / fish meal / premix |
| A run **in progress** | Broiler Starter, 1,500 kg planned, dated yesterday |
| A run **planned** for today | Broiler Grower, 2,000 kg |
| Completed runs with feed left | The latest **Broiler Finisher** run: 5,000 kg made, 1,500 kg left. An older Finisher run: 3,460 kg made, 260 kg left |
| Batches that can receive feed | `MF-H2-002` (Main Farm), `EX-HA-001` (Expansion 1) |

Leave the **Broiler Starter** run that has 2,500 kg left alone: plan 09 uses it.

Quantities of raw materials may be higher than the data sheet if the stock plan has already received a delivery. The checks below say "drops by" for that reason.

---

## Part 1: Raw materials and recipes

### M-01 Raw materials

1. **Feed mill → Inventory.**
2. On **Corn**, open **View Lots**.

**Expect**
- [ ] Four raw materials with quantities and a count of lots. **Fish meal** is flagged low.
- [ ] Corn's lots list each delivery with its date, quantity left and cost per kg (118, 122, 125). The oldest delivery is used up or nearly so.

### M-02 A new recipe

1. **Feed mill → Recipes → new recipe.**
2. Name `Test Grower Plus`, feed type **grower**.
3. Ingredients: Corn **62**, Soya meal **30**, Fish meal **5**, Vitamin premix **3** (kg).
4. Targets: protein 20, energy 3000, fibre 4, calcium 1. Save.
5. Open the recipe again.

**Expect**
- [ ] The recipe is listed as active with its four ingredients.
- [ ] It shows a cost per kg worked out from current material prices (roughly Rs 190 to 200).
- [ ] ⚠ The nutrition targets should still be there when you reopen it. **They are currently not saved** (README, known item 5).
- [ ] Choosing an item that is not a feed material (for example Newcastle vaccine) as an ingredient is not possible.

### M-03 Change a recipe

1. Open **Broiler Finisher** and make a new version (change Corn to 66 and Soya meal to 27).

**Expect**
- [ ] A new version is created and is the active one.
- [ ] The earlier version is still visible in the recipe's history, and the completed runs made with it still show the old quantities.

---

## Part 2: Making feed

### M-04 Plan a run

1. **Feed mill → Production → New Production Batch.**
2. Recipe **Broiler Grower**, planned quantity **1,000** kg, date tomorrow. Save.

**Expect**
- [ ] The run is listed as **planned**.
- [ ] Materials needed: Corn **600**, Soya meal **300**, Fish meal **70**, Vitamin premix **30**.

### M-05 Quality check, then complete the run in progress

1. **Production** → the Broiler Starter run that is **in progress** (1,500 kg).
2. Record a quality check: note `Texture and moisture fine`.
3. **Complete**. Actual quantity made **1,480**. Waste **20**, reason `Spillage at the mixer`. Materials used: Corn **825**, Soya meal **525**, Fish meal **120**, Vitamin premix **30**. Save.

**Expect**
- [ ] The quality check is saved against the run.
- [ ] Status becomes **completed**; made 1,480 kg.
- [ ] **Inventory**: Corn drops by 825, Soya meal by 525, Fish meal by 120, Vitamin premix by 30.
- [ ] ⚠ A quality check can only be recorded while the run is in progress (README, known item 13). Is that the right moment?

### M-06 What the run cost

1. On the run you just completed, open **Cost Breakdown**.

**Expect**
- [ ] Each material is listed with the lot it came from, the supplier, the purchase order and the lot's price.
- [ ] Check one line by hand: Soya meal 525 kg × Rs 262 = **Rs 137,550**.
- [ ] Total cost **Rs 319,800**; cost per kg **Rs 216.08** (319,800 ÷ 1,480). The 20 kg of waste is why it is more than the materials alone would suggest.

(If the totals differ slightly, check which Corn lot was used: an older, cheaper lot may still have had stock.)

### M-07 Start and complete the planned run

1. **Production** → the Broiler Grower run planned for today (2,000 kg) → **Start**.
2. **Complete**. Actual quantity **2,000**, no waste. Materials: Corn **1,200**, Soya meal **600**, Fish meal **140**, Vitamin premix **60**.

**Expect**
- [ ] Status goes planned → in progress → completed.
- [ ] Raw materials drop by those amounts.
- [ ] Fish meal is now under 100 kg and still flagged low.

---

## Part 3: Sending feed to the farms

### M-08 Send feed to a batch

1. Before you start, open **Farms → Batches → MF-H2-002 → Performance & profit** and write down the **Feed** cost: Rs __________.
2. **Feed mill → Distribution → New Distribution.**
3. Production batch: the latest **Broiler Finisher** run (5,000 kg made). Farm batch `MF-H2-002`. Feed type finisher. Quantity **500** kg. Date today. Save.
4. Open the batch's **Performance & profit** again.

**Expect**
- [ ] The distribution is listed.
- [ ] The run's feed left drops from 1,500 to **1,000** kg.
- [ ] The batch's Feed cost has gone up by about **Rs 99,000**. Open the new line: it reads "finisher from PROD-… (materials …/kg + mill …/kg)", and 500 × the two rates added together is the increase.

### M-09 Send the run you made today

1. **Distribution → New Distribution.** Production batch: the Starter run from M-05. Farm batch `EX-HA-001`. Quantity **400** kg. Date today.

**Expect**
- [ ] Saved. `EX-HA-001`'s feed cost goes up by about 400 × 216 plus the mill's running cost per kg.

---

## Part 4: What a kilo of feed costs

### M-10 Cost allocation

1. **Reports → Cost Allocation.** Look at last month and two months ago.

**Expect**
- [ ] For each month: the mill's running costs (electricity, and mill wages once payroll for that month has been paid), the kg of feed made, and the overhead per kg.
- [ ] The month that holds the first mill electricity bill (**Rs 45,000**; find its date in the data sheet's list of money movements): the overhead is that bill plus the mill operator's wages and employer EPF/ETF for the month, and the kg made is the total of the runs dated in that month (data sheet, section 4).
- [ ] Overhead ÷ kg made = the "mill …/kg" figure you saw on the batch's feed line for a run from that month.

### M-11 A mill expense reaches the feed

(Needs Money access. Skip if you don't have it.)

1. **Money → Transactions → Record Treasury Movement.**
2. Manual Outflow, **Main Current Account**, Rs **20,000**, date today, category **Electricity**, cost centre **Feed Mill**, counterparty `CEB`, narrative `Mill electricity`. Save.
3. **Reports → Cost Allocation**, this month.

**Expect**
- [ ] The ledger shows the payment tagged to the Feed Mill.
- [ ] This month's mill overhead has gone up by 20,000, and the overhead per kg with it.

### M-12 Feed analytics

1. **Reports → Feed Analytics.**

**Expect**
- [ ] Production by recipe and feed sent to each batch make sense against the data sheet, section 4, plus what you entered today.

---

## Should be refused

| ID | Try | Expect | ✓ |
|---|---|---|---|
| M-R1 | **New Production Batch**: Broiler Starter, **10,000** kg. Start it, then **Complete** with the planned materials | Refused, naming a material there is not enough of (for example "Insufficient inventory for Soya meal: available …, needed 3500"). Then cancel the run | |
| M-R2 | **New Distribution** from the older Finisher run that has **260 kg** left: quantity **3,000** | Refused: only 260 available | |
| M-R3 | **New Distribution** to the closed batch `MF-H1-001` | Not offered in the list, or refused: the batch is closed | |
| M-R4 | Delete a completed run that has feed sent from it (any completed run in the data sheet that shows feed sent) | Refused or clearly warned | |
| M-R5 | Complete a run that is still **planned** (not started) | Not possible until it is started | |
| M-R6 | As **Saman Wijesinghe** (mill operator), type `/treasury` at the end of the address | Not authorised | |

---

## Questions for the tester

1. Is a "production run" the right unit? Do you make one recipe per run, or several in a day?
2. Is feed kept at the mill for a while before going to a farm? Do you need to see that stock by feed type?
3. Do you send feed to a **farm**, which then feeds several houses, or straight to a **batch**? (The app charges a batch.)
4. Do you weigh what goes into each run, or go by the recipe?
5. Is waste something you measure?
6. Would you enter this at the mill on a phone, or at the end of the day from a notebook?
7. Does Rs 190 to 220 per kg look believable against what you would pay outside?

## Passed when

You have made a run and sent feed to a batch without help, and checked one cost per kg by hand (materials used ÷ kg made, plus the mill's overhead per kg).
