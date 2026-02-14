# FarmFlow - Navigation UX Improvement: Unified Plan

**Version:** 1.1  
**Date:** February 14, 2026  
**Status:** Planned and Implemented  
**Scope:** Information architecture, desktop/mobile navigation behavior, implementation sequence, and QA criteria

---

## Functional Requirements

## 1. Problem Statement

Current navigation is a flat list on desktop and a mixed bottom-nav + sheet model on mobile. This causes:

1. High cognitive load (too many top-level items)
2. Weak module grouping (related workflows are separated)
3. Mobile navigation inefficiency for common paths
4. Inconsistent mental model between desktop and mobile
5. Accessibility gaps for keyboard/screen-reader-first navigation

---

## 2. Target Information Architecture

### Top-Level Structure

1. `Dashboard` (standalone)
2. `People & Payroll` (group)
   - `Employees`
   - `Attendance`
   - `Payroll`
3. `Operations & Sales` (group)
   - `Sites`
   - `Batches`
   - `Sales`
4. `Feed` (standalone)
5. `Reports` (standalone)
6. `Admin` (group, low priority)
   - `Users`
   - `Settings`

### Navigation Ordering Rules

1. Dashboard always first
2. Operational groups in the middle
3. Feed and Reports remain quickly reachable as standalone
4. Admin actions remain de-emphasized and placed last

---

## 3. Desktop Behavior Requirements

### Sidebar

- FR-NAV-1.1: Replace flat list with grouped sections and headers
- FR-NAV-1.2: Keep standalone items visible without expansion (`Dashboard`, `Feed`, `Reports`)
- FR-NAV-1.3: `People & Payroll`, `Operations & Sales`, `Admin` are collapsible groups
- FR-NAV-1.4: Group containing active route auto-expands
- FR-NAV-1.5: Active page and parent group must both show active state
- FR-NAV-1.6: Preserve RBAC filtering exactly as today

### Discoverability

- FR-NAV-1.7: Show current location via active nav state and page title consistency
- FR-NAV-1.8: Keep account/profile actions separate from module navigation

---

## 4. Mobile Behavior Requirements

### Bottom Navigation

- FR-NAV-2.1: Replace current tabs with 5 task tabs:
  - `Dashboard`
  - `People`
  - `Operations`
  - `Feed`
  - `Reports`
- FR-NAV-2.2: Remove module-level fragmentation from bottom tabs (for example direct `Batches` tab)
- FR-NAV-2.3: Move `Users` and `Settings` to account/admin entry point (profile menu or admin sheet)

### Group Navigation on Mobile

- FR-NAV-2.4: `People` opens grouped access to `Employees`, `Attendance`, `Payroll`
- FR-NAV-2.5: `Operations` opens grouped access to `Sites`, `Batches`, `Sales`
- FR-NAV-2.6: First-level mobile destinations should be reachable within 2 taps from dashboard
- FR-NAV-2.7: Keep labels always visible on bottom tabs (no icon-only mode)

---

## 5. Accessibility Requirements

- FR-NAV-3.1: Minimum touch target size: 44x44 px
- FR-NAV-3.2: Keyboard operable group toggle and item navigation on desktop
- FR-NAV-3.3: `aria-expanded`, `aria-current`, and clear landmark labels for navigation
- FR-NAV-3.4: Visible focus ring on all interactive navigation elements
- FR-NAV-3.5: Maintain WCAG AA contrast for active/inactive states
- FR-NAV-3.6: Screen reader labels must include module names and group context

---

## 6. Route-to-Group Mapping (No URL Changes)

| Existing Route | New Group |
|---|---|
| `/dashboard` | Dashboard |
| `/employees` | People & Payroll |
| `/attendance` | People & Payroll |
| `/payroll` | People & Payroll |
| `/sites` | Operations & Sales |
| `/batches` | Operations & Sales |
| `/sales` | Operations & Sales |
| `/feed` | Feed |
| `/reports` | Reports |
| `/users` | Admin |
| `/settings` | Admin |

---

## 7. Success Metrics

1. Reduce average taps/clicks to reach `Attendance`, `Payroll`, `Batches`, and `Sales` on mobile
2. Improve first-time task discovery for grouped areas (People and Operations)
3. Reduce usage of overflow/sheet navigation for core daily workflows
4. Zero RBAC regressions in nav visibility
5. Zero accessibility regressions for keyboard and screen reader use

---

## 8. Out of Scope

1. No backend API changes
2. No business logic changes inside module pages
3. No route path renaming/removal in this improvement
4. No redesign of dashboard cards/content


---

## Implementation Plan

## Implementation Strategy

Implementation is prepared as one coordinated release (single cutover), but broken into internal workstreams for execution order and validation:

1. Navigation model and IA config updates
2. Desktop grouped sidebar behavior (no visual separators, fixed-height behavior)
3. Mobile grouped flow and bottom nav update (animated bottom slate for grouped links)
4. Accessibility hardening and regression checks
5. Final verification and release checklist

### Revision Constraints (Requested)

1. Main navigator must be exactly:
   - Dashboard
   - People (`Employees`, `Attendance`, `Payroll`)
   - Operational (`Sites`, `Batches`, `Sales`)
   - Feed
   - Reports
2. Main entries must have clear top-level icons.
3. No visual separators in navigator sections.
4. Navigator should not resize when selecting links due to expand/collapse state changes.
5. On mobile, grouped links must open from an animated bottom slate expanding from the tapped icon.

---

## Sprint NAV-A: IA Model and Configuration Foundation (~6h)

