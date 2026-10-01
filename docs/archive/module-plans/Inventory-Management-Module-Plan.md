# FarmFlow - Inventory Management Module Plan

**Version:** 0.1
**Date:** March 16, 2026
**Status:** In Progress
**Scope:** Functional requirements, data model, UX flow, and implementation roadmap for expanding feed inventory into full farm inventory management

---

## 1. Objective

FarmFlow currently treats inventory as a feed-only concern. This change introduces a dedicated **Inventory Management** module that owns:

- suppliers
- purchase orders
- all inventory items
- inventory item types/basic data
- batch-level inventory consumption and cost tracking

The **Feed** module remains focused on feed operations only:

- feed inventory
- recipes
- production
- distribution

Feed inventory continues to appear inside Feed Management, but it becomes a filtered view over the broader inventory domain.

---

## 2. Target Operating Model

### Inventory Management module

- Shows all inventory across the business, including feed and non-feed items
- Owns supplier maintenance, purchase order lifecycle, inventory receiving, and inventory item master data
- Provides batch allocation/consumption actions for non-feed inventory
- Provides inventory basic data maintenance for item types

### Feed module

- Shows only inventory items whose type category is `feed`
- Uses feed inventory as the material source for recipes and production
- No longer owns suppliers or purchase orders as primary workflows

### Batch management and reporting

- Every batch must be able to show non-feed inventory consumed against it
- Batch costs must include:
  - feed cost
  - labor cost
  - non-feed inventory cost
- Reports must expose inventory consumption and cost by batch

---

## 3. Core Functional Requirements

### IMP-INV-1: New Inventory Management module

- FR-INV-1.1: Add a new navigation entry for `Inventory`
- FR-INV-1.2: Add tabs for `Inventory`, `Purchase Orders`, `Suppliers`, and `Basic Data`
- FR-INV-1.3: `Feed > Inventory` must remain available but display only `feed` items
- FR-INV-1.4: Inventory lists in the new module must show all item types by default with filtering

### IMP-INV-2: Inventory item types/basic data

- FR-INV-2.1: Create an `inventory_item_types` basic-data table
- FR-INV-2.2: Each type must include:
  - display name
  - unique code
  - category
  - default unit
  - whether batch allocation is allowed
  - whether the item is feed-facing
  - active/inactive status
  - description
- FR-INV-2.3: Inventory items must reference an inventory item type
- FR-INV-2.4: Feed workflows may only use item types flagged as `isFeed = true`

### IMP-INV-3: Generalized inventory items

- FR-INV-3.1: Extend inventory items so they work for both feed and non-feed stock
- FR-INV-3.2: Inventory item detail must include:
  - type
  - supplier
  - current quantity
  - weighted cost
  - lot availability
  - batch allocations/consumptions
- FR-INV-3.3: Inventory detail must allow later allocation of remaining stock into additional batches
- FR-INV-3.4: Feed item detail in the Feed module remains read/write for feed-specific operations

### IMP-INV-4: Purchase order receiving with batch allocation

- FR-INV-4.1: When receiving a PO for non-feed inventory, the receive flow must allow the user to:
  - receive to stock only
  - receive and allocate part of the received quantity to one batch
  - receive and allocate the full quantity to one batch
- FR-INV-4.2: Allocation must be captured against the received lot so cost remains traceable
- FR-INV-4.3: Allocation cannot exceed the quantity received for that line in that action
- FR-INV-4.4: Remaining received quantity stays in available inventory for future allocations
- FR-INV-4.5: Feed PO receipts do not require batch allocation in the receive flow

### IMP-INV-5: Batch inventory consumption tracking

- FR-INV-5.1: Create explicit batch inventory consumption records for non-feed items
- FR-INV-5.2: Consumption records must store:
  - batch
  - inventory item
  - lot
  - quantity
  - unit cost at consumption
  - line cost
  - consumption date
  - source reference
  - notes
- FR-INV-5.3: Inventory consumption must reduce remaining lot quantity and overall inventory quantity
- FR-INV-5.4: Batch detail view must show all recorded inventory consumptions
- FR-INV-5.5: Batch profitability/reporting must include non-feed inventory cost separately and in total

### IMP-INV-6: Reporting

- FR-INV-6.1: Batch profitability report must add `inventoryCost`
- FR-INV-6.2: Add a batch inventory consumption report or report tab with:
  - batch
  - inventory item
  - type
  - quantity consumed
  - total cost
