# FarmFlow - Feed Module Improvements: Unified Plan

**Version:** 1.1
**Date:** February 14, 2026
**Status:** Planned
**Scope:** Functional requirements and implementation roadmap for feed supply chain integrity improvements

---

## Functional Requirements

## 1. Problem Statement

The current Feed Management module has **structural disconnects** in its data flow. While individual features work (suppliers, recipes, inventory, production, distribution), they operate in silos with weak or missing referential integrity between them. Key issues:

1. **Recipe ingredients reference inventory by free-text name** — no FK, fuzzy `ilike()` matching during production
2. **Suppliers are disconnected** — FK exists on inventory/recipe-ingredients but is optional, unenforced, and never queried
3. **No purchase order system** — restocking is a single quantity bump with no sourcing context
4. **Recipe cost is static** — doesn't calculate from actual ingredient costs
5. **Audit trail lacks supply chain context** — logs quantity changes but not recipe/supplier/PO references
6. **Reorder suggestions are demand-blind** — don't factor in upcoming production needs

---

## 2. Improvement Overview

### March 16, 2026 Addendum: Inventory Management split

The original feed improvements in this document have now been expanded into a broader inventory initiative. The new operating model is:

- `Inventory Management` owns suppliers, purchase orders, all inventory, and inventory basic data
- `Feed Management` remains focused on feed-only inventory, recipes, production, and distribution
- feed inventory continues to exist in Feed, but as a filtered subset of the shared inventory domain

The detailed requirements for that split are tracked in [docs/Inventory-Management-Module-Plan.md](docs/Inventory-Management-Module-Plan.md).

This feed plan still applies to feed-specific integrity work, but any new supplier/PO/general-inventory changes should now be implemented through the inventory management plan.

### IMP-1: Recipe Ingredient → Inventory Item FK Link
**Priority:** CRITICAL

**Current:** `feedRecipeIngredients.ingredientName` (VARCHAR) matched via `ilike()` to `feedInventory.ingredientName`
**Target:** `feedRecipeIngredients.inventoryItemId` (INTEGER FK → `feedInventory.id`)

**Functional Requirements:**
- FR-IMP-1.1: Add `inventoryItemId` column to `feedRecipeIngredients` table
- FR-IMP-1.2: Recipe creation form must show a dropdown of existing inventory items (not free-text)
- FR-IMP-1.3: Recipe creation API must validate that each `inventoryItemId` exists in `feedInventory`
- FR-IMP-1.4: Production batch creation must use `inventoryItemId` FK directly (eliminate fuzzy matching)
- FR-IMP-1.5: Keep `ingredientName` as a denormalized display field, auto-populated from inventory item
- FR-IMP-1.6: Migration must backfill existing recipe ingredients by matching `ingredientName` to inventory

**Business Rules:**
- An ingredient cannot be added to a recipe if it doesn't exist in inventory
- Deleting an inventory item that is referenced by active recipes must be blocked (or cascade warning)
- Ingredient name changes in inventory should reflect in recipe display (via FK join, not denormalized copy)

---

### IMP-2: Supplier → Inventory Enforcement
**Priority:** HIGH

**Current:** `feedInventory.supplierId` is optional and never validated
**Target:** Required field with validation, supplier detail included in inventory queries

**Functional Requirements:**
- FR-IMP-2.1: Make `supplierId` required on inventory item creation/update
- FR-IMP-2.2: Validate supplier exists and is active before accepting `supplierId`
- FR-IMP-2.3: Inventory list endpoint must return supplier name (join query)
- FR-IMP-2.4: Inventory detail endpoint must return full supplier info
- FR-IMP-2.5: Supplier detail endpoint must list associated inventory items
- FR-IMP-2.6: Block soft-delete of supplier that has active inventory items (or warn)
- FR-IMP-2.7: Frontend inventory form must show supplier dropdown (not manual ID entry)
- FR-IMP-2.8: Migration must backfill existing inventory items with a default supplier or flag for review

**Business Rules:**
- Every inventory item must have an active supplier
- Supplier deactivation triggers a review prompt for associated inventory items
- Multiple inventory items can reference the same supplier

---

### IMP-3: Purchase Order System
**Priority:** CRITICAL

**Current:** No purchase tracking. Restocking is a manual quantity increment with no context.
**Target:** Full purchase order lifecycle from creation through receiving to inventory restock.

**Functional Requirements:**

