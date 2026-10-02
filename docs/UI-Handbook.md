# FarmFlow UI Handbook

The UI source of truth. Every screen follows the "Open Air" design direction: white and sky panels, one strong blue, a warm orange panel for things to do, Manrope, big rounded cards, pill buttons and pill navigation, light and dark.

If a screen and this handbook disagree, fix the screen.

## Foundations

**Colour.** Use the semantic tokens in `packages/frontend/src/index.css` only: `bg-panel`, `bg-panel-warm`, `text-success|warning|info|danger`, the `*-soft` backgrounds, `var(--chart-N)`. Never raw palette classes (`bg-blue-500`) or hex values. A bare `border` class already uses the theme border colour.

**Colour means status.** Green, orange, blue and red are reserved for status. Categories (roles, feed types, account types) use a plain `Badge variant="secondary"` or `"outline"`.

**Shape.** Cards are `rounded-3xl` (the `Card` primitive). Buttons, tabs, badges and nav items are pills. Inputs and selects are `rounded-xl`. Menus are `rounded-2xl` with `rounded-xl` items.

**Type.** Page title `text-3xl font-extrabold tracking-tight`. Section title `text-xl font-bold`. Labels in sentence case ("Purchase orders", not "Purchase Orders").

**Touch.** Anything tappable on a phone is at least 44px tall.

**Icons in buttons and menu items.** Put the icon straight inside; the component sets size and gap. No `mr-2`.

## Shell

- Top bar, never a sidebar: logo, pill navigation, notifications, account menu.
- Phones get a bottom bar with four places plus "More".
- Navigation order lives in `config/navigation.ts`. Order items the way the work flows (place, then flock, then care, then controls), not alphabetically.
- Settings sections are grouped under the same headings as the main bar, in the same order.

## Menus and dropdowns

Use `DropdownMenu` and `Select` from `components/ui` with no styling overrides. The primitives own radius, padding, item height, border and shadow, so every menu in the app looks the same. Destructive items use `variant="destructive"` and sit last, after a separator.

## Tables

One pattern for every table.

1. **Opening a record: click the row.** Give `TableRow` an `onOpen` handler. The first cell is the record's name in `font-semibold`. No eye icons, no "View" buttons, no underlined code links.
2. **Everything else: one "…" menu** in the last column, built with `RowActions`. Order is Open, Edit, other actions, then destructive actions after a divider. A row whose only action is opening shows a chevron instead.
3. **Queue tables** (approvals, cheques to clear) show their decision as labelled buttons by marking those actions `primary`. Never icon-only.
4. The last column uses `TableActionsHead` and `TableActionsCell`. It is always rendered; actions the user may not use are passed with `hidden`.
5. Status is always `StatusBadge`. Add new statuses to its tone map, never colour them on a page.
6. Empty state: a centred muted line inside the table body, or the icon-and-message block when the whole list is empty.

```tsx
<TableRow key={batch.id} onOpen={() => navigate(`/batches/${batch.id}`)}>
  <TableCell className="font-semibold">{batch.batchCode}</TableCell>
  <TableCell><StatusBadge status={batch.status} /></TableCell>
  <TableActionsCell>
    <RowActions
      label={`batch ${batch.batchCode}`}
      open={`/batches/${batch.id}`}
      actions={[
        { label: 'Edit', icon: Pencil, onSelect: () => edit(batch) },
        { label: 'Delete', icon: Trash2, destructive: true, hidden: !canDelete, onSelect: () => remove(batch) },
      ]}
    />
  </TableActionsCell>
</TableRow>
```

Rows inside a form (lorry lines, requisition lines) are not records: they keep a single ghost trash button with an `aria-label`.

## Cards that open something

The whole card is the link, with an arrow at the bottom right that nudges on hover (see the site cards and the Settings health links). Never a link on the title alone.

## Pages

1. `div.space-y-6`
2. Header: title, optional one-line muted description, primary action on the right.
3. `Tabs` for sibling workflows, ordered by how the work flows: daily work first, reports next, setup last.
4. One `Card` per list, toolbar first (search and filters left, primary action right), then the table.

## Forms and dialogs

Dialogs for create, edit and confirm. `DialogHeader`, short description, grid of fields, footer with Cancel then the primary action.

## Feedback

Toasts for finished actions and errors (`parseApiError` / `getApiErrorMessage` for API messages). Skeletons while loading.

## Before merging a screen

1. Light and dark both checked.
2. Phone width checked; touch targets 44px.
3. Only semantic tokens.
4. Tables follow the one pattern above.
5. Menus use the primitives without overrides.
6. Labels in sentence case.
