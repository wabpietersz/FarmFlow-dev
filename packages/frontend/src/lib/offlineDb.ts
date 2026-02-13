/**
 * IndexedDB offline storage layer using idb library.
 * Provides structured storage for:
 * - Cached API responses (query cache persistence)
 * - Offline mutation queue (form submissions while offline)
 * - User session data
 */
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'farmflow-offline';
const DB_VERSION = 1;

// Store names
export const STORES = {
  QUERY_CACHE: 'queryCache',
  MUTATION_QUEUE: 'mutationQueue',
  SESSION: 'session',
} as const;

export interface CachedQuery {
  key: string;
  data: unknown;
  timestamp: number;
  expiresAt: number;
}

export interface QueuedMutation {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body: unknown;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
  description: string; // Human-readable description for UI
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Query cache store
        if (!db.objectStoreNames.contains(STORES.QUERY_CACHE)) {
          const queryStore = db.createObjectStore(STORES.QUERY_CACHE, { keyPath: 'key' });
          queryStore.createIndex('expiresAt', 'expiresAt');
        }

        // Mutation queue store
        if (!db.objectStoreNames.contains(STORES.MUTATION_QUEUE)) {
          const mutationStore = db.createObjectStore(STORES.MUTATION_QUEUE, { keyPath: 'id' });
          mutationStore.createIndex('status', 'status');
          mutationStore.createIndex('timestamp', 'timestamp');
        }

        // Session store (user data, permissions)
        if (!db.objectStoreNames.contains(STORES.SESSION)) {
          db.createObjectStore(STORES.SESSION, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// ==================== Query Cache Operations ====================

export async function getCachedQuery(key: string): Promise<unknown | null> {
  const db = await getDb();
  const cached = await db.get(STORES.QUERY_CACHE, key) as CachedQuery | undefined;
  if (!cached) return null;

  // Check expiration
  if (Date.now() > cached.expiresAt) {
    await db.delete(STORES.QUERY_CACHE, key);
    return null;
  }

  return cached.data;
}

export async function setCachedQuery(
  key: string,
  data: unknown,
  ttlMs: number = 30 * 60 * 1000, // 30 min default
): Promise<void> {
  const db = await getDb();
  const entry: CachedQuery = {
    key,
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };
  await db.put(STORES.QUERY_CACHE, entry);
}

export async function clearExpiredCache(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORES.QUERY_CACHE, 'readwrite');
  const store = tx.objectStore(STORES.QUERY_CACHE);
  const index = store.index('expiresAt');
  const now = Date.now();

  let cursor = await index.openCursor(IDBKeyRange.upperBound(now));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

export async function clearQueryCache(): Promise<void> {
  const db = await getDb();
  await db.clear(STORES.QUERY_CACHE);
}

// ==================== Mutation Queue Operations ====================

export async function addToMutationQueue(mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
  const db = await getDb();
  const id = `mutation-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const entry: QueuedMutation = {
    ...mutation,
    id,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  };
  await db.put(STORES.MUTATION_QUEUE, entry);
  return id;
}

export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const db = await getDb();
  const tx = db.transaction(STORES.MUTATION_QUEUE, 'readonly');
  const store = tx.objectStore(STORES.MUTATION_QUEUE);
  const index = store.index('status');
  const pending = await index.getAll('pending');
  const failed = await index.getAll('failed');
  await tx.done;

  // Return pending first, then failed (sorted by timestamp)
  return [...pending, ...failed].sort((a, b) => a.timestamp - b.timestamp);
}

export async function getAllMutations(): Promise<QueuedMutation[]> {
  const db = await getDb();
  const all = await db.getAll(STORES.MUTATION_QUEUE) as QueuedMutation[];
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

export async function updateMutationStatus(
  id: string,
  status: QueuedMutation['status'],
  error?: string,
): Promise<void> {
  const db = await getDb();
  const entry = await db.get(STORES.MUTATION_QUEUE, id) as QueuedMutation | undefined;
  if (entry) {
    entry.status = status;
    if (status === 'failed') {
      entry.retryCount += 1;
      entry.error = error;
    }
    if (status === 'pending') {
      entry.error = undefined;
    }
    await db.put(STORES.MUTATION_QUEUE, entry);
  }
}

export async function removeMutation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORES.MUTATION_QUEUE, id);
}

export async function clearMutationQueue(): Promise<void> {
  const db = await getDb();
  await db.clear(STORES.MUTATION_QUEUE);
}

export async function getMutationQueueCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORES.MUTATION_QUEUE);
}

// ==================== Session Operations ====================

export async function setSessionData(key: string, data: unknown): Promise<void> {
  const db = await getDb();
  await db.put(STORES.SESSION, { key, data, timestamp: Date.now() });
}

export async function getSessionData<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const entry = await db.get(STORES.SESSION, key) as { key: string; data: T; timestamp: number } | undefined;
  return entry?.data ?? null;
}

export async function clearSession(): Promise<void> {
  const db = await getDb();
  await db.clear(STORES.SESSION);
}
