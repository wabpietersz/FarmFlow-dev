# Test plan 05: Sales

**For:** whoever agrees prices with buyers, whoever weighs the lorries, and accounts.
**Time:** about 90 minutes.
**Sign in as:** a system admin (first round). The credit-limit check uses Ruwan Fernando (accountant) and Nimal Perera (farm manager).
**Have open:** [Test-Data-Sheet.md](Test-Data-Sheet.md), section 5 (buyers, sales, bookings, cheques).
**User guide:** [Sales](../user-guide/05-sales.md).

The route being tested: **booking → sale → reviewed → receipt → paid**, then cheques, credit limits and who owes what.

**What you will use** (already in the system):

| Record | How to recognise it |
|---|---|
| Batch `MF-H2-002` | Main Farm. 3,000 placed, 70 died, 750 sold: **2,180 live birds**, of which 1,600 are booked |
| A booking for **tomorrow** | Fresh Mart, 1,000 birds, 2.1 kg, Rs 640 per kg |
| A booking in three days | Lanka Chicken Co, 600 birds |
| A **draft** sale | City Poultry, 300 birds, 615 kg, Rs 390,525, dated yesterday |
| A sale paid by two cheques, neither cleared | Lanka Chicken Co, Rs 512,000. Cheques **445501** (Rs 300,000) and **445502** (Rs 212,000) |
| A buyer near their limit | Afflan Traders: limit Rs 100,000, owes Rs 64,000 |
| Late payers | City Poultry owes Rs 419,150, over a month late. Lanka Chicken Co owes Rs 467,840, a few days late |

The sale codes are in the data sheet.

If the farms plan has recorded more deaths on `MF-H2-002` today, live birds will be a few lower than above.

---

## Part 1: Buyers and bookings

### L-01 Buyers

1. **Sales → Buyers.** Open **Fresh Mart**.

**Expect**
- [ ] Five buyers with terms and limits as in the data sheet (the fifth, Wayamba Processors, bought the closed batch `EX-HB-001`, has paid in full, and is not used in this plan): Fresh Mart 14 days / 3,000,000; City Poultry 0 days / no limit; Lanka Chicken Co 30 days / 2,000,000; Afflan Traders 7 days / 100,000.
- [ ] Fresh Mart's page shows its sale of Rs 1,382,400, paid in full.

### L-02 Book a catch

1. **Sales → Bookings → Book a catch.**
2. Buyer **City Poultry**, batch `MF-H2-002`, catch date **the day after tomorrow**, birds **300**, expected weight **2.0** kg, price **630** per kg. Save.

**Expect**
- [ ] Expected value shown: **Rs 378,000** (300 × 2.0 × 630).
- [ ] Three upcoming bookings now: Fresh Mart 1,000, Lanka Chicken Co 600, City Poultry 300.
- [ ] **Home → To do** mentions booked catches in the next 3 days.

---

## Part 2: A sale from start to paid

### L-03 Make the sale from a booking

1. **Sales → Bookings** → the Fresh Mart booking for tomorrow → **Make the sale**.
2. The buyer, batch and price are already filled in. Set the sale date to **today**.
3. First lorry: number `WP LK-4521`, birds **600**, empty weight **3,200** kg, loaded weight **4,470** kg.
4. Add a second lorry: `WP LK-4522`, birds **400**, empty **3,100**, loaded **3,945**.
5. Save.