#### Purchase Orders
- FR-IMP-3.1: Create `purchaseOrders` table (id, supplierId FK, orderCode auto-generated, orderDate, expectedDeliveryDate, actualDeliveryDate, status, totalCost, notes, createdBy FK, timestamps)
- FR-IMP-3.2: Create `purchaseOrderItems` table (id, purchaseOrderId FK, inventoryItemId FK, orderedQuantity, unitPrice, receivedQuantity, unit, notes)
- FR-IMP-3.3: Purchase order status workflow: `draft → submitted → partially_received → received → cancelled`
- FR-IMP-3.4: Auto-generate order code: `PO-YYYYMMDD-XXX`
- FR-IMP-3.5: Purchase order total cost auto-calculated from sum of (orderedQuantity × unitPrice)

#### Receiving
- FR-IMP-3.6: Receive endpoint accepts partial or full delivery per line item
- FR-IMP-3.7: On receive: auto-restock inventory (increment quantity, update lastRestockDate, update costPerUnit)
- FR-IMP-3.8: On receive: create audit trail entry with `changeType: 'purchase_receive'` and `referenceType: 'purchase_order'`
- FR-IMP-3.9: Auto-transition PO status: `submitted → partially_received` (if partial), `→ received` (if all items fully received)
- FR-IMP-3.10: Block receiving on cancelled or draft POs

#### Integration
- FR-IMP-3.11: Reorder suggestions must link to supplier and allow "Create PO" action
- FR-IMP-3.12: Inventory restock endpoint deprecated in favor of PO receiving (or kept for manual adjustments only)
- FR-IMP-3.13: Supplier detail page shows purchase order history
- FR-IMP-3.14: Inventory audit trail entries for PO receives include purchaseOrderId reference

#### Frontend
- FR-IMP-3.15: New "Purchase Orders" tab in FeedPage
- FR-IMP-3.16: PO list with status filter, search, date range
- FR-IMP-3.17: Create PO dialog: select supplier → add line items from inventory catalog → set quantities and prices
- FR-IMP-3.18: PO detail page: summary, line items table, receive button per item, status workflow
- FR-IMP-3.19: "Quick PO" from reorder suggestions (pre-fills supplier and items)

**Business Rules:**
- A PO must have at least one line item
- Line items must reference existing inventory items
- Received quantity cannot exceed ordered quantity (warn, allow override with note)
- Only `submitted` POs can be received against
- Cancelling a PO with partially received items requires confirmation
- PO cost updates when line items are modified (draft only)

---

### IMP-4: Dynamic Recipe Cost Calculation
**Priority:** HIGH

**Current:** `feedRecipes.cost` is a manually entered static decimal field
**Target:** Recipe cost calculated dynamically from ingredient proportions × inventory cost per unit

**Functional Requirements:**
- FR-IMP-4.1: Add `calculatedCost` computed field to recipe detail endpoint (sum of ingredient proportion × inventoryItem.costPerUnit)
- FR-IMP-4.2: Recipe list endpoint includes both `cost` (manual/locked) and `calculatedCost` (live)
- FR-IMP-4.3: Recipe creation can auto-set `cost` from calculated value or allow manual override
- FR-IMP-4.4: Cost optimization endpoint compares current recipe costs against latest inventory prices per supplier
- FR-IMP-4.5: Recipe version creation captures cost snapshot (what the cost was at time of version creation)
- FR-IMP-4.6: Frontend shows cost comparison (manual vs calculated) with delta indicator
- FR-IMP-4.7: Production batch cost uses actual material costs at time of production (not recipe static cost)

**Business Rules:**
- Calculated cost updates in real-time as inventory prices change
- Manual cost override is preserved for budgeting/quoting purposes
- Cost discrepancy > 10% triggers a visual warning
- Production cost = sum of (actualQuantity × costPerUnit at time of production)

---

### IMP-5: Enhanced Audit Trail with Supply Chain Context
**Priority:** MEDIUM

**Current:** `inventoryAuditTrail` logs quantity changes with optional `referenceId` and `referenceType`
**Target:** Rich context including recipe, supplier, and purchase order references + reason field

**Functional Requirements:**
- FR-IMP-5.1: Add `notes` (TEXT) to `inventoryAuditTrail` for human-readable context
- FR-IMP-5.2: Production deductions must include `referenceType: 'production_batch'`, `referenceId: productionBatchId`
- FR-IMP-5.3: Purchase order receives must include `referenceType: 'purchase_order'`, `referenceId: purchaseOrderId`
- FR-IMP-5.4: Manual adjustments must include mandatory `notes` field explaining the reason
- FR-IMP-5.5: Distribution deductions must include `referenceType: 'distribution'`, `referenceId: distributionId`
- FR-IMP-5.6: Audit trail list endpoint supports filtering by `changeType` and `referenceType`
- FR-IMP-5.7: Frontend audit trail viewer shows clickable references (link to PO detail, production detail, etc.)

**Business Rules:**
- Every audit trail entry must have a `changeType` and either a reference or notes
- Audit entries are immutable (no update/delete)

