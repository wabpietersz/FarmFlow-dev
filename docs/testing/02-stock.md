# Test plan 02: Stock and buying

**For:** whoever orders and receives stock, and accounts (invoices and payment).
**Time:** about 90 minutes.
**Sign in as:** a system admin (first round). The access checks at the end use Nimal Perera and Kamal Silva.
**Have open:** [Test-Data-Sheet.md](Test-Data-Sheet.md), section 3 (stock, purchase orders, invoices, requests).
**User guide:** [Stock](../user-guide/04-stock.md).

The route being tested: **request → purchase order → receive → invoice → pay**, then stores, expiry and tracing.

**What you will use** (all already in the system):

| Record | How to recognise it |
|---|---|
| A stock request waiting for review | From Nimal Perera, Main Farm: Vitamins & electrolytes × 20, Disinfectant × 10 |
| A stock request already approved | From Kamal Silva, Expansion 1: Wood shavings × 80 |
| A **draft** purchase order | Acme Suppliers, Disinfectant × 40, Rs 48,000 |
| A **submitted** purchase order, nothing received | Acme Suppliers, Newcastle vaccine × 5,000 and Vitamins × 50, Rs 50,500 |
| A **part-received** purchase order | Agri Feeds, "Third raw material order", Rs 2,060,000: Corn 5,000 of 8,000 received, Soya meal 0 of 4,000 |
| Invoice **INV-AF-1003** | Agri Feeds, Rs 2,060,000, billed in full for that part-received order: shows over-billed |
| Invoice **INV-AC-2003** | Acme Suppliers, Rs 44,000, approved, not paid |
| An expired lot | Gumboro vaccine, 400 doses, in the Main store |

The purchase order codes are in the data sheet.

---

## Part 1: Looking at stock

### S-01 The inventory list

1. **Stock → Inventory.**

**Expect**
- [ ] Nine items. Quantities match the "Total" column in the data sheet, section 3.
- [ ] **Fish meal** and **Wood shavings** are flagged as low (at or below their reorder level).

### S-02 Add an item

1. **Stock → Inventory → add item.**
2. Name `Coccidiostat`, type **Medicine**, unit `bottle`, supplier **Acme Suppliers**, quantity 0, cost 2,400, reorder level 5. Save.

**Expect**
- [ ] It is in the list with quantity 0.
- [ ] Leaving the supplier empty and saving is refused with a message beside the field.

### S-03 What is in each store

1. **Stock → Stores.**

**Expect**
- [ ] Four stores: Main store, Feed mill store, Main Farm store, Expansion 1 store.
- [ ] Quantities per store match the data sheet. For example Newcastle vaccine: Main store 6,000, Main Farm store 1,000, Expansion 1 store 500.
- [ ] The expiring list shows a Gumboro vaccine lot of 400 doses in the Main store as **expired**, and a Newcastle vaccine lot in the Main Farm store expiring within a month.

---

## Part 2: Request → order

### S-04 Raise a request

1. **Stock → Requests → Request stock.**
2. For: **Main Farm**. Item: **Disinfectant**, quantity 5. Needed by: a week from today. Save.

**Expect**
- [ ] The request is listed as waiting for review, with your name.

### S-05 Approve a request

1. In **Requests**, open Nimal Perera's request (Vitamins × 20, Disinfectant × 10).
2. Approve it.

**Expect**
- [ ] Status changes to **approved**.
- [ ] **Create purchase order** is now offered on it.

### S-06 Turn an approved request into an order

1. In **Requests**, open Kamal Silva's approved request (Wood shavings × 80).
2. **Create purchase order.** Supplier **Acme Suppliers**, order date today, price **350** per bag.

**Expect**
- [ ] A **draft** purchase order appears under **Purchase orders**, total **Rs 28,000**.
- [ ] The request now shows it has been ordered, with the purchase order's code.

### S-07 Submit an order

1. **Stock → Purchase orders.** Find the draft order to Acme Suppliers for Disinfectant × 40 (Rs 48,000).
2. Open it. Check the line: 40 litres at 1,200.
3. **Submit**.

**Expect**
- [ ] Status changes to **submitted**. (It is under the Rs 1,000,000 limit, so it does not wait.)
- [ ] It can no longer be edited.

