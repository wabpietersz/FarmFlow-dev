import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';

export type AppNotification = {
  id: number;
  notificationType: string;
  title: string | null;
  message: string;
  link: string | null;
  tone: 'info' | 'warning' | 'danger';
  isRead: boolean;
  createdAt: string;
};

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGet<{ items: AppNotification[]; unread: number }>('/notifications'),
    refetchInterval: 2 * 60 * 1000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id?: number) => apiPost(id ? `/notifications/${id}/read` : '/notifications/read-all', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