---

### IMP-6: Demand-Aware Reorder Suggestions
**Priority:** MEDIUM

**Current:** `suggestedOrderQuantity = reorderLevel × 3 - currentQuantity` (static formula)
**Target:** Factor in pending/planned production batch demand when calculating reorder quantities

**Functional Requirements:**
- FR-IMP-6.1: Reorder suggestions endpoint calculates upcoming demand from planned/in_progress production batches
- FR-IMP-6.2: Demand = sum of plannedQuantity for each ingredient used in pending production batches (via recipe → ingredients → inventory FK)
- FR-IMP-6.3: Suggested order = max(reorderLevel, currentQuantity + upcomingDemand) - currentQuantity + safetyBuffer
- FR-IMP-6.4: Safety buffer configurable per inventory item or globally (default: 20% of demand)
- FR-IMP-6.5: Reorder response includes demand breakdown (which production batches need this ingredient)
- FR-IMP-6.6: Frontend shows demand context alongside suggestion (e.g., "3 planned batches need 500kg in next 7 days")
- FR-IMP-6.7: "Create PO" button from reorder suggestion pre-fills supplier and quantities

**Business Rules:**
- Only `planned` and `in_progress` production batches contribute to demand
- Demand window configurable (default: next 14 days based on scheduledDate/productionDate)
- If no supplier is linked, reorder suggestion flags "No supplier assigned"

---

## 3. Data Model Changes Summary

### New Tables
| Table | Purpose |
|-------|---------|
| `purchase_orders` | Purchase order header (supplier, dates, status, cost) |
| `purchase_order_items` | Line items per PO (inventory item, qty, price, received qty) |

### Modified Tables
| Table | Change |
|-------|--------|
| `feed_recipe_ingredients` | Add `inventoryItemId` FK → `feedInventory.id` |
| `feed_inventory` | Make `supplierId` effectively required (via validation) |
| `inventory_audit_trail` | Add `notes` TEXT column |

### Unchanged Tables
- `suppliers`, `feedRecipes`, `feedProductionBatches`, `feedProductionMaterials`, `feedDistributions`, `inventoryAlerts`, `reportSchedules`

---

## 4. API Endpoint Changes Summary

### New Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/feed/purchase-orders` | List purchase orders (filter by status, supplier, date) |
| GET | `/api/feed/purchase-orders/:id` | Purchase order detail with line items |
| POST | `/api/feed/purchase-orders` | Create purchase order |
| PUT | `/api/feed/purchase-orders/:id` | Update purchase order (draft only) |
| DELETE | `/api/feed/purchase-orders/:id` | Delete purchase order (draft only) |
| PUT | `/api/feed/purchase-orders/:id/status` | Update PO status (submit, cancel) |
| POST | `/api/feed/purchase-orders/:id/receive` | Receive items against PO |
| GET | `/api/feed/suppliers/:id/purchase-orders` | PO history for a supplier |
| GET | `/api/feed/suppliers/:id/inventory` | Inventory items for a supplier |

### Modified Endpoints
| Method | Path | Change |
|--------|------|--------|
| POST | `/api/feed/recipes` | Accept `inventoryItemId` per ingredient; validate FK |
| PUT | `/api/feed/recipes/:id` | Accept `inventoryItemId` per ingredient; validate FK |
| GET | `/api/feed/recipes/:id` | Return `inventoryItemId` + `calculatedCost` |
| GET | `/api/feed/recipes` | Return `calculatedCost` per recipe |
| POST | `/api/feed/inventory` | Require `supplierId`; validate supplier exists |
| PUT | `/api/feed/inventory/:id` | Require `supplierId`; validate supplier exists |
| GET | `/api/feed/inventory` | Join supplier name in response |
| POST | `/api/feed/production` | Use `inventoryItemId` from recipe (no fuzzy matching) |
| GET | `/api/feed/inventory/reorder-suggestions` | Include demand from pending production batches |
| GET | `/api/feed/recipes/cost-optimization` | Compare against actual inventory costs per supplier |

---

## 5. Frontend Changes Summary

### New UI Components
- **Purchase Orders Tab** in FeedPage (list, create, detail, receive)
- **PO Detail Page** (or dialog) with line items, status workflow, receive actions
- **"Create PO" button** on reorder suggestions

### Modified UI Components
- **Recipe Form**: Ingredient input changes from free-text to inventory item dropdown
- **Inventory Form**: Supplier field becomes required dropdown
- **Inventory List**: Shows supplier name column
- **Reorder Suggestions**: Shows demand context + "Create PO" action
- **Audit Trail Viewer**: Shows clickable reference links + notes
- **Recipe List/Detail**: Shows calculated cost vs manual cost with delta

---

## 6. Connected Data Flow (Target State)

