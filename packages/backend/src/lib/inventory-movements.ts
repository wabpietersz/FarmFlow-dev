import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { inventoryMovements } from '../db/schema';

type Executor = typeof db | any;

export interface InventoryMovementInput {
  movementType:
    | 'purchase_receive'
    | 'adjustment'
    | 'production_consume'
    | 'production_output'
    | 'distribution_to_batch'
    | 'batch_consume'
    | 'site_consume'
    | 'return'
    | 'wastage'
    | 'transfer'
    | 'transfer_out'
    | 'transfer_in'
    | 'write_off';
  movementDate: string;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: number;
  sourceCodeSnapshot?: string | null;
  inventoryItemId?: number | null;
  inventoryLotId?: number | null;
  purchaseOrderId?: number | null;
  purchaseOrderItemId?: number | null;
  productionBatchId?: number | null;
  productionMaterialId?: number | null;
  feedDistributionId?: number | null;
  batchId?: number | null;
  quantity: number;
  unit: string;
  unitCost?: number | null;
  lineCost?: number | null;
  balanceAfterQuantity?: number | null;
  balanceScope: 'inventory_item' | 'inventory_lot' | 'production_batch' | 'batch';
  notes?: string | null;
  createdBy?: number | null;
}

export async function postInventoryMovement(
  input: InventoryMovementInput,
  executor: Executor = db,
) {
  const [movement] = await executor
    .insert(inventoryMovements)
    .values({
      movementType: input.movementType,
      movementDate: input.movementDate,
      sourceModule: input.sourceModule,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      sourceCodeSnapshot: input.sourceCodeSnapshot ?? null,
      inventoryItemId: input.inventoryItemId ?? null,
      inventoryLotId: input.inventoryLotId ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      purchaseOrderItemId: input.purchaseOrderItemId ?? null,
      productionBatchId: input.productionBatchId ?? null,
      productionMaterialId: input.productionMaterialId ?? null,
      feedDistributionId: input.feedDistributionId ?? null,
      batchId: input.batchId ?? null,
      quantity: input.quantity.toFixed(2),
      unit: input.unit,
      unitCost: input.unitCost != null ? input.unitCost.toFixed(2) : null,
      lineCost: input.lineCost != null ? input.lineCost.toFixed(2) : null,
      balanceAfterQuantity: input.balanceAfterQuantity != null ? input.balanceAfterQuantity.toFixed(2) : null,
      balanceScope: input.balanceScope,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning();

  return movement;
}

export async function getProductionBatchAvailableQuantity(
  productionBatchId: number,
  executor: Executor = db,
) {
  const [row] = await executor
    .select({
      netQuantity: sql<number>`
        COALESCE(SUM(
          CASE
            WHEN ${inventoryMovements.movementType} = 'production_output' THEN ${inventoryMovements.quantity}::numeric
            WHEN ${inventoryMovements.movementType} = 'distribution_to_batch' THEN -ABS(${inventoryMovements.quantity}::numeric)
            ELSE 0
          END
        ), 0)::float
      `,
    })
    .from(inventoryMovements)
    .where(eq(inventoryMovements.productionBatchId, productionBatchId));

  return Math.round((row?.netQuantity ?? 0) * 100) / 100;
}

export async function getLatestMovementForLot(inventoryLotId: number, executor: Executor = db) {
  const [movement] = await executor
    .select()
    .from(inventoryMovements)
    .where(and(eq(inventoryMovements.inventoryLotId, inventoryLotId), eq(inventoryMovements.balanceScope, 'inventory_lot')))
    .orderBy(desc(inventoryMovements.id))
    .limit(1);

  return movement ?? null;
}
