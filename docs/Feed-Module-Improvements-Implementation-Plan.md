# FarmFlow — Feed Module Improvements: Implementation Plan

**Version:** 1.0
**Date:** February 11, 2026
**Status:** Planned
**Estimated Effort:** ~80 hours (2 improvement sprints)
**Prerequisites:** All existing feed module features complete (Weeks 13-16 done)

---

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
