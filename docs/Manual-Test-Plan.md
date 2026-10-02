# FarmFlow manual test plan

Data was reset on 2026-10-01. What's left is setup only: two farms (Main Farm, Expansion 1), 5 houses, 7 employees, buyers **Fresh Mart** and **Afflan** (7-day terms, Rs 100,000 limit), suppliers **Agri Feeds** and **Acme suppliers**, and 3 money accounts: **Main Current Account** Rs 750,000, **Main Cash Safe** Rs 120,000 and **Farm Petty Cash Float** Rs 0. Stock items exist with quantity 0. No batches, sales, payroll or money movements are left.

Backup from before the reset (inside the database container): `/tmp/before_reset_20261001_0617.dump`

Work through the sections **in order**. Each one uses what the previous one created. Tick each **Check** as you go.

---

## 0. Setup (5 min)

1. **Settings → Stores.** You should see Main store, Feed Mill store, and one store per farm.
2. **Settings → Stock item types.** Make sure there is a *health* type (vaccines/medicine) and a *feed* type.
3. **Stock → Inventory → add item.** Add "Newcastle vaccine": health type, unit "dose", supplier Acme suppliers, reorder level 500.
4. **People → Employees → edit two employees:**
   - Michael Schumacher: EPF number `EPF-001`, EPF member ticked.
   - George Russell: EPF number `EPF-002`, EPF member ticked.
   - Max Verstappen: untick EPF member (casual).
5. **Settings → Payroll.** Rates should show 8 / 12 / 3.

- [ ] Check: the farm stores exist; the new item shows quantity 0; the employee page shows the EPF number.

---

## 1. Buying stock (15 min)

**Request → order → receive into a store → move → invoice → pay**

1. **Stock → Requests → Request stock.** Cost centre Main Farm: Newcastle vaccine 2,000, Corn 5,000.
2. Approve it, then **Create purchase order**. Supplier Acme suppliers; prices: vaccine Rs 5, Corn Rs 120.
   - [ ] Check: a draft PO for Rs 610,000 appears under Purchase Orders, and the request shows "Ordered on PO-…".
3. Submit the PO, then **Receive**:
   - **Receive into:** Main store.
   - **Vaccine:** receive 2,000, expiry date about 20 days from today.
   - **Corn:** receive only 3,000.
   - [ ] Check: the PO is "partially received". **Stock → Stores** shows vaccine 2,000 and Corn 3,000 in Main store, and **Expiring soon** lists the vaccine.
4. **Stock → Stores → Move stock.** Move 1,000 vaccine doses from Main store to the Main Farm store.
   - [ ] Check: Main store 1,000 + Main Farm store 1,000; the item total is still 2,000.
5. **Write-off:** on the expiring list, write off 50 doses with the reason "Broken vials".
   - [ ] Check: vaccine total 1,950.
6. **Stock → Invoices → new invoice** for this PO, amount **Rs 610,000** (more than the Rs 370,000 actually received).
   - [ ] Check: the Match column shows **Over-billed · Rs 240,000**.
7. **Farm control → Approve** the invoice. It should ask for a reason. Cancel instead.
8. Receive the remaining 2,000 Corn on the PO.
   - [ ] Check: the invoice Match changes to **Matches goods**, and approving no longer asks for a reason.
9. Pay the invoice (Stock → Invoices → pay) from Main Current Account.
   - [ ] Check: **Money → ledger** shows the payment, tagged by what was bought (medicine / feed raw materials).

---

## 2. A batch on the farm (15 min)

1. **Farms → Batches → New batch.** Main Farm, house Cage-01, 5,000 chicks, placement 25 days ago.
   - Pay for the chicks through Money if the screen offers it: category *Day-old Chicks*, Main Current Account.
2. Open the batch → **Today's check.** Record today's mortality (e.g. 12, cause "Heat"), feed used and an average weight.
   - [ ] Check: live birds = 5,000 − deaths, and actual vs target weight shows against the growth curve.
