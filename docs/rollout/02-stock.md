# Session 1a: Stock and buying

**With:** whoever orders and receives stock, and accounts (for invoices and payment).
**Time:** 90 minutes.
**Guide:** [../user-guide/04-stock.md](../user-guide/04-stock.md)
**Before:** stores exist (Main, Feed Mill, one per farm); at least two suppliers; item types for feed and health; a money account with a balance.

## Ask first: how it's done today

- Who notices that something is running low, and how do they tell the office?
- Who chooses the supplier and price? Is anything written down before the order?
- When a delivery arrives, who counts it and where is that recorded?
- How is the supplier's bill checked against what arrived?
- Where is stock physically kept, and how does it get from the main store to a farm?
- How are expiry dates tracked?

## Scripted steps

The route: **request → order → receive → move → invoice → pay**.

| ID | Step | Expected | ✓ |
|---|---|---|---|
| S-1 | **Stock → Inventory.** Add an item (a vaccine: health type, unit "dose", supplier, reorder level). | Listed with quantity 0 | |
| S-2 | **Stock → Requests → Request stock** for a farm: two items. | Request shows as waiting | |
| S-3 | Approve the request, then **Create purchase order**. Enter supplier and prices. | Draft PO with the right total; the request shows "Ordered on PO-…" | |
| S-4 | Submit the PO. (If it's over the approval limit and you can't approve, it waits.) | Status moves to submitted | |
| S-5 | **Receive**: choose the store, receive one line in full with an expiry date, the other line in part. | PO is "partially received"; **Stores** shows the quantities in that store; the dated item shows under expiring soon if the date is near | |
| S-6 | **Stores → Move stock** from Main store to a farm store. | Both stores change; the item total doesn't | |
| S-7 | Write off a few units with a reason. | Total drops; reason kept | |
| S-8 | **Invoices → Record Supplier Invoice** for the full PO amount (more than was received). | Match shows **Over-billed** with the difference | |
| S-9 | Try to approve the over-billed invoice (**Farms → Farm control**). | Asks for a written reason. Cancel. | |
| S-10 | Receive the rest of the PO. | Invoice match changes to **Matches goods**; approving no longer asks for a reason | |
| S-11 | Approve, then **Record Supplier Payment** from a bank account. | **Money → Ledger** shows the payment split by what was bought (for example Medicine & Vaccines, Feed Raw Materials) | |
| S-12 | **Money → Payables.** | The supplier shows nothing owed; the statement lists invoice and payment | |
| S-13 | **Stock → Traceability**: open a lot. | Shows where it came from (PO, supplier, cost) and where it went | |
| S-14 | Let an item fall below its reorder level. | Low-stock alert on Home / the bell within 30 minutes | |

## Should be refused

| ID | Try | Expected |
|---|---|---|
| S-R1 | Receive a delivery where one line has a bad value (for example a negative quantity) | Nothing from that delivery is booked |
| S-R2 | Move more stock than the store holds | Refused |
| S-R3 | Use stock from a lot that has expired (for example mark a vaccination done when only expired vaccine is left) | Expired stock isn't used; the task reports no stock |
| S-R4 | Pay an invoice that isn't approved | Refused |
| S-R5 | A Farm A user requests stock for Farm B | Refused |

## Feedback to draw out

- Is "request → approve → order" how it really happens, or does the order usually come first by phone?
- Is the person receiving the delivery the same person who would have a phone in hand at the gate?
- Do you always know the expiry date at receiving time?
- Are the stores right? Is there a place stock is kept that isn't in the list?
- Is the Rs 100 or 1% invoice tolerance sensible for your suppliers?
- Do you pay suppliers per invoice, or in lump sums on account?
- What do you buy that isn't "stock" (services, repairs, gas)? Was it clear where that goes? (Farm control → service work.)
- Which tab names didn't make sense?

## Passed when

One complete request-to-payment cycle has been done by the user alone, and the stock in each store on screen matches what they expect.