```
┌──────────┐      ┌─────────────────┐      ┌──────────────┐
│ Supplier │─────→│ Purchase Order   │─────→│  Inventory   │
│          │      │ (PO items)       │      │  (restocked) │
└──────────┘      └─────────────────┘      └──────┬───────┘
                                                   │ FK (inventoryItemId)
                                                   ▼
                                           ┌──────────────┐
                                           │    Recipe     │
                                           │ (ingredients) │
                                           └──────┬───────┘
                                                   │ scale proportions
                                                   ▼
                                           ┌──────────────┐
                                           │  Production   │
                                           │   (materials) │──→ Inventory Deduction
                                           └──────┬───────┘         (audit trail)
                                                   │
                                                   ▼
                                           ┌──────────────┐
                                           │ Distribution  │──→ Farm Batches (birds)
                                           └──────────────┘

                          ┌────────────────────────┐
                          │   Reorder Suggestions   │
                          │ (demand-aware + PO link)│
                          └────────────────────────┘
```

---

## 7. Non-Functional Requirements

- **Data Migration**: All schema changes must include backfill migrations for existing data
- **Backward Compatibility**: Existing recipes/inventory must continue to work during migration
- **Performance**: PO list and recipe cost calculation queries must respond within 500ms
- **Validation**: All FK references validated server-side before persistence
- **Testing**: Each improvement must include backend integration tests
- **Offline Support**: New PO tab must work with existing offline queueing system

---

## 8. UX Improvements (IMP-C)

### FR-IMP-C1: Feed Tab Reorder

**Current order:** Suppliers → Recipes → Inventory → Production → Distribution → Purchase Orders

**New order:** Inventory → Recipes → Production → Distribution → Purchase Orders → Suppliers

**Rationale:** Tabs should reflect the actual workflow — Inventory (what do we have?) → Recipes (what can we make?) → Production (make it) → Distribution (send it out) → Purchase Orders (order more) → Suppliers (reference data, rarely changed). Suppliers is moved last as it's reference data only needed during initial setup.

### FR-IMP-C2: Specific Form Validation Errors

**Problem:** All 6 feed dialogs show generic error messages like "Failed to create inventory item" when form validation fails, instead of telling the user which specific fields are missing or invalid.

**Solution:** Parse backend validation error responses (Zod field errors and business logic errors) and display specific field-level toast messages. The backend already returns detailed `details.fieldErrors` with messages like "Supplier is required", "Quantity must be positive" — but the frontend was ignoring them.

**Scope:** All form dialogs in Feed Management — Supplier, Recipe, Inventory, Production, Distribution, Purchase Order create/edit/receive.

**Implementation:** Reusable `parseApiError(error, fallbackMessage)` utility in `lib/api.ts` applied to all 18 catch blocks.

### FR-IMP-C3: Pre-Action Quantity Impact Indicators

**Problem:** Users execute inventory-affecting actions without seeing a clear before/after quantity impact first, increasing mistakes in feed stock handling.

**Solution:** Show projected quantity changes directly in action dialogs before submission.

**Scope:** Feed Management quantity-changing flows:
- Inventory edit (absolute quantity overwrite)
- Inventory restock (additive quantity)
- Production completion (material deductions per inventory item)
- Distribution linked to completed production (available-for-distribution reduction)
- Purchase order receiving (per-line received progression + inventory stock increase when inventory snapshot is available)

**Implementation Rules:**
- Every quantity-changing dialog must display `before → after` preview once user enters a quantity.
- Delta sign must be explicit (`+` for increments, `-` for deductions).
- Negative projections must be visually warned before submit.

---

## Implementation Plan

## Implementation Strategy

Improvements are ordered by dependency chain — each builds on the previous:

1. **IMP-1** (Recipe→Inventory FK) and **IMP-2** (Supplier enforcement) are schema foundations
2. **IMP-3** (Purchase Orders) depends on IMP-2 (supplier enforcement)
3. **IMP-4** (Dynamic Cost) depends on IMP-1 (inventory FK on ingredients)
4. **IMP-5** (Audit Trail) and **IMP-6** (Demand-Aware Reorder) depend on IMP-1 + IMP-3

---

## Sprint IMP-A: Data Integrity & Schema Foundations (~40 hours)

### Task IMP-A1: Database Migration — Recipe Ingredient FK + Supplier Enforcement (6h)

**Files to modify:**
- `packages/backend/src/db/schema/feed.ts` — Add `inventoryItemId` to `feedRecipeIngredients`, add `notes` to `inventoryAuditTrail`
- New migration file: `0004_feed_improvements_ingredient_fk.sql`