---

## Part 3: Receiving, and checking the bill against it

### S-08 Receive part of a delivery

1. **Purchase orders** → the submitted order to Acme Suppliers for Newcastle vaccine × 5,000 and Vitamins × 50 → **Receive stock**.
2. **Receive into:** Main store.
3. Newcastle vaccine: receive **5,000**, expiry date **20 days from today**.
4. Vitamins & electrolytes: receive **30** (not 50), expiry date **one year from today**.
5. Save.

**Expect**
- [ ] The order is **partially received**.
- [ ] **Stores**: Main store Newcastle vaccine goes up by 5,000 (6,000 → 11,000); Vitamins & electrolytes goes up by 30 (70 → 100).
- [ ] The new Newcastle lot is in the expiring list (20 days).

### S-09 A bill for more than has arrived

Agri Feeds has billed the whole of the "Third raw material order" (Rs 2,060,000), but only 5,000 kg of corn (Rs 625,000) has arrived.

1. **Stock → Invoices.** Find **INV-AF-1003** and read its **Match** column.
2. **Farms → Farm control → Approvals** → INV-AF-1003 → **Approve**, with no reason.

**Expect**
- [ ] Match shows **Over-billed · Rs 1,435,000**.
- [ ] Approving is refused: the invoice is more than the goods received; receive the rest or give a reason. **Cancel.**

### S-10 The rest arrives, and the match corrects itself

1. **Purchase orders** → Agri Feeds, "Third raw material order" → **Receive stock**.
2. **Receive into:** Feed mill store. Corn: **3,000**. Soya meal: **4,000**. Save.
3. **Stock → Invoices**: read the Match on INV-AF-1003 again.
4. **Farms → Farm control → Approvals** → INV-AF-1003 → **Approve**.

**Expect**
- [ ] The order is **received**.
- [ ] Feed mill store: Corn up by 3,000, Soya meal up by 4,000.
- [ ] **Feed mill → Inventory → View Lots** on Corn shows a new lot of 3,000 kg at Rs 125.
- [ ] The invoice's Match now shows **Matches goods**, and approving goes through without asking for a reason.

### S-11 Record a new invoice

1. **Stock → Invoices → Record Supplier Invoice.**
2. Supplier **Acme Suppliers**; purchase order: the vaccine and vitamins order from S-08; reference `INV-AC-2004`; invoice date today; due date 30 days from today; amount **50,500**. Save.

**Expect**
- [ ] Match shows **Over-billed · Rs 9,200**. (Received: 5,000 × 5.50 + 30 × 460 = 41,300. Billed: 50,500.)

Leave this invoice unapproved.

---

## Part 4: Stores

### S-12 Move stock to a farm

1. **Stock → Stores → Move stock.**
2. From **Main store** to **Main Farm store**: Newcastle vaccine, **2,000** doses. Date today. Save.

**Expect**
- [ ] Main store goes down by 2,000 and Main Farm store goes up by 2,000.
- [ ] The item's total on the **Inventory** tab has not changed.

### S-13 Expired stock cannot be used

The Main store holds 2,400 doses of Gumboro vaccine: 2,000 in date and 400 expired.

1. **Stock → Stores → Move stock.** From **Main store** to **Expansion 1 store**: Gumboro vaccine, **2,200** doses.

**Expect**
- [ ] Refused: only 2,000 available, and it says 400 more is expired and can't be used.

### S-14 Write off expired stock

1. **Stock → Stores**, expiring list → the expired Gumboro vaccine lot (400 doses, Main store) → **Write off**.
2. Reason: `Expired`. Write off the whole lot.

**Expect**
- [ ] Gumboro vaccine in the Main store drops from 2,400 to **2,000**; the item total drops by 400.
- [ ] The lot is no longer in the expiring list.
- [ ] The reason is kept (see it under **Traceability** for that lot).

### S-15 Issue stock to a batch

1. **Stock → Inventory** → **Disinfectant** → **Consume Inventory to Batch**.
2. Batch `MF-H2-002`, quantity **2**, date today, note `Footbath`. **Record Consumption**.

**Expect**
- [ ] Disinfectant total drops by 2. It comes out of the **Main Farm store** (20 → 18), because the batch is on Main Farm.
- [ ] **Farms → Batches → MF-H2-002 → Performance & profit**: a new cost line for Disinfectant of **Rs 2,300** (2 × 1,150).

