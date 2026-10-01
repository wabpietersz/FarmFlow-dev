import { getTableName, sql, type Column } from 'drizzle-orm';

/**
 * A column written as "table"."column".
 * Drizzle leaves out the table name in single-table queries, so inside a correlated
 * sub-query `${orders.id}` becomes a bare `id` — ambiguous, or silently the sub-query's own id.
 * Use this for every column referenced inside raw SQL sub-queries.
 */
export function qualified(column: Column) {
  return sql.raw(`"${getTableName(column.table)}"."${column.name}"`);
}
