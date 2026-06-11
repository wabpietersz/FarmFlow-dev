# FarmFlow UI Handbook

## Purpose

This document is the UI source of truth for FarmFlow. It describes the design language currently implemented in the application and should be used when adding or refactoring screens.

This is not a new visual redesign. It is a codified description of the existing product shell, shared primitives, and common page patterns already used across dashboard, feed, batches, reports, people, admin, and inventory.

## Source Files

The implemented UI language lives primarily in these files:

- `packages/frontend/src/index.css`
- `packages/frontend/src/components/layout/AppLayout.tsx`
- `packages/frontend/src/components/layout/MobileBottomNav.tsx`
- `packages/frontend/src/components/ui/button.tsx`
- `packages/frontend/src/components/ui/card.tsx`
- `packages/frontend/src/components/ui/tabs.tsx`
- `packages/frontend/src/pages/DashboardPage.tsx`
- `packages/frontend/src/pages/BatchesPage.tsx`
- `packages/frontend/src/pages/BatchDetailPage.tsx`
- `packages/frontend/src/pages/FeedPage.tsx`
- `packages/frontend/src/pages/ReportsPage.tsx`
- `packages/frontend/src/pages/InventoryManagementPage.tsx`

If a future screen conflicts with this handbook, the shared primitives and implemented shell take precedence.

## Design Principles

1. Keep the UI operational and restrained.
2. Prefer shared primitives over custom one-off styling.
3. Use monochrome structure first; use color mainly for status and emphasis.
4. Let layout, spacing, and typography create hierarchy instead of decoration.
5. Keep workflows dense enough for daily operational use, but not visually noisy.

## Foundations

### Color

FarmFlow uses a neutral palette defined in `packages/frontend/src/index.css`.

- Backgrounds are white or very light gray.
- Primary emphasis is near-black.
- Borders are light gray.
- Muted text is medium gray.
- Destructive states use red.

Avoid introducing branded accent palettes at the page level unless the whole app design language changes.

### Typography

Typography is intentionally plain and functional.

- Base font stack: system sans-serif (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `Helvetica Neue`, `Arial`, `sans-serif`)
- Page title: `text-2xl font-bold text-foreground`
- Section title inside cards: `text-lg font-medium`
- Supporting copy: `text-sm text-muted-foreground`
- Table metadata and secondary identifiers: `text-xs text-muted-foreground`

Do not introduce oversized hero headers, decorative tracking, or marketing-style typography in operational pages.

### Radius and Surfaces

- Primary page surfaces use `Card`
- Default card radius is rounded but subtle (`rounded-xl` through the shared component)
- Inputs, buttons, badges, and dialogs use the shared shadcn variants
- Borders are used more than shadows to define structure

Prefer `Card`, `Dialog`, `Tabs`, `Table`, `Input`, `Select`, `Textarea`, and `Button` from `components/ui` before custom wrappers.

### Spacing

Use the existing spacing cadence:

- Page container: `space-y-6`
- Card content: `pt-6`
- Toolbar rows: `mb-6`
- Form grids: `gap-4` for major rows, `gap-2` for compact field groups
- Table action groups: `gap-2`

## App Shell

### Desktop

- Sticky top bar with product name at left and account menu at right
- Left sidebar navigation with grouped sections
- Active primary destination uses filled primary styling
- Main content area is left-aligned, padded, and constrained with `lg:max-w-7xl`

### Mobile

- Bottom navigation for top-level destinations
- Expandable group panel for grouped navigation
- Safe-area padding applied at top and bottom

New screens must fit into this shell. Do not create module-specific navigation metaphors that compete with it.

## Common Page Pattern

### Standard Page Structure

Most operational pages should follow this pattern:

1. Outer container: `div.space-y-6`
2. Header row with title and optional actions
3. Optional muted one-line description
4. Tabs when a module contains closely related sub-workflows
5. Card-wrapped working area per tab
6. Toolbar row inside the card
7. Table, form, metrics, or detail content below the toolbar

### Page Headers

Preferred header treatment:

- Title only for well-known modules such as Dashboard and Feed
- Title plus one muted sentence when a new or cross-cutting module needs clarification

