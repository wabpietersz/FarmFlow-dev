# Test plan 04: Farms and batches

**For:** a farm manager, and a supervisor if they keep the daily book.
**Time:** about 90 minutes at a desk, then a week of daily checks on a phone.
**Sign in as:** a system admin (first round). The farm-by-farm checks use Nimal Perera (Main Farm) and Dilani Jayawardena (Expansion 1).
**Have open:** [Test-Data-Sheet.md](Test-Data-Sheet.md), section 2 (farms, houses, batches, health tasks).
**User guide:** [Farms](../user-guide/02-farms.md).

**What you will use** (already in the system):

| Record | How to recognise it |
|---|---|
| `MF-H2-002` | Main Farm, House 2. About 33 days old, a daily check for every day up to yesterday, partly sold. One health task overdue (Gumboro booster) |
| `EX-HA-001` | Expansion 1, House A. 14 days old. **No daily check yesterday.** A Gumboro vaccination due today |
| `MF-H1-001` | Main Farm, House 1. Finished, sold and **closed** |
| `EX-HB-001` | Expansion 1, House B. Also finished, sold and **closed**, with weaker results, so there are two closed batches to compare. House B is empty again |
| House 3 (Main Farm) | Empty: you will place a new batch here |
| House 1 (Main Farm) | Being cleaned out: old litter out and washed are done |
| Vaccine in the farm stores | Main Farm store and Expansion 1 store (data sheet, section 3) |

Leave **House B** on Expansion 1 empty: plan 09 uses it.

---

## Part 1: A new batch

### F-01 Place a batch

1. **Farms → Batches → New batch.**
2. Farm **Main Farm**, house **House 3**, batch code `MF-H3-003`, chicks **1,000**, placement date **3 days ago**. Save.
3. Open the batch.

**Expect**
- [ ] The batch is created and House 3 now shows as occupied under **Farms → Sites & houses → Main Farm**.
- [ ] It already has five health tasks, dated from the placement date: day 1, 7, 14, 21 and 24. The day-1 task (Vitamins & electrolytes) is already overdue.

### F-02 Record the chicks that arrived

1. On the batch: **Chick Placement**.
2. Supplier **Lanka Hatcheries**, placement date 3 days ago, invoice reference `LH-TEST-1`, delivered **1,010**, dead on arrival **10**, cost per chick **150**. Save.

**Expect**
- [ ] Chicks placed shows **1,000** (1,010 − 10).
- [ ] **Performance & profit** shows chick cost **Rs 150,000**.
- [ ] The vaccination tasks plan 1,000 doses each (and 2 sachets of vitamins).

### F-03 Move the placement date

1. Open **Chick Placement** again and change the placement date to **4 days ago**. Save.
2. Look at the health tasks.

**Expect**
- [ ] Every task that is not yet done has moved one day earlier.

---

## Part 2: The daily check

### F-04 Today's check, on a phone

1. On your phone: **Farms → Batches → MF-H2-002 → Today's check.**
2. Before entering anything, read the live bird count shown: __________.
3. Deaths **3**, cause **Weakness**. Feed **380** kg. Water **700** litres. Average weight **2,050** g. Temperature **27**. Save.

**Expect**
- [ ] The form is usable with one hand; nothing needs sideways scrolling.
- [ ] After saving, live birds = the count you wrote down − 3.
- [ ] Your 2,050 g is shown against the target for that age (about 2,000 g at 33 days).
- [ ] The overdue Gumboro booster is shown on the same screen as something due.
- [ ] Home no longer lists `MF-H2-002` as needing today's check.

### F-05 The check that was missed

`EX-HA-001` has no check for yesterday.