3. **Farms → Health & care → Tasks.** The batch should have health tasks from the vaccination programme. Mark one vaccination **Done** (it uses Newcastle vaccine).
   - [ ] Check: vaccine stock in the **Main Farm store** goes down first (the farm's own store is used before Main store).
4. **Home:** the to-do list shows overdue/due health tasks and "expiring stock".

---

## 3. Sales (20 min)

**Booking → sale → receipt → owed to you**

1. **Sales → Bookings → Book a catch.** Fresh Mart, your new batch, catch date tomorrow, 2,000 birds, 2.2 kg each, Rs 650/kg.
   - [ ] Check: expected value ≈ Rs 2,860,000; Home shows "1 booked catch in the next 3 days".
2. Book another 4,000 birds from the same batch.
   - [ ] Check: it is refused ("Only … birds … are not already sold or booked").
3. On the first booking click **Make the sale.** The form is filled in. Lorry: 2,000 birds, empty weight 3,000 kg, loaded 7,400 kg. Save.
   - [ ] Check: the sale is Rs 2,860,000 (4,400 kg × 650), and the booking shows **Sold**.
4. Open the sale → **Mark Reviewed** → **Add Receipt** of Rs 1,000,000 by bank transfer into Main Current Account.
   - [ ] Check: Money → ledger shows Rs 1,000,000 as **Bird Sales**, tagged to the batch. Outstanding is Rs 1,860,000.
5. **Credit limit:** make a new sale to **Afflan** (limit Rs 100,000) for 200 birds, 400 kg at Rs 650 (Rs 260,000).
   - [ ] Check: it is blocked with "over their limit". As admin, enter a reason and save. The reason appears in the sale notes.
6. **Other income:** **Sales → Other income → Litter**, 50 bags × Rs 200, buyer Fresh Mart, farm Main Farm.
   - Mark it reviewed, then take a cash receipt of Rs 10,000 into Main Cash Safe.
   - [ ] Check: Money shows **Other Farm Income**, not Bird Sales. The invoice PDF says "Litter 50 bags".
7. **Sales → Owed to you.**
   - [ ] Check: Fresh Mart Rs 1,860,000 not yet due; Afflan Rs 260,000 (over limit flagged).
   - **Statement → Download PDF** for Fresh Mart shows the sale, the litter, both receipts and the running balance.
8. Cancel the Afflan sale (it has no receipts).
   - [ ] Check: it disappears from Owed to you.

---

## 4. Payroll (20 min)

**Advance → attendance → generate → approve → pay → EPF/ETF**

1. **Payroll → Advances & loans → Advance or loan.**
   - Salary advance of Rs 5,000 to George Russell, from Main Cash Safe, taken back from this month.
   - Staff loan of Rs 30,000 to Michael Schumacher at Rs 10,000/month from this month, from Main Current Account.
   - [ ] Check: both show "Recovering". Money shows two outflows as **Staff Advances & Loans**.
2. **People → Attendance:** bulk-mark this month's attendance for a few days for these employees, if you want days-based pay.
3. **Payroll → Pay runs → Generate Payroll** for this month.
   - [ ] Check, in the preview's "EPF / advances" column:
     - Michael: EPF 8% plus a 10,000 loan instalment.
     - George: EPF 8% plus the 5,000 advance.
     - Max: no EPF (not a member).
4. Generate, then for each payroll: open it → **Review** → **Approve**.
5. **Payroll → Month & payslips:**
   - [ ] Check: the totals cards (gross, net, employer EPF+ETF, labour cost) add up.
   - Download George's payslip. It should show EPF 8%, "Advance ADV-…" and the employer EPF/ETF line.
   - Download the **bank transfer list**. It warns about employees with no bank details.
6. **Pay N approved** from Main Current Account by bank transfer.
   - [ ] Check:
     - The bank balance drops by the **net pay total only**.
     - The advance shows **Paid back**.
     - Michael's loan shows Rs 20,000 left.
     - In Money → ledger, each payment shows Wages going out, plus EPF withheld and advance recovered coming in.
7. **Payroll → EPF / ETF:**
   - [ ] Check: total EPF = 20% and ETF = 3% of members' earnings; Max is not listed.
   - **Pay EPF/ETF** from Main Current Account with reference "C-form 09".
   - [ ] Check: it shows **Paid**; paying again is refused.
8. **Advances & loans → Paid back directly** on Michael's loan: Rs 5,000 cash into Main Cash Safe.
   - [ ] Check: Rs 15,000 left.

---

## 5. Money, costs and access (10 min)

1. **Money:**
   - [ ] Check: account balances match what you did (opening balance − purchases − wages − EPF + receipts). There should be no "Uncategorized" lines.
2. **Farms → batch → Performance / costing:**
   - [ ] Check: cost includes chicks, feed and medicine used, and labour (gross + employer EPF/ETF for Main Farm staff). Revenue includes the bird sale and the litter.
3. **Settings → Access & roles:** set **Sales** to *None* for *Farm Worker*.
   - Sign in as a farm-worker user in a private window.
   - [ ] Check: Sales is gone from the top bar.
4. **Settings → Users → Register User** with a first and last name.
   - [ ] Check: the reset email arrives (look in spam; only the newest link works).

---

### When something's wrong, note:
- the section and step number;
- what you expected;
- what you saw, with a screenshot.
