# FarmFlow user guide

FarmFlow runs a two-farm broiler business with its own feed mill: batches, feed, stock, sales, money, staff and payroll. Every rupee is tagged with **what it was for** (category), **where it belongs** (farm, mill or admin) and **the document behind it**. This lets the system show true batch costs and a proper profit & loss.

---

## 1. Getting in

- Sign in with your email and password. Use **Forgot password?** on the sign-in page if you need to reset it.
- New users get an email with a link to set their password. If email isn't set up, the admin sees a link to copy and send by WhatsApp.
- The **bell** in the top bar shows what needs your attention. Your initials open the menu, which has **Approvals**, **Settings**, **Users & access** and the light/dark theme.
- On a phone, the bottom bar has Home, Farms, Sales and Money; everything else is under **More**.

## 2. Home

- **Cash on hand**, money in and out this month, and the number of live birds.
- For the owner and accounts: this month's **profit**, **money owed to you**, **money you owe suppliers**, and **items waiting for approval**. Tap any tile to see the detail.
- **Batches growing**: each card shows live birds, mortality, average weight and cost per kg.
- **To do**: vaccinations due, missing daily logs, expiring stock, invoices due, catches booked for the next 3 days, late payers, and approvals waiting.

## 3. Farms

**Starting a batch:** Farms → Batches → New batch (farm, house, chicks, placement date). The vaccination programme is added automatically.

**Every day:** open the batch and go to **Today's check**. Record deaths (with a cause), feed, water, weight and temperature. It works offline and syncs when you're back online. The check also shows actual weight against the target curve.

**Health:** Farms → Health & houses.
- **Tasks**: mark a vaccination **Done**. This records it and takes the vaccine from the farm's own store first. Or **Skip** it, with a reason.
- **Vet visits**, **programmes** (day-by-day health plans), **growth curves**, and **house turnaround** (the cleaning checklist between batches).

**Batch costs:** each batch shows chicks, feed at real mill cost, medicine, labour, and a share of farm and admin overheads (split by bird-days). It also shows profit and FCR. **Close** a batch when it's done; its numbers are then frozen.

## 4. Feed mill

Feed recipes, production runs (which use raw materials, oldest stock first, at their actual cost), distribution to batches, quality checks and waste. Mill wages and overheads are added into the feed's cost per kg.

## 5. Stock

- **Inventory**: all items. **Stores** shows where stock sits: Main, Feed Mill, and one store per farm. Use **Move stock** between stores, and **write off** anything spoiled or expired.
- **Requests**: a farm or the mill asks for stock. The office approves it and turns it into a **purchase order**.
- **Purchase orders → Receive**: pick the store and enter expiry dates. If any line is wrong, nothing from that delivery is booked.
- **Invoices**: each invoice is checked against the goods received. **Over-billed** invoices need a written reason before they can be approved.
- Stock is always used **soonest-expiry first**, and expired stock is never used automatically.

## 6. Sales

- **Bookings**: agree the buyer, batch, catch date, number of birds and price per kg before catching. The app refuses bookings for more birds than are left. On the day, use **Make the sale**.
- **New sale**: add the lorries with empty and loaded weights. Mark it **Reviewed** before taking payment.
- **Other income**: litter, manure, feed bags, scrap. These are invoiced and collected like bird sales, and recorded as *Other Farm Income*.
- **Receipts**: cash, bank or cheque, and one receipt can be split. A receipt and its money line always save together. Cheques go through deposited → cleared or bounced; a bounced cheque reverses the money.
- **Credit limits**: a sale that takes a buyer over their limit is blocked unless a sales admin gives a reason.
- **Owed to you**: who owes what and how late it is (not yet due / 1–30 / 31–60 / 61–90 / 90+ days). **Statement** gives a PDF for any period.

## 7. Money

- **Overview, Ledger, Accounts, Cheques, Transactions, Petty cash**: every money movement, with its category and cost centre. Fix any "Uncategorized" lines in **Ledger**.
- **Profit & loss**: income and costs by category and month, for the whole business, one farm, the mill or admin, or all of them side by side. Buyer credit used on a later sale counts as sales on the day it's used. There's a CSV download.
- **Cash flow**: opening balance, then cash from trading, then owner money, loans and advances, then closing balance, by month. You can pick one account. CSV download.
- **Payables**: what you owe each supplier and how late it is, plus supplier statements.
- **Owner & loans**:
  - **Put money in** and **Take money out** record your own money (capital and drawings). These are never counted as profit or cost.
  - **Loan received** records a business loan. Each **repayment** is split into principal and interest; only the interest is a cost.

## 8. People

- **Employees**: details, bank details, EPF number and whether they're an EPF member, and pay setup. Tick **Counts for EPF/ETF** on allowances that are part of EPF earnings.
- **Attendance**: daily or bulk entry, shifts and leave balances.
- **Payroll**:
  - **Pay runs**: Generate for the month. The preview shows EPF and any advance being taken back. Then Review and Approve each one.
  - **Month & payslips**: the register for the month. Here you can **Pay all approved** at once, download the **bank transfer list** (CSV) and **payslips** (PDF), and export the register (CSV).
  - **Advances & loans**: pay out an advance or a loan. It's taken back from pay automatically, but never more than the pay left after EPF. Staff can also pay back directly in cash or by bank.
  - **EPF / ETF**: the month's return. Once payroll is paid, use **Pay EPF/ETF**. The employer's share is charged to each employee's farm, mill or admin.
- Only take-home pay leaves the bank. The ledger shows the full wage as a cost, with the EPF kept back and any advance recovered shown separately.

## 9. Approvals and notifications

- **Settings → Approvals** sets limits for purchase orders and for money going out.
  - Anything over a limit, raised by someone who can't approve, **waits**. While waiting it isn't counted in balances or reports.
  - A manager approves it, or rejects it with a reason. Nobody can approve their own request.
- **Approvals** (from your menu) lists those requests, plus everything else waiting: petty cash, expenses, invoices, work orders, stock requests, payroll and draft sales.
- The **bell** is checked every 30 minutes, and each thing appears only once.

## 10. Settings and access

- **Access & roles**: for each role and each area, choose **None**, **User** or **Admin**. The system admin always has full access.
- **Users**: add people, set their role, and optionally a **farm**. A user tied to a farm only sees and changes that farm's batches, sales, staff and reports.
- **Lists & options**, **Stock item types**, **Stores**, **Money setup** (categories and cost centres), **Payroll** (EPF/ETF rates), **Health & growth**, **Alerts**.

## 11. Month-end checklist

1. **Farms**: all daily logs are in, and finished batches are **closed**.
2. **Stock**: invoices are approved and over-billing is resolved; expired stock is written off.
3. **Sales**: all receipts are recorded; cheques are cleared or bounced; check **Owed to you**.
4. **People**: payroll is generated, approved and **paid**. Then **Pay EPF/ETF**.
5. **Money**: no "Uncategorized" lines; read **Profit & loss** and **Cash flow** for the month.
6. Optionally, lock the month (**Farm control → Period locks**) so nobody can change it later.
