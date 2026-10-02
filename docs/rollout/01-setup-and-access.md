# Session 0: Setup, access, approvals and alerts

**With:** the owner (as system admin).
**Time:** 60 minutes.
**Guide:** [../user-guide/08-approvals-settings.md](../user-guide/08-approvals-settings.md), [../user-guide/01-getting-started.md](../user-guide/01-getting-started.md)
**Before:** the instance is deployed and the first admin can sign in.

## Ask first: how it's done today

- Who is allowed to spend money without asking, and up to how much?
- Who sees the bank balance? Who sees salaries?
- Which decisions always come to the owner?
- Who should see only their own farm?

Write the answers down. They become the access matrix and the approval limits.

## Scripted steps

| ID | Step | Expected | ✓ |
|---|---|---|---|
| A-1 | Sign in. Open your initials menu. | Approvals, Settings, Users & access and the theme switch are there | |
| A-2 | **Settings → Access & roles.** For each role, set each area to None, User or Admin using the answers above. | Saved; the system admin row can't be reduced | |
| A-3 | **Settings → Users → Register User** for each person in the pilot group: role, and farm where it applies. | Each gets an email with a set-password link (or the app shows a link to copy if email isn't set up) | |
| A-4 | Ask one pilot user to open their link and sign in. | They land on Home and see only their areas | |
| A-5 | **Settings → Approvals.** Set a limit for purchase orders and for money going out. | Saved | |
| A-6 | As a non-approver, raise a purchase order over the limit. | It waits as *pending approval*; the bell notifies an approver | |
| A-7 | As that same non-approver, try to approve it. | Refused (nobody approves their own request) | |
| A-8 | As the owner, open **Approvals** and reject it with a reason. | PO returns to draft; the requester is notified with the reason | |
| A-9 | **Settings → Lists & options.** Change a list (for example add a mortality cause). | The new choice appears in the matching dropdown | |
| A-10 | **Settings → Money setup.** Read the categories and cost centres. | One cost centre per farm, plus Feed Mill and Admin | |
| A-11 | **Settings → Payroll.** | EPF 8 / 12 and ETF 3 | |
| A-12 | **Settings → Alerts.** Read the thresholds. | They can be changed and saved | |
| A-13 | Use **Forgot password?** on the sign-in page. | Reset email arrives; only the newest link works | |
| A-14 | Deactivate a test user, then try to sign in as them. | Refused | |
| A-15 | Install the app to a phone's home screen. | Opens full-screen like an app | |

Also run the common checks X-1 to X-6 in [README.md](README.md).

## Should be refused

| ID | Try | Expected |
|---|---|---|
| A-R1 | A farm manager opens `/settings` by typing the address | Not authorised |
| A-R2 | A Farm A user opens a Farm B batch by address | Refused |
| A-R3 | Sign in with a wrong password 11 times | Locked out for a while (rate limit) |

## Feedback to draw out

- Do the seven roles (system admin, farm manager, accountant, supervisor, feed mill operator, farm worker, viewer) match real jobs? Is one missing, for example an owner who isn't the technical admin?
- Are the area names in the matrix the names you'd use?
- Are two approval limits (purchase orders, money out) enough? Should payroll or sales discounts have one?
- Is a notification every 30 minutes right, or too slow for anything?
- What would you want on Home that isn't there?

## Passed when

The access matrix and approval limits are agreed and written down, every pilot user can sign in and sees the right areas, and the owner has approved and rejected a request.