---

## Part 5: Paying

### S-16 Pay an invoice by bank transfer

1. **Stock → Invoices** → INV-AF-1003 → **Pay supplier** (Record Supplier Payment).
2. Account **Main Current Account**, method bank transfer, date today, amount **2,060,000**, reference `BT-AF-1003`. Save.

**Expect**
- [ ] The invoice shows as paid.
- [ ] **Money → Ledger**: one line of **Rs 2,060,000** out, category **Feed Raw Materials**, cost centre **Feed Mill**. Nobody chose that category: it came from the item type.
- [ ] **Money → Accounts**: Main Current Account is down by 2,060,000.

### S-17 Pay an invoice by cheque

1. **Stock → Invoices** → **INV-AC-2003** (Rs 44,000) → **Pay supplier**.
2. Account **Main Current Account**, method **cheque**, choose the next available cheque leaf, date today, amount **44,000**. Save.

**Expect**
- [ ] The invoice shows as paid.
- [ ] **Money → Cheques → Outgoing Cheques**: that leaf is **Issued** for Rs 44,000 to Acme Suppliers.
- [ ] Main Current Account does **not** drop yet. It drops when the cheque is marked cleared (Money plan).

### S-18 What is still owed

1. **Money → Payables.**

**Expect**
- [ ] **Agri Feeds** owes only **INV-AF-1002: Rs 1,248,500**, shown as late.
- [ ] **Acme Suppliers** shows `INV-AC-2004` (Rs 50,500) as awaiting approval.
- [ ] The statement for Agri Feeds lists each invoice and each payment.

---

## Part 6: Tracing and alerts

### S-19 Trace a lot

1. **Stock → Traceability.** Choose the first Corn lot (the oldest; from the "Opening raw materials" order).

**Expect**
- [ ] Where it came from: Agri Feeds, the purchase order, 14,520 kg at Rs 118, the date received.
- [ ] Where it went: the production runs that used it, with quantities.

### S-20 Low stock

1. Look at the bell and at **Home → To do**.

**Expect**
- [ ] Fish meal and Wood shavings are reported as low. (The bell is refreshed every 30 minutes.)

---

## Should be refused

| ID | Try | Expect | ✓ |
|---|---|---|---|
| S-R1 | On any submitted order, **Receive stock** with a quantity of `-5` on one line and a valid quantity on another | Refused; **nothing** from that delivery is booked in, including the valid line | |
| S-R2 | **Receive stock** for more than is still to come on a line | Refused: "only … still to receive" | |
| S-R3 | **Move stock**: Wood shavings × 50 from Main store (it holds none) | Refused: not enough stock | |
| S-R4 | **Pay supplier** for more than is owed on an invoice | Refused, or the extra is shown as an advance to the supplier under **Money → Payables**. Note which | |
| S-R5 | **Pay supplier** on `INV-AC-2004` (not approved) | Refused. ⚠ The message is a general "failed to create supplier payment" one (README, known item 10) | |
| S-R6 | Approve `INV-AC-2004` (over-billed) with no reason | Refused, asking for a reason or for the rest of the goods | |
| S-R7 ⚠ | As **Nimal Perera** (Main Farm), raise a request **for Expansion 1** | Should be refused. **It is currently accepted** (README, known item 4) | |
| S-R8 | As **Kamal Silva** (supervisor), look for a way to create a purchase order | No such button: he can request and receive, not order | |

---

## Questions for the tester

1. Is "request → approve → order" how it really happens, or does the order usually come first, by phone?
2. Is the person receiving the delivery the person who would have a phone in hand at the gate?
3. Do you always know the expiry date when the delivery arrives?
4. Are the four stores right? Is stock kept anywhere that is not in the list?
5. Is the Rs 100 or 1% tolerance between invoice and delivery sensible for your suppliers?
6. Do you pay suppliers invoice by invoice, or in lump sums on account?
7. What do you buy that is not stock (repairs, gas, transport)? Was it clear where that goes?
8. Which words or tab names did not make sense?

## Passed when

You have taken one order from request to payment without help, and the quantities in each store on screen are what you expect.
