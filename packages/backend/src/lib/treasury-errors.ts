const TREASURY_TABLE_NAMES = [
  'finance_accounts',
  'treasury_transactions',
  'treasury_transaction_entries',
  'treasury_transaction_links',
  'petty_cash_allocations',
  'petty_cash_expenses',
  'buyer_receipt_lines',
  'payroll',
] as const;

export function isMissingTreasuryTable(error: unknown): boolean {
  const maybe = error as { code?: string; message?: string };
  const message = String(maybe?.message ?? '');
  return maybe?.code === '42P01' && TREASURY_TABLE_NAMES.some((tableName) => message.includes(tableName));
}

export function isMissingTreasuryColumn(error: unknown): boolean {
  const maybe = error as { code?: string; message?: string };
  const message = String(maybe?.message ?? '');
  return maybe?.code === '42703' && (
    message.includes('finance_account_id')
    || message.includes('treasury_transaction_id')
    || message.includes('treasury_reversal_transaction_id')
    || message.includes('source_finance_account_id')
    || message.includes('petty_cash_account_id')
  );
}

export function sendTreasurySchemaNotReady(res: { status: (code: number) => { json: (body: unknown) => void } }) {
  res.status(503).json({
    success: false,
    error: 'Treasury schema is not ready. Run backend migrations and retry.',
    code: 'TREASURY_SCHEMA_NOT_READY',
    statusCode: 503,
    timestamp: new Date().toISOString(),
  });
}
