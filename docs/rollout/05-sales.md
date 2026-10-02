# Session 3: Sales

**With:** whoever agrees prices with buyers, whoever weighs the lorries, and accounts.
**Time:** 90 minutes.
**Guide:** [../user-guide/05-sales.md](../user-guide/05-sales.md)
**Before:** a growing batch with live birds (Session 2); buyers with credit terms and limits; money accounts.

## Ask first: how it's done today

- How is a catch arranged with a buyer, and how far ahead?
- How is the price fixed: per kg live weight, on the day or in advance?
- How are lorries weighed (empty and loaded)? Who writes the weights down?
- Are there deductions (dead on arrival, crates, transport)?
- How do buyers pay: cash on the day, cheque, bank transfer later, part now and part later?
- How do you know today who owes you and how late they are?
- What happens when a cheque bounces?

## Scripted steps

The route: **booking → sale → receipt → owed to you**.

| ID | Step | Expected | ✓ |
|---|---|---|---|
| L-1 | **Sales → Buyers**: open a buyer, check terms and credit limit. | Shown; sales history below | |
| L-2 | **Bookings → Book a catch**: buyer, batch, catch date tomorrow, birds, expected weight, price per kg. | Expected value shown; Home lists the catch in the next 3 days | |
| L-3 | **Make the sale** from the booking. Add a lorry: birds, empty weight, loaded weight. | Sale amount = (loaded − empty) × price; booking shows **Sold**; batch live birds drop | |
| L-4 | Add a second lorry to the same sale. | Totals add up across lorries | |
| L-5 | Open the sale → **Mark Reviewed**. | Status reviewed; receipts now allowed | |
| L-6 | **Add Receipt**: part payment by bank transfer. | **Money → Ledger** shows it as Bird Sales tagged to the batch; the sale shows the balance outstanding | |
| L-7 | **Add Receipt** split across cash and a cheque. | Cash posts now; cheque is "received" | |
| L-8 | **Money → Cheques**: mark the cheque deposited, then **cleared**. | Balance of the bank account goes up on clearing | |
| L-9 | Take another cheque and mark it **bounced**. | The money is reversed; the sale is outstanding again | |
| L-10 | Download the **invoice** PDF. | Buyer, lorries, weights, price, total, receipts | |
| L-11 | Overpay a sale slightly. | The extra is held as buyer credit and can be used on the next sale | |
| L-12 | **Other income**: sell litter (bags × price) to a buyer for a farm. Review, take cash. | Ledger shows **Other Farm Income**, not Bird Sales | |
| L-13 | **Owed to you**. | Each buyer with amounts by lateness (not due / 1–30 / 31–60 / 61–90 / 90+) | |
| L-14 | **Statement → Download PDF** for a buyer and period. | Sales, receipts and running balance | |
| L-15 | Cancel a sale that has no receipts. | Gone from Owed to you; its booking reopens; birds return to the batch | |

## Should be refused

| ID | Try | Expected |
|---|---|---|
| L-R1 | Book more birds than the batch has left unsold and unbooked | Refused with the number available |
| L-R2 | A sale that takes a buyer over their credit limit, as a non-admin | Blocked; as sales admin it needs a reason, which is kept on the sale |
| L-R3 | Add a receipt to a sale that isn't reviewed | Refused |
| L-R4 | Cancel a sale that has cleared receipts | Refused |
| L-R5 | Loaded weight less than empty weight | Refused |

## Feedback to draw out

- Do you really book before catching, or is it agreed on the phone the night before and that's all?
- Is the price always per kg? Ever per bird?
- Is there one weighing per lorry, or are crates weighed in batches? Would you enter weights at the weighbridge on a phone?
- Which deductions happen in practice, and was there a place for them?
- Does "Mark Reviewed" match a real check someone does, or is it an extra step?
- Are credit limits something you'd enforce, or a warning you'd override every time?
- Does the statement look like something you'd send a buyer?
- One sale from two batches or two farms on one lorry: does that happen?

## Passed when

One booking has been taken through to a fully paid sale and one to a bounced cheque, and the Owed to you figures match a hand calculation.
