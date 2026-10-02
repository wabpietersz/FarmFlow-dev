# 05 Sales

For whoever arranges sales, whoever weighs the lorries, and accounts.

**Sales** in the top bar has four tabs:

| Tab | Use it for |
|---|---|
| **Sales** | Every sale, new sales, other income |
| **Bookings** | Catches agreed with buyers, before the day |
| **Owed to you** | Who owes what, and how late |
| **Buyers** | Buyer details, credit terms and limits |

---

## The selling route

```
Booking  →  Sale (lorries weighed)  →  Reviewed  →  Receipt(s)  →  Paid
```

### 1. Booking

**Bookings → Book a catch.**

Enter the buyer, the batch, the catch date, the number of birds, the expected weight per bird and the price per kg. FarmFlow shows the expected value.

You can't book more birds than the batch has left (live birds minus birds already sold or booked).

Catches in the next three days show on Home.

### 2. The sale

On the day, open the booking → **Make the sale**. The form is filled in from the booking. (Or start a sale directly under **Sales → New sale**.)

For each lorry enter:

| Field | Notes |
|---|---|
| Birds | Number loaded |
| Empty weight | Lorry weighed empty, kg |
| Loaded weight | Lorry weighed full, kg |

Net weight = loaded − empty. Sale value = net weight × price per kg, less any deductions. Add as many lorries as needed.

Saving the sale takes the birds off the batch and marks the booking **Sold**. The sale gets a due date: the sale date plus the buyer's credit terms.

### 3. Review

Open the sale → **Mark Reviewed**. This is the check that weights and price are right. Receipts can only be taken on a reviewed sale.

### 4. Receipts

Open the sale → **Add Receipt**.

- Choose how it was paid: **cash**, **bank** or **cheque**, and which account it went into.
- One receipt can be split, for example part cash and part cheque.
- A part payment is fine. The sale shows what is still outstanding.

The receipt and its line in the money ledger are saved together, tagged **Bird Sales** and to the batch.

When a sale is paid in full it's marked complete.

**Paid too much?** The extra is kept as credit for that buyer and can be used against their next sale.

### Cheques

A cheque isn't money until it clears. **Money → Cheques:**

1. **Received** when you take it.
2. **Deposited** when you bank it.
3. **Cleared** when the bank confirms, or **Bounced**.

A bounced cheque reverses the money, and the sale is outstanding again. The bell reminds you of cheques waiting to be deposited.

### The invoice

On the sale, download the **invoice** (PDF) to give the buyer.

---

## Credit limits

Each buyer has a credit limit. A sale that would take them over it is blocked. A sales admin can let it through by entering a reason, which is kept on the sale.

## Other income

Litter, manure, feed bags, scrap: **Sales → Other income**.

Choose what it is, the quantity and unit price, the buyer and the farm (and a batch, if it belongs to one). Review it and take receipts in the same way. It's recorded as **Other Farm Income**, not Bird Sales.

## Owed to you

**Sales → Owed to you** lists every buyer who owes money, split by how late it is:

| Not yet due | 1–30 days | 31–60 | 61–90 | 90+ |
|---|---|---|---|---|

Buyers over their limit are flagged. **Statement** gives a PDF for any period with every sale, every receipt and a running balance. Late payers also appear on Home and in the bell.

## Buyers

**Sales → Buyers:** name, contact, credit terms (days) and credit limit. Open a buyer for their sales history and balance.

## Cancelling

A sale with no receipts can be cancelled. The birds go back to the batch and the booking reopens. A sale with cleared receipts can't be cancelled; ask accounts.

## Common questions

**Add Receipt isn't available.**
The sale hasn't been marked Reviewed.

**The booking was refused.**
The batch doesn't have that many birds left unsold and unbooked. Check other bookings on the same batch.

**The buyer paid one amount for several sales.**
Record a receipt against each sale. Anything left over is kept as buyer credit.

**The sale shows in the batch's profit, but not in this month's Profit & loss.**
Profit & loss counts money when it's received. The batch's profit page counts the full sale value straight away.
