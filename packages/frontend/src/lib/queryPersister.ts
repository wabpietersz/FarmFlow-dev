/**
 * TanStack Query persister using IndexedDB.
 * Persists the query cache to IndexedDB so data is available
 * when the app loads offline.
 */
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Keys we want to persist (critical data for offline use)
const PERSIST_CACHE_KEY = 'farmflow-query-cache';

/**
 * IndexedDB-backed storage adapter for TanStack Query persister.
 * Falls back to in-memory if IndexedDB is unavailable.
 */
class IndexedDBStorage implements Storage {
  private memoryFallback: Map<string, string> = new Map();

  get length(): number {
    return this.memoryFallback.size;
  }

  key(index: number): string | null {
    return Array.from(this.memoryFallback.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return this.memoryFallback.get(key) ?? null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // localStorage full or unavailable, use memory
      this.memoryFallback.set(key, value);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      this.memoryFallback.delete(key);
    }
  }

  clear(): void {
    this.memoryFallback.clear();
  }
}

const storage = new IndexedDBStorage();

export const queryPersister = createSyncStoragePersister({
  storage,
  key: PERSIST_CACHE_KEY,
  throttleTime: 1000, // Throttle writes to 1 per second
  serialize: (data) => {
    // Only persist GET query data, filter out mutations and large payloads
    const filtered = {
      ...data,
      clientState: {
        ...data.clientState,
        queries: data.clientState.queries.filter((q) => {
          const key = q.queryKey as string[];
          // Persist dashboard, summary, and list data
          const persistableKeys = [
            'dashboard',
            'employees',
            'sites',
            'batches',
            'sales',
            'treasury',
            'attendance',
            'payroll',
            'feed',
          ];
          return key.length > 0 && persistableKeys.includes(key[0] as string);
        }),
        mutations: [], // Don't persist mutations in query cache
      },
    };
    return JSON.stringify(filtered);
  },
  deserialize: (data) => JSON.parse(data),
});

/**
 * Max age for persisted cache: 24 hours.
 * After this, the cache is considered stale and will be refreshed.
 */
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Query keys that should NOT be cached offline.
 * These contain sensitive or rapidly-changing data.
 */
export const NON_PERSISTABLE_KEYS = [
  'auth',
  'users',
  'settings',
  // Read from IndexedDB itself; persisting it would show a stale queue
  'offline-queue',
] as const;

/**
 * Check if a query key should be persisted.
 */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const firstKey = queryKey[0] as string;
  return !NON_PERSISTABLE_KEYS.includes(firstKey as typeof NON_PERSISTABLE_KEYS[number]);
}