- FR-INV-6.3: Batch detail summary must display the total non-feed inventory cost

---

## 4. Business Rules

- BR-INV-1: Inventory item type is mandatory for every inventory item
- BR-INV-2: Only item types with `isFeed = true` can appear in feed recipes and feed production
- BR-INV-3: Only item types with `allowsBatchAllocation = true` can be consumed directly against batches
- BR-INV-4: For this phase, allocation into a batch is treated as immediate batch consumption
- BR-INV-5: Cost for batch inventory consumption must come from the exact consumed lot where available
- BR-INV-6: Inventory quantity must never go negative
- BR-INV-7: Feed inventory remains visible in both modules, but non-feed inventory is only visible in Inventory Management

---

## 5. Data Model Changes

### New tables

| Table | Purpose |
|-------|---------|
| `inventory_item_types` | Basic data for inventory categories and behavior flags |
| `batch_inventory_consumptions` | Non-feed inventory consumed by a batch with cost traceability |

### Modified tables

| Table | Change |
|-------|--------|
| `feed_inventory` | Generalize existing inventory store with `itemTypeId`, SKU/basic metadata, and feed visibility flags derived from type |
| `purchase_order_items` | Support item-type-aware receiving and post-receipt batch allocation |
| `inventory_audit_trail` | Add new reference usage for batch inventory consumption |

### Intentional compatibility decision

The physical `feed_inventory` table is retained in this phase to avoid breaking existing feed production flows. It becomes the system-wide stock table until a later table rename/migration is justified.

---

## 6. API Changes

### New inventory management routes

- `GET /api/inventory/item-types`
- `POST /api/inventory/item-types`
- `PUT /api/inventory/item-types/:id`
- `GET /api/inventory/items`
- `GET /api/inventory/items/:id`
- `POST /api/inventory/items`
- `PUT /api/inventory/items/:id`
- `POST /api/inventory/items/:id/consume`
- `GET /api/inventory/purchase-orders`
- `GET /api/inventory/purchase-orders/:id`
- `POST /api/inventory/purchase-orders`
- `PUT /api/inventory/purchase-orders/:id`
- `PUT /api/inventory/purchase-orders/:id/status`
- `POST /api/inventory/purchase-orders/:id/receive`
- `GET /api/inventory/suppliers`
- `POST /api/inventory/suppliers`
- `PUT /api/inventory/suppliers/:id`

### Feed route behavior changes

- `GET /api/feed/inventory` returns only feed-class inventory
- recipe and production endpoints validate that referenced inventory items belong to feed item types

### Batch/reporting route changes

- `GET /api/batches/:id` returns batch inventory consumption summary and detailed lines
- `GET /api/reports/batch-profitability` returns `inventoryCost`
- `GET /api/reports/batch-inventory-consumption` returns per-batch inventory usage detail

---

## 7. UX Notes

### Inventory Management

- `Inventory` tab: all-item table, filters, detail view, consume-to-batch action
- `Purchase Orders` tab: creation, submission, receive flow, allocation-on-receive
- `Suppliers` tab: supplier master data
- `Basic Data` tab: item types table

### Feed

- Tabs become `Inventory`, `Recipes`, `Production`, `Distribution`
- Supplier and purchase order maintenance shift to Inventory Management

### Batch detail

- Add `Inventory Consumption` section showing:
  - item name
  - type
  - quantity
  - unit cost
  - line cost
  - date
  - notes/reference

---

## 8. Implementation Phases

### Phase 1

- Add inventory item types
- Generalize inventory items
- Add dedicated inventory management page and route
- Filter feed inventory view to feed-only items

### Phase 2

- Add batch inventory consumption table and APIs
- Add PO receive allocation for non-feed items
- Add item detail consumption workflow

### Phase 3

- Extend batch detail and profitability reporting
- Add dedicated inventory consumption reporting

---

## 9. Acceptance Criteria

- [ ] New Inventory Management module exists and is reachable from navigation
- [ ] Suppliers and purchase orders are managed from Inventory Management
- [ ] Feed module shows only feed inventory
- [ ] Inventory item types can be maintained from Basic Data
- [ ] Non-feed PO receiving supports immediate batch allocation
- [ ] Remaining stock can later be consumed from inventory detail into batches
- [ ] Batch detail shows consumed non-feed inventory with cost
- [ ] Batch profitability includes non-feed inventory cost
- [ ] Existing feed recipe, production, and distribution flows still work