**Expect**
- [ ] Net weight 1,270 + 845 = **2,115 kg**. Sale amount **Rs 1,353,600** (2,115 × 640).
- [ ] The sale is a **draft**. Its due date is 14 days from today (Fresh Mart's terms).
- [ ] The booking now shows **Sold**.
- [ ] `MF-H2-002`'s live birds have dropped by 1,000.

### L-04 Review

1. Open the sale. Check both lorries. **Mark Reviewed**.

**Expect**
- [ ] Status **reviewed**. **Add Receipt** is now available.
- [ ] The lorries and price can no longer be edited.

### L-05 Part payment by bank

1. On the sale: **Add Receipt**. Receipt date today.
2. One line: **bank transfer**, Rs **1,000,000**, into **Main Current Account**, reference `FM-TRF-1`. Save.

**Expect**
- [ ] The sale shows received 1,000,000, outstanding **Rs 353,600**.
- [ ] **Money → Ledger**: Rs 1,000,000 in, category **Bird Sales**, cost centre Main Farm, batch `MF-H2-002`.
- [ ] Main Current Account is up by 1,000,000.

### L-06 A receipt split between cash and a cheque

1. **Add Receipt** again. Receipt date today.
2. Line 1: **cash**, Rs **153,600**, into **Main Cash Safe**.
3. Add a line: **cheque**, Rs **200,000**, into **Main Current Account**, cheque number `778801`, cheque date today, bank `HNB`. Save.

**Expect**
- [ ] The cash is in: Main Cash Safe is up by 153,600.
- [ ] The cheque is **not** money yet: Main Current Account has not changed, and the sale still shows **Rs 200,000** outstanding.
- [ ] The sale is still **reviewed**, not completed.

### L-07 The cheque clears

1. **Money → Cheques → Pending Buyer Cheque Receipts.** Find cheque `778801`. **Clear**.

**Expect**
- [ ] Main Current Account goes up by 200,000.
- [ ] The sale is now **completed**, outstanding 0.
- [ ] ⚠ There is one step from received to cleared; no separate "deposited" step (README, known item 8). Do you need one?

### L-08 The invoice

1. On the sale, download the **invoice** PDF.

**Expect**
- [ ] Buyer, date, both lorries with their weights, price per kg, total Rs 1,353,600, and the receipts.
- [ ] Would you hand this to Fresh Mart as it is?

---

## Part 3: Cheques that were already waiting

### L-09 Clear one, bounce the other

1. **Money → Cheques → Pending Buyer Cheque Receipts.**
2. Cheque **445501** (Rs 300,000, Lanka Chicken Co): **Clear**.
3. Cheque **445502** (Rs 212,000): **Bounce**.

**Expect**
- [ ] After clearing 445501: Main Current Account up by 300,000.
- [ ] After bouncing 445502: no money moves. It appears under **Bounced Incoming History**.
- [ ] The Lanka Chicken Co sale of Rs 512,000 shows received 300,000, outstanding **Rs 212,000**, still **reviewed**.

---

## Part 4: The draft sale, an overpayment, other income

### L-10 Review the draft sale

1. **Sales → Sales** → the draft sale to **City Poultry** (Rs 390,525).
2. Check the lorry: 300 birds, empty 2,900, loaded 3,515, net 615 kg at Rs 635.
3. **Mark Reviewed**.

**Expect**
- [ ] 615 × 635 = **Rs 390,525**. Status reviewed.
- [ ] **Sales → Owed to you**: City Poultry now owes 419,150 + 390,525 = **Rs 809,675**. (A draft was not counted.)

### L-11 The buyer pays too much

1. On that sale: **Add Receipt**: bank transfer, Rs **400,000**, into Main Current Account. Save.

**Expect**
- [ ] The sale is **completed**.
- [ ] The extra **Rs 9,475** is kept as credit for City Poultry.
- [ ] **Money → Ledger**: two lines for this receipt: **Bird Sales 390,525** and **Customer Advances 9,475**.

### L-12 Other income, and the credit is used

1. **Sales → Other income.**
2. What: `Litter`. Quantity **50**, unit `bag`, unit price **200**. Buyer **City Poultry**. Farm **Main Farm**. No batch. Date today. Save.
3. Open it and **Mark Reviewed**.

**Expect**
- [ ] Amount **Rs 10,000**.
- [ ] On review, City Poultry's credit of 9,475 is used automatically: the sale shows 9,475 received and **Rs 525** outstanding.
- [ ] ⚠ Before preparation of these plans, Mark Reviewed failed on other income (README, known item 1). It should work now.

4. **Add Receipt**: cash, Rs **525**, into Main Cash Safe.

**Expect**
- [ ] The sale is completed.
- [ ] **Money → Ledger**: the Rs 525 is **Other Farm Income**, not Bird Sales, tagged to Main Farm with no batch.
- [ ] The invoice PDF for this sale says "Litter, 50 bag".

---

## Part 5: Who owes what

### L-13 Owed to you

1. **Sales → Owed to you.**

**Expect** (if you have done every step above and nobody else has taken receipts)

| Buyer | Not yet due | 1–30 days | 31–60 days | Total |
|---|---|---|---|---|
| City Poultry | | | 419,150 | **419,150** |
| Lanka Chicken Co | 212,000 | 467,840 | | **679,840** |
| Afflan Traders | 64,000 | | | **64,000** |

- [ ] The figures match. Fresh Mart is not listed (owes nothing).
- [ ] The total owed equals **Home → Owed to you**.
- [ ] ⚠ Before 5:30 in the morning, receipts dated today are left out until 5:30 (README, known item 11).

### L-14 A statement

1. On Fresh Mart, open **Statement**. Period: the first of two months ago to today. **Download PDF**.

**Expect**
- [ ] Two sales (1,382,400 and 1,353,600), the receipts against them, and a running balance ending at 0.
- [ ] Would you send this to the buyer?

---

## Part 6: Credit limit, and cancelling

### L-15 A sale over the buyer's limit

Afflan Traders owes Rs 64,000 against a limit of Rs 100,000.

1. **Sales → Sales → New sale.** Buyer **Afflan Traders**, batch `MF-H2-002`, date today, price **640**.
2. Lorry `NW CA-7710`, birds **100**, empty **1,500**, loaded **1,700**. Save.

**Expect**
- [ ] 200 kg × 640 = Rs 128,000. It is **blocked**: Afflan Traders would owe Rs 192,000, over their limit of Rs 100,000.
- [ ] As a system admin (or accountant) you are asked for a reason.

3. Give the reason `Paying cash on delivery tomorrow`. Save.

**Expect**
- [ ] The sale is saved. Its notes read "Over credit limit by Rs 92,000: Paying cash on delivery tomorrow".

### L-16 Cancel a sale

1. Open the Afflan Traders sale you just made (it has no receipts). Cancel it.

**Expect**
- [ ] The sale is cancelled. Afflan Traders still owes only Rs 64,000.
- [ ] `MF-H2-002`'s live birds go back up by 100.

### L-17 Cancelling a sale made from a booking

1. **Sales → Bookings** → the Lanka Chicken Co booking (600 birds) → **Make the sale**. One lorry: 600 birds, empty 3,000, loaded 4,300. Save.
2. Check the booking shows **Sold**.
3. Open the new sale and cancel it.

**Expect**
- [ ] The booking goes back to **upcoming**, and the 600 birds are booked again rather than sold.

---

## Should be refused

| ID | Try | Expect | ✓ |
|---|---|---|---|
| L-R1 ⚠ | **Book a catch** on `MF-H2-002` for **1,000** birds | Refused, with the number still free. The right number is live birds − booked. **It currently shows about 70 too many**, because deaths are not taken off (README, known item 2) | |
| L-R2 | **Add Receipt** on a draft sale (make one and don't review it) | Not available, or refused: "Review the sale before recording receipts" | |
| L-R3 | A lorry with loaded weight **less** than empty weight | Refused. ⚠ The message may be a general "failed to create sale" (README, known item 10) | |
| L-R4 | Cancel the Fresh Mart sale from L-03 (it has receipts) | Refused: it has payments | |
| L-R5 | As **Nimal Perera** (farm manager), repeat L-15 | Blocked, and told to ask a sales admin. He is not offered the reason box | |
| L-R6 | A cheque receipt line with no cheque number | Refused: cheque number and date are required | |
| L-R7 | A new sale with no lorries | Refused | |

---

## Questions for the tester

1. Do you really book before catching, or is it agreed by phone the night before and nothing more?
2. Is the price always per kg live weight? Ever per bird?
3. One weighing per lorry, or are crates weighed in lots? Would you enter weights at the weighbridge on a phone?
4. Which deductions happen in practice (dead on arrival, crates, transport)? Was there a place for them?
5. Is "Mark Reviewed" a check someone really does, or an extra step?
6. Would you enforce credit limits, or override them every time?
7. One lorry carrying birds from two houses or two farms: does that happen?
8. When a cheque bounces, what do you do next, and did the app help?

## Passed when

One booking has been taken through to a fully paid sale and one cheque has bounced, and the Owed to you figures match a hand calculation.