### Task NAV-A1: Define grouped nav config

**Files to modify:**
- `packages/frontend/src/config/navigation.ts`

**Planned changes:**
1. Introduce grouped navigation structure (`standalone` + `grouped` sections)
2. Keep permission mapping per child route
3. Keep route URLs unchanged
4. Add optional mobile tab metadata for grouped entry points

**Acceptance criteria:**
- Config cleanly represents target IA
- Existing route permissions remain mapped
- TypeScript compiles without config type errors

### Task NAV-A2: Centralize route-group resolution helper

**Files to modify:**
- `packages/frontend/src/config/navigation.ts`
- `packages/frontend/src/lib/utils.ts` (or dedicated helper)

**Planned changes:**
1. Add helper to resolve active group from current pathname
2. Add helper to compute default expanded group for desktop
3. Add helper for mobile "selected tab" derivation

**Acceptance criteria:**
- Active state is deterministic for all existing routes
- Deep links open correct group context

---

## Sprint NAV-B: Desktop Grouped Sidebar (~10h)

### Task NAV-B1: Refactor sidebar rendering to grouped sections

**Files to modify:**
- `packages/frontend/src/components/layout/AppLayout.tsx`

**Planned changes:**
1. Replace flat sidebar map with grouped rendering
2. Keep top-level entries:
   - Dashboard
   - People
   - Operational
   - Feed
   - Reports
3. Keep child links nested under `People` and `Operational`
4. Keep `Users` and `Settings` out of the main sidebar (profile dropdown only)
5. Preserve existing active-route styling semantics

**Acceptance criteria:**
- Desktop sidebar renders grouped IA correctly
- Active route and parent group are visually clear
- No permission-filter regressions

### Task NAV-B2: Desktop interaction and persistence behavior

**Files to modify:**
- `packages/frontend/src/components/layout/AppLayout.tsx`

**Planned changes:**
1. Keep People and Operational child links always visible under their parent headings
2. Remove desktop expand/collapse behavior to avoid navigator height shifts
3. Keep active highlighting for both parent and selected child route
4. Ensure keyboard interaction works for all links

**Acceptance criteria:**
- Sidebar height/layout remains stable during navigation
- Sidebar remains fully keyboard operable

---

## Sprint NAV-C: Mobile Navigation Optimization (~12h)

### Task NAV-C1: Redesign bottom tab model

**Files to modify:**
- `packages/frontend/src/components/layout/MobileBottomNav.tsx`
- `packages/frontend/src/components/layout/AppLayout.tsx`

**Planned changes:**
1. Set mobile tabs to:
   - Dashboard
   - People
   - Operational
   - Feed
   - Reports
2. Move admin links (`Users`, `Settings`) out of bottom tabs into profile/admin access path
3. Keep tab labels always visible

**Acceptance criteria:**
- Bottom nav matches target tab set
- Admin actions are not mixed into core task tabs

### Task NAV-C2: Mobile grouped entry experience

**Files to modify (expected):**
- `packages/frontend/src/components/layout/AppLayout.tsx`
- `packages/frontend/src/components/layout/MobileBottomNav.tsx`

**Planned changes:**
1. Provide grouped access for People and Operational via animated bottom slate
2. Slate expands from tapped bottom-nav icon and lists child routes
3. Ensure common targets (`Attendance`, `Payroll`, `Batches`, `Sales`) are reachable in <=2 taps from dashboard
4. Preserve deep-link behavior to existing module pages

**Acceptance criteria:**
- Mobile grouped slate animation is smooth and anchored to tapped icon
- Existing module routes still accessible directly and via deep links

---

## Sprint NAV-D: Accessibility and QA Hardening (~6-8h)

### Task NAV-D1: Accessibility compliance for nav controls

**Files to modify:**
- `packages/frontend/src/components/layout/AppLayout.tsx`
- `packages/frontend/src/components/layout/MobileBottomNav.tsx`

**Planned changes:**
1. Add `aria-expanded` for grouped mobile tabs
2. Add `aria-current="page"` for active links
3. Ensure focus-visible styles are clear and consistent
4. Validate touch target size constraints on mobile

**Acceptance criteria:**
- Keyboard and screen reader navigation works for grouped nav
- Focus and active states pass visual QA

### Task NAV-D2: Regression checks and smoke test matrix

**Files to modify (expected):**
- Optional frontend tests near nav/layout components

**Manual QA matrix:**
1. Role-based visibility for all nav items
2. Active state correctness across all routes
3. Mobile tabs and grouped flow behavior
4. Profile access path to admin pages
5. Desktop and mobile responsive behavior at breakpoints

**Acceptance criteria:**
- No regressions in route access or RBAC visibility
- Navigation behavior consistent across viewport sizes

---

## Release Plan (Single Go-Live)

1. Implement NAV-A through NAV-D in one branch
2. Run build/lint/test verification
3. Execute manual QA matrix for desktop and mobile
4. Deploy all navigation improvements in one release

## Execution Result

1. Grouped navigator implemented with required top-level structure and icons.
2. Desktop navigator updated to no-separator fixed grouping behavior.
3. Mobile grouped routes implemented with animated bottom slate expansion from selected icon.
4. Automated verification completed:
   - Frontend build
   - Frontend tests
   - Local runtime health checks for frontend and backend

---

## Verification Checklist (Post-Implementation)

Run after implementation begins:

```bash
npm run build --workspace=packages/shared
npm run build --workspace=packages/frontend
npm run test --workspace=packages/frontend
```

If frontend test scope is limited, supplement with manual QA checklist above before release.
