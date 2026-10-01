/**
 * Offline-aware hooks for the FarmFlow application.
 * Provides:
 * - useOnlineStatus: reactive online/offline state
 * - useOfflineMutationQueue: view and manage queued mutations
 * - useOfflineMutation: submit mutations with offline queueing
 */
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queueMutation, retryMutation, discardMutation } from '@/lib/offlineSync';
import { getAllMutations, getMutationQueueCount, type QueuedMutation } from '@/lib/offlineDb';

/**
 * Hook that returns the current online/offline status.
 * Updates reactively when connectivity changes.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Hook to view and manage the offline mutation queue.
 */
export function useOfflineMutationQueue() {
  const queryClient = useQueryClient();

  // The queue lives in IndexedDB; poll it every 5 s and right after the connection changes
  const queue = useQuery({
    queryKey: ['offline-queue'],
    queryFn: async () => ({ mutations: await getAllMutations(), count: await getMutationQueueCount() }),
    refetchInterval: 5000,
    networkMode: 'always',
  });
  const mutations: QueuedMutation[] = queue.data?.mutations ?? [];
  const count = queue.data?.count ?? 0;
  const { refetch } = queue;
  const refresh = useCallback(async () => { await refetch(); }, [refetch]);

  useEffect(() => {
    const handleChange = () => {
      setTimeout(() => void refetch(), 1500); // Delay to let sync complete
    };
    window.addEventListener('online', handleChange);
    window.addEventListener('offline', handleChange);
    return () => {
      window.removeEventListener('online', handleChange);
      window.removeEventListener('offline', handleChange);
    };
  }, [refetch]);

  const retry = useCallback(
    async (id: string) => {
      const result = await retryMutation(id);
      if (result) {
        queryClient.invalidateQueries();
      }
      await refresh();
    },
    [refresh, queryClient],
  );

  const discard = useCallback(
    async (id: string) => {
      await discardMutation(id);
      await refresh();
    },
    [refresh],
  );

  return {
    mutations,
    count,
    retry,
    discard,
    refresh,
    hasPending: mutations.some((m) => m.status === 'pending'),
    hasFailed: mutations.some((m) => m.status === 'failed'),
  };
}

/**
 * Hook providing an offline-aware mutation function.
 * When offline, queues the mutation in IndexedDB.
 * When online, executes immediately.
 */
export function useOfflineMutation() {
  const queryClient = useQueryClient();

  const mutate = useCallback(
    async (params: {
      url: string;
      method: 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      description: string;
      invalidateKeys?: string[];
    }) => {
      const result = await queueMutation({
        url: params.url,
        method: params.method,
        body: params.body,
        description: params.description,
      });

      if (!result.queued && params.invalidateKeys) {
        // Mutation executed successfully, invalidate queries
        for (const key of params.invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }

      return result;
    },
    [queryClient],
  );

  return { mutate };
}