**Steps:**
1. Add `inventoryItemId` (INTEGER, FK → feedInventory.id, nullable initially) to `feedRecipeIngredients`
2. Add `notes` (TEXT, nullable) to `inventoryAuditTrail`
3. Generate migration with `npx drizzle-kit generate`
4. Write backfill SQL: match existing `feedRecipeIngredients.ingredientName` to `feedInventory.ingredientName` via UPDATE ... FROM ... WHERE ilike()
5. After backfill, verify all rows have `inventoryItemId` populated
6. Log any unmatched ingredients for manual review

**Acceptance Criteria:**
- [x] Migration runs without errors
- [x] Existing recipe ingredients are backfilled with correct inventory item IDs
- [x] Schema compiles with no TypeScript errors
- [x] All existing tests still pass

---

### Task IMP-A2: Backend — Recipe CRUD with Inventory Item FK (8h)

**Files to modify:**
- `packages/backend/src/validators/feed.ts` — Update recipe creation/update schemas to accept `inventoryItemId`
- `packages/backend/src/routes/feed.ts` — Modify recipe endpoints

**Recipe Creation (POST /feed/recipes):**
1. Accept `inventoryItemId` (required) + `proportion` + `unit` per ingredient
2. Validate each `inventoryItemId` exists in `feedInventory`
3. Auto-populate `ingredientName` from inventory item (denormalized for display)
4. Store both `inventoryItemId` and `ingredientName`

**Recipe Update (PUT /feed/recipes/:id):**
1. Same validation as creation
2. Replace ingredients atomically (existing behavior, now with FK)

**Recipe Detail (GET /feed/recipes/:id):**
1. Join `feedRecipeIngredients` → `feedInventory` to return inventory item details
2. Calculate and return `calculatedCost` = sum(proportion × inventoryItem.costPerUnit)

**Recipe List (GET /feed/recipes):**
1. Include `calculatedCost` per recipe (subquery or post-query calculation)

**Recipe Version (POST /feed/recipes/:id/version):**
1. Copy `inventoryItemId` references to new version ingredients

**Production Creation (POST /feed/production):**
1. Remove fuzzy `ilike()` matching — use `inventoryItemId` directly from recipe ingredients
2. Create production materials with guaranteed FK references

**Acceptance Criteria:**
- [x] Recipe CRUD works with `inventoryItemId`
- [x] Fuzzy matching eliminated from production creation
- [x] `calculatedCost` returned on recipe endpoints
- [x] Backward compatible — existing recipes with backfilled data work

---

### Task IMP-A3: Backend — Supplier-Inventory Enforcement (4h)

**Files to modify:**
- `packages/backend/src/validators/feed.ts` — Make `supplierId` required in inventory schemas
- `packages/backend/src/routes/feed.ts` — Add validation, enrich queries

**Inventory Creation (POST /feed/inventory):**
1. Require `supplierId` in validator
2. Validate supplier exists and is active
3. Return supplier name in response

**Inventory List (GET /feed/inventory):**
1. Left join to `suppliers` table
2. Return `supplierName` per inventory item

**Supplier Detail (GET /feed/suppliers/:id):**
1. Add query to return associated inventory items count
2. New endpoint: `GET /feed/suppliers/:id/inventory` — list inventory items for supplier

**Supplier Soft-Delete (DELETE /feed/suppliers/:id):**
1. Check for active inventory items referencing this supplier
2. If found: return 409 Conflict with list of items, require re-assignment first

**Acceptance Criteria:**
- [x] New inventory items require valid active supplier
- [x] Inventory list shows supplier names
- [x] Supplier cannot be deleted with active inventory
- [x] Existing inventory items still work (backfill any missing suppliers)

---

### Task IMP-A4: Frontend — Recipe Form with Inventory Dropdown (8h)

**Files to modify:**
- `packages/frontend/src/pages/FeedPage.tsx` — Recipe create/edit dialogs
- `packages/frontend/src/hooks/useFeed.ts` — Update mutation payloads

**Recipe Create Dialog:**
1. Replace free-text ingredient name input with inventory item dropdown/combobox
2. Dropdown options: fetch from `GET /feed/inventory` (shows: ingredientName, supplier, costPerUnit, unit)
3. On select: auto-fill `unit` from inventory item, display costPerUnit for reference
4. Proportion field remains manual input
5. Show live calculated cost as user adds ingredients

**Recipe Edit Dialog:**
1. Pre-select inventory items from existing recipe ingredients
2. Same dropdown behavior as create

**Inventory Create/Edit Dialog:**
1. Change `supplierId` from optional input to required supplier dropdown
2. Fetch suppliers from `GET /feed/suppliers`
3. Show supplier name, not ID

**Inventory List Table:**
1. Add "Supplier" column showing supplier name

