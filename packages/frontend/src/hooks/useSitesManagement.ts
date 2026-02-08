import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import type { Site, Cage } from '@farmflow/shared';

interface SiteWithStats extends Site {
  totalCages: number;
  activeBatches: number;
}

interface CageWithBatch extends Cage {
  currentBatch: {
    id: number;
    batchCode: string;
    chicksPlaced: number;
    status: string;
    placementDate: string;
  } | null;
}

interface SiteDetail {
  site: Site;
  cages: CageWithBatch[];
}

export function useSitesManagement() {
  return useQuery({
    queryKey: ['sites', 'management'],
    queryFn: () => apiGet<SiteWithStats[]>('/sites'),
  });
}

export function useSiteDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['sites', id],
    queryFn: () => apiGet<SiteDetail>(`/sites/${id}`),
    enabled: !!id,
  });
}

export function useCreateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { siteName: string; location: string; capacity: number }) =>
      apiPost<Site>('/sites', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export function useUpdateSite(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ siteName: string; location: string; capacity: number; status: string }>) =>
      apiPut<Site>(`/sites/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export function useCages(siteId: number | undefined) {
  return useQuery({
    queryKey: ['sites', siteId, 'cages'],
    queryFn: () => apiGet<{ id: number; cageNumber: string; capacity: number; status: string }[]>(`/sites/${siteId}/cages`),
    enabled: !!siteId,
  });
}

export function useCreateCage(siteId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { siteId: number; cageNumber: string; capacity: number }) =>
      apiPost<Cage>(`/sites/${siteId}/cages`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export function useUpdateCage(siteId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cageId, data }: { cageId: number; data: Partial<{ cageNumber: string; capacity: number; status: string }> }) =>
      apiPut<Cage>(`/sites/${siteId}/cages/${cageId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}
