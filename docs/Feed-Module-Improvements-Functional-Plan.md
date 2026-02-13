# FarmFlow — Feed Module Improvements: Functional Plan

**Version:** 1.0
**Date:** February 11, 2026
**Status:** Planned
**Scope:** Feed supply chain data integrity, purchase orders, and connected flow improvements

---

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