**Acceptance Criteria:**
- [x] Recipe ingredients selected from inventory dropdown (no free text)
- [x] Live cost calculation shown during recipe creation
- [x] Inventory form requires supplier selection
- [x] Inventory list shows supplier names

---

### Task IMP-A5: Backend & Frontend Tests — Data Integrity (6h)

**Files to modify:**
- `packages/backend/src/__tests__/feed.test.ts` — Add/update tests

**New Test Cases:**
1. Recipe creation with valid `inventoryItemId` → success
2. Recipe creation with invalid `inventoryItemId` → 400 error
3. Recipe detail returns `calculatedCost`
4. Production creation uses FK (no fuzzy match) → materials have correct inventory IDs
5. Inventory creation without `supplierId` → 400 error
6. Inventory creation with inactive supplier → 400 error
7. Supplier delete with active inventory → 409 error
8. Supplier delete with no inventory → success

**Acceptance Criteria:**
- [x] All new tests pass
- [x] All existing 213 tests still pass
- [x] No regressions

---

### Task IMP-A6: Shared Types Update (2h)

**Files to modify:**
- `packages/shared/src/types/feed.ts` — Update interfaces

**Changes:**
1. Add `inventoryItemId` to `FeedRecipeIngredient` interface
2. Add `calculatedCost` to `FeedRecipe` interface
3. Add `supplierName` to `FeedInventoryItem` interface
4. Add `PurchaseOrder`, `PurchaseOrderItem` interfaces (for IMP-B)
5. Rebuild shared package

**Acceptance Criteria:**
- [x] Types compile
- [x] Frontend and backend consume updated types
- [x] No type errors across packages

---

## Sprint IMP-B: Purchase Orders & Advanced Features (~40 hours)

### Task IMP-B1: Database Migration — Purchase Orders (4h)

**Files to modify:**
- `packages/backend/src/db/schema/feed.ts` — Add `purchaseOrders` + `purchaseOrderItems` tables
- New migration file: `0005_purchase_orders.sql`

**Schema:**
```
purchaseOrders:
  id, orderCode (unique, auto: PO-YYYYMMDD-XXX), supplierId FK, orderDate,
  expectedDeliveryDate, actualDeliveryDate, status (draft/submitted/partially_received/received/cancelled),
  totalCost (decimal), notes, createdBy FK → users, timestamps

purchaseOrderItems:
  id, purchaseOrderId FK → purchaseOrders (cascade), inventoryItemId FK → feedInventory,
  orderedQuantity, unitPrice, receivedQuantity (default 0), unit, notes
```

**Indexes:**
- `purchaseOrders`: status, supplierId, orderDate
- `purchaseOrderItems`: purchaseOrderId, inventoryItemId

**Acceptance Criteria:**
- [x] Migration runs clean
- [x] Tables created with proper FKs and indexes
- [x] All existing tests pass

---

### Task IMP-B2: Backend — Purchase Order CRUD + Receive (12h)

**Files to modify:**
- `packages/backend/src/routes/feed.ts` — Add PO endpoints
- `packages/backend/src/validators/feed.ts` — Add PO validation schemas

**Endpoints:**

**GET /feed/purchase-orders**
- List with pagination, search (orderCode), filter by status, supplierId, dateRange
- Join supplier name
- Return total count for pagination

**GET /feed/purchase-orders/:id**
- Detail with line items (join inventory item names)
- Calculate received percentage per item

**POST /feed/purchase-orders**
- Create with supplierId + items array
- Auto-generate orderCode: `PO-YYYYMMDD-XXX`
- Validate: supplier active, each inventoryItemId exists
- Calculate totalCost from items
- Status: `draft`

**PUT /feed/purchase-orders/:id**
- Update header + items (draft only)
- Recalculate totalCost

**DELETE /feed/purchase-orders/:id**
- Delete (draft only, no received items)

**PUT /feed/purchase-orders/:id/status**
- Submit: draft → submitted
- Cancel: draft/submitted → cancelled (block if any items received)

**POST /feed/purchase-orders/:id/receive**
- Accept: `items: [{ itemId, receivedQuantity }]`
- Validate: PO status is `submitted` or `partially_received`
- Per item: increment receivedQuantity (total cannot exceed orderedQuantity unless overridden)
- Per item: auto-restock inventory (increment quantity, update lastRestockDate, update costPerUnit from unitPrice)
- Per item: create audit trail entry (changeType: `purchase_receive`, referenceType: `purchase_order`, referenceId: PO id)
- Auto-transition status: partially_received or received based on all items fully received
- Update actualDeliveryDate on first receive

**GET /feed/suppliers/:id/purchase-orders**
- List POs for a specific supplier

