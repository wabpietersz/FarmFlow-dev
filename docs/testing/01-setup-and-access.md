# Test plan 01: Setup, access and approvals

**For:** the owner (system admin).
**Time:** about 60 minutes.
**Sign in as:** a system admin. Tests A-10 to A-18 also need the made-up staff sign-ins (see [README](README.md#3-sign-ins)); use a private browser window for them so you stay signed in as yourself.
**Have open:** [Test-Data-Sheet.md](Test-Data-Sheet.md), sections 1 and 7.
**User guide:** [Getting started](../user-guide/01-getting-started.md), [Approvals and settings](../user-guide/08-approvals-settings.md).

---

## Part 1: Finding your way around

### A-01 Sign in and look at the menus

1. Open the app and sign in.
2. Look at the bar across the top.
3. Click your initials at the top right.

**Expect**
- [ ] The top bar shows **Home · Farms · Feed mill · Stock · Sales · Money · People · Reports**.
- [ ] **Farms** opens to: Sites & houses, Batches, Health & care, Farm control.
- [ ] **People** opens to: Employees, Attendance, Payroll.
- [ ] Your initials menu has **Approvals**, **Users & access**, **Settings**, the light/dark switch and sign out.

### A-02 Home

1. Open **Home**.

**Expect**
- [ ] **Cash on hand** equals the "Cash on hand" figure in the data sheet, section 7.
- [ ] Two batches are shown growing: `MF-H2-002` and `EX-HA-001`.
- [ ] The **To do** list includes: something waiting for your approval, an overdue health task on `MF-H2-002`, a missing daily check, a supplier invoice due, stock expiring, a booked catch in the next 3 days, buyers who are late paying.

### A-03 Dark theme and phone

1. Switch to the dark theme from your initials menu. Open Home, Farms → Batches, Money.
2. Open the app on your phone (or make the browser window phone-width).

**Expect**
- [ ] Everything is readable in the dark theme; status colours can still be told apart.
- [ ] On a phone the bar is at the bottom with **Home · Farms · Sales · Money · More**.
- [ ] Tables can be scrolled; nothing is cut off.

### A-04 Install on a phone

1. On Android (Chrome) use the Install prompt or *Add to Home screen*. On iPhone (Safari) use Share → *Add to Home Screen*.
2. Open it from the home screen.

**Expect**
- [ ] It opens full screen, like an app.

---

## Part 2: Settings

### A-05 Stores, item types, money setup

1. **Settings → Stores.**
2. **Settings → Stock item types.**
3. **Settings → Money setup.**
4. **Settings → Payroll.**

**Expect**
- [ ] Stores: Main store, Feed mill store, Main Farm store, Expansion 1 store.
- [ ] Six item types: Feed, Vaccine, Medicine, Litter & bedding, Consumable, Equipment. Each shows the money category it is bought under (for example Vaccine → Medicine & Vaccines).
- [ ] Cost centres: Main Farm, Expansion 1, Feed Mill, Admin / Head Office.
- [ ] Payroll rates: EPF 8 and 12, ETF 3.

### A-06 Change a list

1. **Settings → Lists & options.** Find the mortality causes.
2. Add **Heat stress**. Save.
3. Go to **Farms → Batches**, open `MF-H2-002`, open **Today's check**, and look at the cause list. Leave without saving.

**Expect**
- [ ] **Heat stress** is in the list of causes.

### A-07 Health programme and growth curve

1. **Settings → Health & growth** (or **Farms → Health & care → Programmes**).
2. Open **Broiler programme (test data)**.

**Expect**
- [ ] Five tasks, on days 1, 7, 14, 21 and 24.
- [ ] Each task names the stock item it uses (Vitamins & electrolytes, Newcastle vaccine or Gumboro vaccine) and a dose per 1,000 birds.
- [ ] A growth curve is listed with target weights by day.

### A-08 Alerts

1. **Settings → Alerts.** Read the thresholds. Change the mortality threshold, save, then change it back.

**Expect**
- [ ] The change is saved and shown when you come back to the page.

---

## Part 3: Users and access

### A-09 Register a real tester

1. **Settings → Users → Register User.**
2. Enter the tester's first name, last name and real email. Choose their role, and a farm if they work on only one.
3. Save.
4. Ask them to open the link they receive and choose a password.

**Expect**
- [ ] They get an email with a link (or the app shows a link you can copy and send).
- [ ] After choosing a password they land on Home and see only the areas their role allows.

### A-10 What each role sees

Sign in as each made-up person in a private window and compare the top bar with this table. (Sign-ins: data sheet, section 1.)

| Sign in as | Role | Top bar should show | And only |
|---|---|---|---|
| Nimal Perera | Farm manager, Main Farm | Home, Farms (all four pages), Feed mill, Stock, Sales, Money, People (Employees, Attendance), Reports | Main Farm's batches: `MF-H1-001`, `MF-H2-002` |
| Dilani Jayawardena | Farm manager, Expansion 1 | The same | Expansion 1's batch: `EX-HA-001` |
| Kamal Silva | Supervisor, Expansion 1 | Home, Farms, Feed mill, Stock, People (Employees, Attendance), Reports | Expansion 1's batch |
| Ruwan Fernando | Accountant | Home, Farms (Farm control only), Feed mill, Stock, Sales, Money, People (Employees, Attendance, Payroll), Reports | — |
| Saman Wijesinghe | Feed mill operator | Home, Farms (Farm control only), Feed mill, Stock, Reports | — |
| Sunil Bandara | Farm worker, Main Farm | Home, Farms (Sites & houses, Batches, Health & care) | Main Farm's batches |
| Vinod Rathnayake | Viewer | Home, Reports | — |

**Expect**
- [ ] Each person's top bar matches the table.
- [ ] Nobody but the accountant and you sees **Payroll**.
- [ ] Farm-tied people see only their own farm's batches.
- [ ] Note anything in the table that is **not what you would want** for that job. That is feedback, not a fault.

### A-11 Change what a role can see

1. As yourself: **Settings → Access & roles.**
2. Find the **Viewer** row. Set **Farms & batches** to **User**. Save.
3. In the private window, sign in as Vinod Rathnayake (or refresh if already signed in; it can take up to a minute).
4. Set it back to **None**.

**Expect**
- [ ] After the change, Vinod's top bar shows **Farms**, and batches can be opened but not created.
- [ ] After changing it back, Farms is gone again.
- [ ] The System admin row cannot be changed.

### A-12 One farm cannot see another

1. Sign in as **Nimal Perera** (Main Farm).
2. Open **Farms → Batches**.
3. In the address bar, replace the end of the address with `/batches/` followed by the number of the Expansion 1 batch. (As admin, open `EX-HA-001` and read the number at the end of its address.)

**Expect**
- [ ] `EX-HA-001` is not in Nimal's list.
- [ ] Opening it by address is refused ("This belongs to another farm" or a not-authorised page).

### A-13 Deactivate a user

1. As yourself: **Settings → Users.** Deactivate **Vinod Rathnayake**.
2. In the private window, try to sign in as Vinod.
3. Reactivate him.

**Expect**
- [ ] Sign-in is refused while he is deactivated ("Account is deactivated").
- [ ] It works again after reactivating.

### A-14 Forgotten password

1. Sign out. On the sign-in page choose **Forgot password?** and enter your own email.

**Expect**
- [ ] A reset email arrives (check spam). The link lets you choose a new password.
- [ ] If you ask twice, only the newest link works.

---

## Part 4: Approvals

The limits in the test data: purchase orders at or above **Rs 1,000,000**; money going out at or above **Rs 250,000**.

### A-15 The limits

1. **Settings → Approvals.**

**Expect**
- [ ] Purchase orders: 1,000,000. Money going out: 250,000.

### A-16 The Approvals page

1. Your initials → **Approvals**.

**Expect** (data sheet, section 7, "Waiting for someone")
- [ ] Over the approval limit: one purchase order for **Rs 1,250,000**, raised by Nimal Perera (corn from Agri Feeds).
- [ ] Petty cash spending to review: **Rs 2,400**.
- [ ] One operational expense: **Rs 18,000**.
- [ ] One supplier invoice: **Rs 2,060,000** (`INV-AF-1003`).
- [ ] One service work order: **Rs 28,000**.
- [ ] One stock request.
- [ ] One draft sale: **Rs 390,525**.
- [ ] Home's "waiting for approval" count agrees.

Leave everything except the purchase order alone; the other plans use those items.

### A-17 Nobody approves their own request

1. In a private window sign in as **Nimal Perera**.
2. Open **Stock → Purchase orders**. Find his order for corn (Rs 1,250,000). It shows as waiting for approval.
3. Look for any way to approve it, including **Approvals** in his initials menu.

**Expect**
- [ ] The order shows as **pending approval**.
- [ ] Nimal cannot approve it.

### A-18 Reject, then approve

1. As yourself: **Approvals** → the purchase order → **Reject**. Reason: `Wait for next month's price`.
2. As Nimal: open **Stock → Purchase orders**. Look at the bell.
3. As Nimal: **Submit** the same order again.
4. As yourself: **Approvals** → **Approve**.

**Expect**
- [ ] After rejecting: the order goes back to **draft**; Nimal is told, with your reason.
- [ ] After he submits again: it waits again and appears on your Approvals page.
- [ ] After approving: the order is **submitted** (ready to be received) and no longer on the Approvals page.

---

## Should be refused

| ID | Try | Expect | ✓ |
|---|---|---|---|
| A-R1 | As Nimal (farm manager), type `/settings` at the end of the address | Not authorised | |
| A-R2 | As Sunil (farm worker), type `/treasury` at the end of the address | Not authorised | |
| A-R3 | As Vinod (viewer), type `/payroll` at the end of the address | Not authorised | |
| A-R4 | In **Access & roles**, try to reduce the System admin row | Not possible | |
| A-R5 ⚠ | As Nimal, pay a supplier invoice of more than Rs 250,000 (**Stock → Invoices → Pay supplier** on `INV-AF-1002`, Rs 300,000) | By the user guide it should wait for approval. **It currently goes straight through** (README, known item 9). If it does, note it and tell accounts so the payables figures can be explained | |

---

## Questions for the owner

1. Do the seven roles match real jobs? Is one missing (for example an owner who is not the technical admin)?
2. Looking at the A-10 table: who sees something they shouldn't, or can't see something they need?
3. Should an accountant be allowed to approve their own over-limit payment? (Today they can: accountants are approvers.)
4. Are two limits (purchase orders, money out) enough? Should supplier payments, payroll or advances wait too?
5. Is the Approvals page the one place you would check each morning?
6. What would you want on Home that is not there?

## Passed when

Every role's access has been looked at and agreed (or the changes written down), and you have rejected and approved a request.
