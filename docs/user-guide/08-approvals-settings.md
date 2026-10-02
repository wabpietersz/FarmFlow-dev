# 08 Approvals and settings

For the owner and the system admin.

Both are in the menu under your initials.

---

## Approvals

### Limits

**Settings → Approvals** has two limits:

- **Purchase orders** at or above Rs …
- **Money going out** at or above Rs …

Leave one empty to turn it off. On a new installation both are off, so set them.

### What happens over a limit

1. Someone who can't approve raises a purchase order or a payment over the limit.
2. It **waits**. A waiting payment is not in any balance or report.
3. People who can approve get a notification.
4. A manager **approves** it, or **rejects** it with a reason. The person who raised it is told.
5. A rejected purchase order goes back to draft.

Nobody can approve their own request.

### The Approvals page

**Your initials → Approvals** shows everything waiting for a decision in one list:

- over-limit purchase orders and payments
- petty cash expenses to review
- expenses and service work
- supplier invoices (over-billed ones need a reason)
- supplier contracts
- stock requests
- payroll to review or approve
- draft sales to review

Check it daily. Home shows the count.

---

## Settings

| Section | What it does |
|---|---|
| **Access & roles** | What each role can see and do in each area |
| **Users** | Who can sign in, their role and their farm |
| **Lists & options** | The choices in dropdowns: job titles, mortality causes, leave types and so on |
| **Stock item types** | Kinds of stock, and the money category each is bought under |
| **Stores** | Where stock is kept. Each farm gets one automatically |
| **Money setup** | Categories and cost centres |
| **Approvals** | The limits above |
| **Payroll** | EPF and ETF rates |
| **Health & growth** | Vaccination programmes and target growth curves |
| **Alerts** | When FarmFlow warns you about a batch |

### Access & roles

The roles are: system admin, farm manager, accountant, supervisor, feed mill operator, farm worker, viewer.

For each role and each area choose:

| Level | Means |
|---|---|
| **None** | The area is hidden |
| **User** | Day-to-day entry |
| **Admin** | Everything, including approving, deleting and setup |

The system admin always has full access.

Give each role the least it needs. In particular, decide who may see **Money** and **Payroll**.

### Users

**Settings → Users → Register User.** Enter first and last name, email, role, and optionally a **farm**.

- They get an email with a link to set a password. If email isn't set up, the app gives you a link to copy and send.
- A user tied to a farm sees and changes only that farm's batches, sales, staff and reports. Leave the farm empty for people who work across farms.
- When someone leaves, **deactivate** them the same day. Their past entries stay.

### Money setup

- **Categories:** the built-in ones can't be removed. Add your own under the right type: income, expense, or financing (capital, loans, advances).
- **Cost centres:** one per farm (made when the farm is added), plus Feed Mill and Admin.

### Health & growth

Replace the example vaccination programme with your vet's, and the example growth curve with your breed guide. New batches get the programme automatically.

---

## Period locks

**Farms → Farm control → Period locks → Create Period Lock.**

Locking a month stops anyone changing anything dated in it. Do it after month-end is checked.

## Month-end checklist

1. **Farms:** all daily logs entered; finished batches closed.
2. **Stock:** invoices approved; over-billing resolved; expired stock written off.
3. **Sales:** all receipts recorded; cheques cleared or bounced; read **Owed to you**.
4. **People:** payroll generated, approved and paid; EPF/ETF paid.
5. **Money:** no "Uncategorized" lines; balances agree with the bank; read **Profit & loss** and **Cash flow**.
6. **Approvals:** nothing left waiting.
7. Lock the month.

## The audit trail

FarmFlow records who created, changed, approved or reversed everything, and when. Home's recent activity shows the latest. This is why sign-ins must never be shared.

## Common questions

**A user can't see an area they should.**
Check their role under Users, then that role's level for the area under Access & roles.

**A user sees the wrong farm, or all farms.**
Check the farm on their user record.

**Nothing ever waits for approval.**
The limits are empty, or the people raising the items are themselves approvers.

**The set-password email didn't arrive.**
Check spam. Only the newest link works. If email isn't configured, use the copy-link option.
