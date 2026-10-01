import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useResettableState } from './useResettableState';

describe('useResettableState', () => {
  it('keeps edits until the source changes, then starts again from the new source', () => {
    const { result, rerender } = renderHook(({ source }) => useResettableState(source, () => `from ${source}`), { initialProps: { source: 'a' } });
    expect(result.current[0]).toBe('from a');
    act(() => result.current[1]('edited'));
    rerender({ source: 'a' });
    expect(result.current[0]).toBe('edited');
    rerender({ source: 'b' });
    expect(result.current[0]).toBe('from b');
  });
});
