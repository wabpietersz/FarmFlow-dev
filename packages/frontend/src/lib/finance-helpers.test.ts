import { describe, expect, it } from 'vitest';
import { toCsv } from './generatePayslips';
import { readCreditBlock } from '@/components/sales/CreditLimitDialog';
import { presetRanges, monthLabel } from '@/components/finance/ReportBits';
import { shouldPersistQuery } from './queryPersister';

describe('CSV export', () => {
  it('quotes values with commas, quotes and new lines', () => {
    expect(toCsv(['Name', 'Note'], [['Perera, A', 'Said "hi"'], ['B', 'line1\nline2'], [null, 5]]))
      .toBe('Name,Note\r\n"Perera, A","Said ""hi"""\r\nB,"line1\nline2"\r\n,5');
  });
});

describe('credit limit errors', () => {
  it('recognises the API’s credit-limit block and whether the user may override', () => {
    const error = { response: { data: { code: 'CREDIT_LIMIT_EXCEEDED', error: 'Afflan would owe Rs 160,000', canOverride: true } } };
    expect(readCreditBlock(error)).toEqual({ message: 'Afflan would owe Rs 160,000', canOverride: true });
    expect(readCreditBlock({ response: { data: { code: 'OTHER' } } })).toBeNull();
    expect(readCreditBlock(new Error('network'))).toBeNull();
  });
});

describe('report periods', () => {
  it('offers ranges that end today and never start after they end', () => {
    const today = new Date().toISOString().slice(0, 10);
    const ranges = presetRanges();
    expect(ranges.map((r) => r.key)).toEqual(['month', 'last-month', 'quarter', 'year', '12m']);
    for (const { range } of ranges) expect(range.from <= range.to).toBe(true);
    expect(ranges.find((r) => r.key === 'year')!.range).toEqual({ from: `${today.slice(0, 4)}-01-01`, to: today });
    expect(ranges.find((r) => r.key === 'last-month')!.range.to < `${today.slice(0, 7)}-01`).toBe(true);
  });

  it('labels months short', () => {
    expect(monthLabel('2026-09')).toBe('Sept 26');
  });
});

describe('offline cache', () => {
  it('never persists sign-in, users, settings or the offline queue itself', () => {
    for (const key of ['auth', 'users', 'settings', 'offline-queue']) expect(shouldPersistQuery([key])).toBe(false);
    expect(shouldPersistQuery(['sales', { page: 1 }])).toBe(true);
  });
});