**Acceptance Criteria:**
- [x] Full PO lifecycle works (create → submit → receive → complete)
- [x] Partial receiving works correctly
- [x] Inventory auto-restocked on receive
- [x] Audit trail entries created for PO receives
- [x] Status transitions enforced

---

### Task IMP-B3: Frontend — Purchase Orders Tab & UI (10h)

**Files to modify:**
- `packages/frontend/src/pages/FeedPage.tsx` — Add Purchase Orders tab
- `packages/frontend/src/hooks/useFeed.ts` — Add PO hooks

**Purchase Orders Tab:**
1. Table: orderCode, supplier, orderDate, expectedDelivery, totalCost, status, actions
2. Status badge colors: draft=gray, submitted=blue, partially_received=yellow, received=green, cancelled=red
3. Filter by status (tab pills), search by orderCode, date range picker
4. Create PO button → dialog

**Create PO Dialog:**
1. Select supplier (dropdown)
2. On supplier select: show available inventory items from that supplier
3. Add line items: select inventory item, enter quantity and unit price
4. Running total displayed
5. Save as draft, or save and submit

**PO Detail (dialog or page):**
1. Header: orderCode, supplier info, dates, status, total cost
2. Line items table: ingredient, ordered qty, unit price, received qty, remaining, receive button
3. Receive dialog per item: enter received quantity
4. Bulk receive button: receive all remaining
5. Status workflow buttons: Submit (draft→submitted), Cancel

**Reorder Suggestions Enhancement:**
1. "Create PO" button per suggestion
2. Pre-fills: supplier from inventory item, inventory item + suggested quantity

**Hooks:**
- `usePurchaseOrders(filters)` — list
- `usePurchaseOrder(id)` — detail
- `useCreatePurchaseOrder()` — mutation
- `useUpdatePurchaseOrder()` — mutation
- `useDeletePurchaseOrder()` — mutation
- `useUpdatePurchaseOrderStatus()` — mutation
- `useReceivePurchaseOrder()` — mutation
- `useSupplierPurchaseOrders(supplierId)` — list for supplier

**Acceptance Criteria:**
- [x] Full PO workflow accessible from FeedPage
- [x] Create, submit, receive, cancel all work
- [x] Reorder suggestions have "Create PO" integration
- [x] Responsive design (mobile-friendly)

---

### Task IMP-B4: Dynamic Recipe Cost & Cost Optimization (6h)

**Files to modify:**
- `packages/backend/src/routes/feed.ts` — Update cost calculation logic
- `packages/frontend/src/pages/FeedPage.tsx` — Display cost comparison

**Backend:**
1. Recipe detail: compute `calculatedCost` = Σ(ingredient.proportion × inventory.costPerUnit)
2. Recipe list: include `calculatedCost` per recipe
3. Cost optimization endpoint: compare each recipe's ingredients against current inventory prices
4. Return: per recipe — manual cost, calculated cost, delta, savings potential
5. Production cost: on completion, calculate from actual material costPerUnit at that moment

**Frontend:**
1. Recipe list: show both costs, highlight delta if > 10%
2. Recipe detail: cost breakdown table (ingredient → proportion × costPerUnit = line cost)
3. Cost optimization tab: savings suggestions per recipe with ingredient-level detail

**Acceptance Criteria:**
- [x] Dynamic cost calculation matches sum of ingredient costs
- [x] Frontend shows cost comparison
- [x] Production cost reflects actual material prices

---

### Task IMP-B5: Demand-Aware Reorder Suggestions (4h)

**Files to modify:**
- `packages/backend/src/routes/feed.ts` — Update reorder suggestions endpoint

**Logic:**
1. Fetch all `planned` + `in_progress` production batches with scheduledDate in next 14 days
2. For each: get recipe → ingredients → inventoryItemId + proportion × plannedQuantity
3. Aggregate demand per inventory item
4. New formula: `suggestedOrderQty = max(reorderLevel, currentQty + upcomingDemand × 1.2) - currentQty`
5. Include demand breakdown in response: `upcomingDemand: { productionBatchCode, recipeName, neededQuantity, scheduledDate }[]`
6. Flag items with no supplier as "No supplier — assign before ordering"

**Frontend:**
1. Reorder suggestion card shows: current qty, reorder level, upcoming demand, suggested order
2. Expandable demand breakdown (which production batches)
3. "Create PO" button (from IMP-B3)

**Acceptance Criteria:**
- [x] Reorder suggestions factor in production demand
- [x] Demand breakdown is accurate and clear
- [x] Items without supplier are flagged

---

### Task IMP-B6: Enhanced Audit Trail + Testing (4h)

**Files to modify:**
- `packages/backend/src/routes/feed.ts` — Update audit trail creation points
- `packages/backend/src/__tests__/feed.test.ts` — Add tests for all improvements

