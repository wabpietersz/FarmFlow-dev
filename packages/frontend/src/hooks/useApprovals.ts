import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';

export type InboxItem = { key: string; kind: string; title: string; detail: string; amount: number | null; count: number; href: string };
export type ApprovalRequest = {
  id: number;
  entityType: 'purchase_order' | 'money_out';
  entityId: number;
  amount: string;
  summary: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: number;
  requestedByName: string;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
};
export type ApprovalLimits = { purchaseOrder: number | null; moneyOut: number | null };

export function useApprovalInbox() {
  return useQuery({
    queryKey: ['approvals', 'inbox'],
    queryFn: () => apiGet<{ items: InboxItem[]; total: number; canDecide: boolean }>('/approvals/inbox'),
    refetchInterval: 2 * 60 * 1000,
  });
}

export function useApprovalRequests(status = 'pending') {
  return useQuery({ queryKey: ['approvals', 'requests', status], queryFn: () => apiGet<ApprovalRequest[]>(`/approvals/requests?status=${status}`) });
}

export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; decision: 'approved' | 'rejected'; note?: string | null }) => apiPost(`/approvals/requests/${id}/decide`, data),
    onSuccess: () => {
      for (const key of ['approvals', 'treasury', 'inventory-management', 'finance', 'dashboard', 'notifications']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useApprovalLimits() {
  return useQuery({ queryKey: ['approvals', 'limits'], queryFn: () => apiGet<ApprovalLimits>('/approvals/limits') });
}

export function useSaveApprovalLimits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (limits: ApprovalLimits) => apiPut<ApprovalLimits>('/approvals/limits', limits),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvals'] }),
  });
}