Use short, direct titles. Avoid oversized headings, promotional copy, or decorative layout.

## Tabs

Tabs are used for adjacent workflows inside a module.

- Use the shared `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent`
- Keep the tab strip compact and left-aligned
- Include icons only when they help scanning and already fit the module pattern
- Do not stretch tabs across the full page unless the rest of the module already behaves that way

Feed and Inventory should both use the same compact tab language.

## Cards

Cards are the default content container.

- Use one primary card per tab for list workflows
- Use grid cards for summary metrics where the page already needs KPIs
- Keep card internals simple: toolbar first, content second

Do not stack heavily styled nested panels unless the workflow truly needs it.

## Toolbars and Filters

Operational list screens use a consistent toolbar pattern:

- Search or filters on the left
- Primary action on the right
- Mobile layout collapses to a vertical stack

Preferred class pattern:

- `flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`

## Tables

Tables are the default view for records, master data, and transaction history.

Use tables for:

- inventory items
- purchase orders
- suppliers
- batches
- daily records
- reports with row-based analysis

Table rules:

- Keep columns directly tied to operational decisions
- Use muted secondary text for codes and supporting metadata
- Right-align action columns
- Use empty-state rows inside the table body
- Prefer badges for status, not custom pills per page

## Forms and Dialogs

Dialogs are the standard pattern for create, edit, receive, and consume flows.

- Use `DialogHeader`, `DialogTitle`, and `DialogDescription`
- Keep descriptions short and task-specific
- Use grid-based field layouts
- Use shared buttons in the footer
- Primary action goes last

Avoid turning dialogs into custom full-screen experiences unless the workflow clearly exceeds modal complexity.

## Status and Feedback

### Badges

Use shared `Badge` variants:

- `secondary` for feed classification or softer emphasis
- `outline` for neutral states and metadata
- `destructive` for low stock or error states

### Toasts

Use toast feedback for completed mutations and error handling.

- Success copy should be short and past-tense
- Errors should use parsed API feedback where available

## Empty, Loading, and Detail States

- Empty tables should render a centered muted message inside a table row
- Loading detail dialogs can use a short muted line when the content is lightweight
- Summary metrics should use card-based loading skeletons where metrics already exist elsewhere in the app

Avoid adding custom empty-state illustrations or heavily branded placeholders.

## Module Guidance

### Feed

Feed is a focused production workflow:

- Feed inventory
- Recipes
- Production
- Distribution

Suppliers and purchase orders do not belong here anymore.

### Inventory

Inventory is a shared operational module:

- All inventory items
- Suppliers
- Purchase orders
- Inventory item types
- Batch-consumed non-feed inventory

Feed-classified inventory items must still remain visible in Feed > Inventory, but the canonical management surface is Inventory Management.

### Batches

Batch views can show denser operational detail and supporting metrics, but should still use the same core primitives and spacing language.

### Reports

Reports are the main exception where metric cards and charts are expected. Even there, typography, cards, tabs, filter rows, and tables should still follow the same base system.

## Do and Do Not

### Do

- Reuse shared UI primitives
- Match page title scale to existing modules
- Keep tabs compact and scannable
- Use muted copy for explanations
- Prefer cards and tables over bespoke containers
- Keep action placement consistent across modules

### Do Not

- Introduce module-specific visual systems
- Use oversized headers or marketing-style sections
- Stretch tabs into custom segmented controls without clear precedent
- Create custom badge systems when shared variants are enough
- Add decorative gradients, heavy shadows, or brand accents to operational pages

## Implementation Checklist

Before merging a new screen or major UI refactor, verify:

1. The page sits correctly inside `AppLayout`
2. Typography matches existing page scales
3. Shared primitives are used instead of custom elements where possible
4. Toolbar, card, and table spacing matches existing modules
5. Status treatments use shared badges and button variants
6. Mobile stacking works for header, toolbar, and dialogs
7. Navigation placement matches the established information architecture

## Current Decision

Inventory Management has been aligned to the same visual language as the rest of the app. Future work should extend this handbook rather than inventing local styling rules inside individual modules.