1. **Home → To do.** Find the missing daily check and follow it. (Or: **Farms → Batches → EX-HA-001 → Today's check**.)
2. Enter today's check: deaths **2**, cause **Unknown**, feed **150** kg. Save.
3. Find a way to enter **yesterday's** check as well: deaths 1, feed 140 kg.

**Expect**
- [ ] Today's check saves and live birds drop by 2.
- [ ] Yesterday's can also be entered, and the batch's daily records then have no gap.
- [ ] If you could not find how to enter yesterday's, write that down.

### F-06 Correct a day

1. **Farms → Batches → MF-H2-002** → daily records → yesterday's row → **Edit**.
2. Add one to the deaths. Save.

**Expect**
- [ ] The change is saved.
- [ ] The batch's live bird count is one lower than before.

### F-07 With no signal

1. On your phone, open the app with signal, then switch to aeroplane mode.
2. Open `MF-H3-003` → **Today's check**. Deaths **0**, feed **12** kg. Save.
3. Switch signal back on.

**Expect**
- [ ] With no signal, a banner says you are offline and that one entry is waiting.
- [ ] When signal returns it is sent by itself, and the check appears on the batch.

---

## Part 3: Health

### F-08 Mark a vaccination done

1. **Farms → Health & care → Due now.**
2. Find **Gumboro (IBD)** for `EX-HA-001` (due today, 2,500 doses). Choose **Done**, date today.
3. **Stock → Stores**: look at Gumboro vaccine.

**Expect**
- [ ] The task leaves the Due now list and shows as done on the batch.
- [ ] Gumboro vaccine in the **Expansion 1 store** drops from 3,000 to **500**. The Main store is not touched: the farm's own store is used first.
- [ ] `EX-HA-001` → **Performance & profit**: medicine and vaccines goes up by **Rs 15,000** (2,500 × 6).

### F-09 Mark the overdue vitamins done

1. **Due now** → **Vitamins & electrolytes (arrival)** for `MF-H3-003` → **Done**.

**Expect**
- [ ] Vitamins & electrolytes in the **Main Farm store** drops by **2** sachets.
- [ ] The batch's medicine cost goes up by **Rs 900** (2 × 450).

### F-10 Skip a task

1. **Due now** → **Gumboro booster (IBD)** for `MF-H2-002` (overdue) → **Skip**.
2. Try to save with no reason. Then give the reason `Vet advised no booster`.

**Expect**
- [ ] With no reason it is refused ("Say why it was skipped").
- [ ] With a reason it is marked skipped, the reason is kept, and no stock is used.
- [ ] Home's "health task overdue" item has gone.

### F-11 A vet visit

1. **Farms → Health & care → Vet visits** → record a visit.
2. Farm **Main Farm**, batch `MF-H2-002`, date today, vet `Dr. S. Perera`, reason `Follow-up`, findings `Litter dry, birds even`, treatment `None`, fee **12,000**. Save.

**Expect**
- [ ] The visit is listed. An earlier visit (fee 15,000) is also there.
- [ ] Note whether the fee appears in the batch's **Performance & profit**, and under which line. (The user guide says the cost is recorded; whether it is charged to the batch here, or only when it is paid through Money, is a question for accounts.)

---

## Part 4: Costs, closing, the house

### F-12 What the batch has cost

1. **Farms → Batches → MF-H2-002 → Performance & profit.**

**Expect**
- [ ] Chicks: **Rs 465,000** (3,000 × 155).
- [ ] Feed: several lines, one per delivery from the mill, each at "materials per kg + mill per kg".
- [ ] Medicine and vaccines: one line for each vaccination done, at the price the vaccine was bought for.
- [ ] Labour: a share of Main Farm's wages for the months that have been paid.
- [ ] Farm costs: shares of Main Farm's electricity, fuel, repairs and bedding. Each line says how it was shared ("… of … bird-days").
- [ ] Admin share: shares of insurance, bank charges and loan interest.
- [ ] Tapping a line shows where it came from.
- [ ] ⚠ FCR and cost per kg look far too high, because they are worked out on the kilos **sold so far** while the batch still has birds (README, known item 14). Is that how you would want to see a batch that is partly sold?

### F-13 Use something on the farm that isn't for one batch

1. **Farms → Farm control → Site consumption** → record a use.
2. Farm **Main Farm**, item **Wood shavings**, quantity **10** bags, date today, note `Top-up bedding`. Save.

**Expect**
- [ ] Wood shavings in the Main Farm store drops from 20 to **10**.
- [ ] The cost (10 × 350 = Rs 3,500) is shared between the batches on Main Farm in proportion to bird-days: `MF-H2-002` takes most of it, `MF-H3-003` a little.

### F-14 A closed batch

1. **Farms → Batches** → `MF-H1-001`.
2. Compare what you see with the data sheet, section 2, "Closed batches".

**Expect**
- [ ] It is marked closed. Revenue, total cost, profit, FCR, mortality and cost per kg match the data sheet.
- [ ] There is no way to add a daily check, a vaccination or a cost.
- [ ] 2,000 placed − 60 died − 1,940 sold = 0 birds unaccounted for.

### F-15 Try to close a batch that still has birds

1. **Farms → Batches → MF-H2-002 → Close this batch.**

**Expect**
- [ ] It is refused and tells you how many birds are not accounted for, with placed, deaths and sold.
- [ ] It offers to close anyway and record the difference. **Don't.** Cancel.

### F-16 Finish cleaning out a house

1. **Farms → Health & care → Houses.** Find **House 1** on Main Farm.
2. **Old litter out** and **Washed** already have dates. Fill in **Disinfected** (yesterday), **New litter in** (today) and **Ready for chicks** (today).

**Expect**
- [ ] The clean-out shows as finished, with the number of days the house was empty.
- [ ] **Farms → Sites & houses → Main Farm**: House 1 is empty and can take a new batch.

### F-17 Compare closed batches

1. **Farms → Batches → Compare closed batches.**

**Expect**
- [ ] Two closed batches are listed, `MF-H1-001` (Main Farm) and `EX-HB-001` (Expansion 1), each with age, mortality, FCR, average weight, EPEF, cost per kg and profit. The figures match the data sheet, section 2, "Closed batches".
- [ ] The best value in each column is marked. `MF-H1-001` has the better mortality (3% against 5%), FCR, EPEF and profit per bird; `EX-HB-001` has the lower cost per kg.
- [ ] The averages at the top are the averages of the two rows.

### F-18 Home

1. **Home.**

**Expect**
- [ ] Three batches growing now, each with live birds, mortality and average weight.
- [ ] To do reflects what you have done: no overdue health task, no missing check.

---

## Should be refused

| ID | Try | Expect | ✓ |
|---|---|---|---|
| F-R1 | **New batch** in **House 2** (already holding `MF-H2-002`) | Refused: the house is already occupied. (The message says "Cage". Is "house" the word you would use?) | |
| F-R2 | **Today's check** on `MF-H2-002` with deaths **5,000** | Refused: deaths can't exceed the birds alive | |
| F-R3 | Add or edit a daily record on the closed batch `MF-H1-001` | Not possible: the batch is closed | |
| F-R4 | As **Nimal Perera** (Main Farm), open `EX-HA-001` | Not in his list; refused by address: "This belongs to another farm" | |
| F-R5 | As **Dilani Jayawardena** (Expansion 1), do Today's check on `MF-H2-002` | Not in her list; refused | |
| F-R6 ⚠ | A daily check on `MF-H3-003` dated **10 days ago** (before it was placed) | Should be refused. **It is currently accepted** (README, known item 3). If you saved one, tell the person running the testing so it can be removed | |
| F-R7 | As **Sunil Bandara** (farm worker), look for **New batch** | No such button. He can do Today's check and mark health tasks | |

---

## The free-use week

Do **Today's check** every day for a week on `MF-H2-002` or `MF-H3-003`, using the real numbers from one of your houses. On at least one day, do it where the signal is worst, and once before dawn.

⚠ Before 5:30 in the morning the app may show the batch's age a day short and date things as yesterday (README, known item 11). Note it if you see it.

## Questions for the tester

1. Is Today's check quicker or slower than the book? What did you still write on paper?
2. Is one batch = one house right for you? Or do you split a delivery of chicks across houses and think of it as one flock?
3. Are the mortality causes the ones you use?
4. Do you weigh birds daily, weekly, or only before catching?
5. Would you trust the Due now list instead of the wall chart?
6. Does the cost so far look believable? Which line surprised you?
7. Did it work with no signal where you actually stand to do the check?
8. Culls (birds removed on purpose): was there a place for them?

## Passed when

A week of daily checks has been entered on a phone, including one with no signal, and you can read a batch's cost and say which lines you believe.
