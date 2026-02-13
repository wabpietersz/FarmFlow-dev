/**
 * Offline sync manager — handles queueing form submissions
 * when offline and replaying them when connectivity returns.
 *
 * Uses a last-write-wins conflict resolution strategy.
 */
import { toast } from 'sonner';
import {
  addToMutationQueue,
  getPendingMutations,
  updateMutationStatus,
  removeMutation,
  getMutationQueueCount,
  type QueuedMutation,
} from './offlineDb';
import api from './api';

const MAX_RETRIES = 3;
let isSyncing = false;

/**
 * Queue an API mutation to be processed when online.
 * If online, attempts immediately. If offline, stores in IndexedDB.
 */
export async function queueMutation(params: {
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  description: string;
}): Promise<{ queued: boolean; id: string }> {
  const id = await addToMutationQueue({
    url: params.url,
    method: params.method,
    body: params.body,
    description: params.description,
  });

  if (navigator.onLine) {
    // Try to sync immediately
    await syncMutations();
    return { queued: false, id };
  }

  toast.info('Saved offline', {
    description: `"${params.description}" will sync when you're back online.`,
  });

  return { queued: true, id };
}

/**
 * Attempt to sync all pending mutations with the server.
 * Called automatically when connectivity is restored.
 */
export async function syncMutations(): Promise<{ synced: number; failed: number }> {
  if (isSyncing || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const mutations = await getPendingMutations();

    if (mutations.length === 0) {
      return { synced: 0, failed: 0 };
    }

    toast.loading('Syncing offline changes...', { id: 'sync-toast' });

    for (const mutation of mutations) {
      if (mutation.retryCount >= MAX_RETRIES) {
        // Mark as permanently failed after max retries
        await updateMutationStatus(mutation.id, 'failed', 'Max retries exceeded');
        failed++;
        continue;
      }

      try {
        await updateMutationStatus(mutation.id, 'syncing');
        await executeMutation(mutation);
        await removeMutation(mutation.id);
        synced++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await updateMutationStatus(mutation.id, 'failed', errorMessage);
        failed++;
      }
    }

    if (synced > 0 && failed === 0) {
      toast.success(`Synced ${synced} offline change${synced > 1 ? 's' : ''}`, {
        id: 'sync-toast',
      });
    } else if (synced > 0 && failed > 0) {
      toast.warning(`Synced ${synced}, ${failed} failed`, {
        id: 'sync-toast',
        description: 'Some changes could not be synced. Check the sync queue.',
      });
    } else if (failed > 0) {
      toast.error(`${failed} change${failed > 1 ? 's' : ''} failed to sync`, {
        id: 'sync-toast',
        description: 'Will retry automatically.',
      });
    } else {
      toast.dismiss('sync-toast');
    }
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

/**
 * Execute a single queued mutation against the API.
 */
async function executeMutation(mutation: QueuedMutation): Promise<void> {
  switch (mutation.method) {
    case 'POST':
      await api.post(mutation.url, mutation.body);
      break;
    case 'PUT':
      await api.put(mutation.url, mutation.body);
      break;
    case 'DELETE':
      await api.delete(mutation.url);
      break;
  }
}

/**
 * Initialize the online/offline sync listener.
 * Call this once at app startup.
 */
export function initOfflineSync(): () => void {
  const handleOnline = () => {
    // Small delay to let network stabilize
    setTimeout(() => {
      syncMutations();
    }, 1000);
  };

  window.addEventListener('online', handleOnline);

  // Run initial sync if we're online and have pending items
  if (navigator.onLine) {
    getMutationQueueCount().then((count) => {
      if (count > 0) {
        syncMutations();
      }
    });
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

/**
 * Retry a specific failed mutation.
 */
export async function retryMutation(id: string): Promise<boolean> {
  await updateMutationStatus(id, 'pending');
  const result = await syncMutations();
  return result.synced > 0;
}

/**
 * Discard a failed mutation from the queue.
 */
export async function discardMutation(id: string): Promise<void> {
  await removeMutation(id);
  toast.info('Offline change discarded');
}