**Audit Trail Enhancements:**
1. All production deductions include `referenceType: 'production_batch'`, `referenceId`
2. All PO receives include `referenceType: 'purchase_order'`, `referenceId`, `notes: PO code`
3. All manual adjustments require `notes`
4. Distribution deductions include `referenceType: 'distribution'`, `referenceId`
5. Filter endpoint: allow `?changeType=X&referenceType=Y`

**Frontend Audit Trail:**
1. Clickable reference links (production batch → production detail, PO → PO detail)
2. Notes column in audit trail table
3. Filter dropdowns for changeType and referenceType

**New Test Cases (Sprint IMP-B):**
1. PO creation → success
2. PO creation without items → 400
3. PO creation with invalid supplier → 400
4. PO submit → status changes
5. PO receive → inventory restocked + audit trail created
6. PO partial receive → status: partially_received
7. PO full receive → status: received
8. PO cancel with received items → 409
9. Demand-aware reorder includes production batch demand
10. Recipe calculatedCost matches expected value
11. Audit trail filter by changeType works

**Acceptance Criteria:**
- [x] All audit trail entries have proper context
- [x] Filter works
- [x] Frontend links work
- [x] All new + existing tests pass

---

## Implementation Order (Dependency Chain)

```
IMP-A6 (Types)     ─┐
                     ├─→ IMP-A1 (Migration) ─→ IMP-A2 (Recipe FK) ──┐
                     │                                                 ├─→ IMP-A5 (Tests Sprint A)
                     └─→ IMP-A3 (Supplier) ─→ IMP-A4 (Frontend)  ──┘

IMP-B1 (PO Migration) ─→ IMP-B2 (PO Backend) ─→ IMP-B3 (PO Frontend) ─┐
                                                                          ├─→ IMP-B6 (Audit + Tests)
IMP-B4 (Dynamic Cost) ─→ IMP-B5 (Demand Reorder) ─────────────────────┘
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Backfill migration fails (unmatched ingredients) | Log unmatched rows; provide manual mapping script |
| Existing recipes break after schema change | Keep `ingredientName` as denormalized field; FK nullable initially |
| PO receiving creates double-count with manual restock | Deprecate manual restock endpoint or add "source" flag |
| Performance of cost calculation on recipe list | Cache calculatedCost; recalculate on ingredient/price change |
| Large number of PO line items | Paginate line items on PO detail endpoint |

---

## Success Metrics

- Zero fuzzy matching in production material creation
- 100% of inventory items have valid supplier references
- Purchase order → receive → inventory restock fully automated
- Recipe cost within 5% of actual production cost
- Reorder suggestions correctly predict demand from upcoming production
- All audit trail entries traceable to source entity

---

## Sprint IMP-C: UX Improvements (~4h) — COMPLETE

### Task IMP-C1: Feed Tab Reorder (1h)
- Reorder `<TabsTrigger>` elements: Inventory → Recipes → Production → Distribution → Purchase Orders → Suppliers
- Change `defaultValue` from "suppliers" to "inventory"
- File: `packages/frontend/src/pages/FeedPage.tsx`

### Task IMP-C2: Specific Form Validation Errors (3h)
- Create `parseApiError(error, fallbackMessage)` utility in `packages/frontend/src/lib/api.ts`
- Handles Zod `VALIDATION_ERROR` responses with `details.fieldErrors` → shows each field error as individual toast
- Handles business logic errors (e.g., "Supplier name already exists") → shows specific error message
- Falls back to generic message if no specific error available
- Updated all 18 catch blocks in FeedPage.tsx to use `parseApiError` instead of generic `toast.error`
- Affected: Supplier, Recipe, Inventory, Production, Distribution, PO handlers

---

## Sprint IMP-E: Quantity Impact Previews (~4h) — COMPLETE

### Task IMP-E1: Frontend — Pre-Action Quantity Indicators (4h)
- File: `packages/frontend/src/pages/FeedPage.tsx`
- Add reusable quantity preview formatting helper for consistent display.
- Inventory edit dialog: show `current → new` quantity and signed delta before save.
- Restock dialog: show `current → projected` quantity and additive delta before restock.
- Complete production dialog: show per-material deduction with `available → projected` quantity.
- Distribution dialog (when linked to a production batch): show `available for distribution before → after`.
- Purchase order receive dialog: show per-line `received before → after` and stock `before → after` preview where inventory snapshot is available.

**Acceptance Criteria:**
- [x] All quantity-changing feed flows show impact preview before submission.
- [x] Users can see both absolute before/after values and signed delta.
- [x] Negative projections are visibly highlighted in the dialog.
- [x] Frontend build compiles after changes.
- [x] Existing frontend lint baseline remains unchanged (project has unrelated pre-existing lint errors).
