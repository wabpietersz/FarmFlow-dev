import { useState } from 'react';

/**
 * Local, editable state that starts again whenever `sourceKey` changes — e.g. a form that loads
 * from the server and is then edited. Follows React's "adjust state when a prop changes" pattern
 * (state is reset during render, not in an effect, so there is no flash of stale values).
 */
export function useResettableState<T>(sourceKey: string, initial: () => T) {
  const [key, setKey] = useState(sourceKey);
  const [value, setValue] = useState<T>(initial);
  if (key !== sourceKey) {
    setKey(sourceKey);
    setValue(initial());
  }
  return [value, setValue] as const;
}
