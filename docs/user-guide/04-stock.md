# 04 Stock

For the store keeper and accounts. Farm managers and the mill operator use **Requests**.

**Stock** in the top bar has these tabs:

| Tab | Use it for |
|---|---|
| **Inventory** | Every item you keep, with quantity and reorder level |
| **Stores** | What is in each store; moving stock; expiring stock; write-offs |
| **Requests** | A farm or the mill asks for stock |
| **Purchase orders** | Ordering from suppliers and receiving deliveries |
| **Contracts** | Standing agreements with suppliers |
| **Invoices** | Supplier bills, checked against what arrived, and paying them |
| **Traceability** | Where a delivery came from and where it went |
| **Suppliers** | Who you buy from, and their terms |

---

## The buying route

```
Request  →  Purchase order  →  Receive  →  Invoice  →  Pay
(farm/mill)   (office)        (store)     (accounts)  (accounts)
```

### 1. Request

**Stock → Requests → Request stock.** Choose who it's for (farm, mill or admin), the items and quantities. The office approves or rejects it.

### 2. Purchase order

From an approved request choose **Create purchase order**, or start one directly under **Purchase orders**.

1. Choose the supplier.
2. Check items, quantities and prices.
3. Save as draft, then **Submit**.

If the order is over the approval limit and you can't approve it yourself, it waits for a manager. You'll get a notification with the answer. A rejected order comes back as a draft with the reason.

### 3. Receive

When the delivery arrives: open the PO → **Receive**.

1. **Receive into:** choose the store. FarmFlow suggests one: feed materials → Feed Mill store; an order for a farm → that farm's store; otherwise Main store.
2. Enter the quantity that actually arrived for each line. It can be less than ordered; the PO stays "partially received" until the rest comes.
3. Enter the **expiry date** for medicines, vaccines and anything else that expires.
4. Save.

If any line has a problem, nothing from that delivery is saved. Fix the line and save again.

Each delivery becomes a **lot** with its own cost and expiry.

### 4. Invoice

When the supplier's bill arrives: **Invoices → Record Supplier Invoice**, linked to the PO.

FarmFlow compares the bill with what was received:

| Match shows | Meaning |
|---|---|
| **Matches goods** | The bill agrees with what arrived (within Rs 100 or 1%) |
| **Over-billed · Rs …** | The bill is for more than has arrived |

An over-billed invoice can only be approved with a written reason. If the rest of the order arrives later, the match updates by itself.

Invoices are approved under **Farms → Farm control**.

### 5. Pay

On an approved invoice: **Record Supplier Payment**. Choose the account (and cheque, if paying by cheque), the amount and date.

The payment goes into the money ledger, split by what was bought (for example part Feed Raw Materials, part Medicine & Vaccines) and tagged to the farm, mill or admin the order was for. Payments over the approval limit wait for a manager.

**Money → Payables** shows what is still owed to each supplier.

---

## Stores

**Stock → Stores** shows the Main store, the Feed Mill store and one store for each farm.

- **Move stock:** choose the item, from which store, to which store, and how much. Cost and expiry travel with the stock.
- **Expiring soon / expired:** listed here and on Home.
- **Write off:** for anything spoiled, broken or expired. Give a reason.

## How stock is used

- **Soonest expiry first.** If there are no expiry dates, oldest delivery first.
- **Expired stock is never used automatically.** Write it off.
- A farm's own store is used before the Main store.
- The cost charged is the cost of the delivery it came from.

Stock is used when a vaccination is marked Done, when the mill completes a production run, or when you use **Consume Inventory to Batch** to issue items to a batch.

## Items

**Stock → Inventory → add item:** name, type, unit, supplier and reorder level.

Item types (feed, health and so on) are set under **Settings → Stock item types**. The type decides which money category a purchase is recorded under.

## Suppliers and contracts

**Suppliers:** name, contact, payment terms, and the usual money category for what they sell.
**Contracts:** an agreed price or period with a supplier.

## Traceability

**Stock → Traceability** → choose a lot. You see the supplier, PO, price and date it came in, and every production run, batch or write-off it went to. Use this if a supplier recalls a product or a batch has a problem.

## Common questions

**The vaccine is in stock but the health task says there's none.**
It may be in another farm's store, or expired. Check **Stores**.

**Quantity on the Inventory tab doesn't match the shelf.**
Check each store, then deliveries received into the wrong store. Correct real differences with an adjustment and a reason.

**The supplier billed for a partial delivery in full.**
Record the invoice as billed. It shows over-billed until the rest arrives. Don't approve it without a reason.

**We buy something that isn't stock (a repair, a contractor).**
Use **Farms → Farm control → service work**.
