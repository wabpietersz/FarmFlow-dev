import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

interface SiteOption {
  id: number;
  siteName: string;
  location: string;
}

export function useSites() {
  return useQuery({
    queryKey: ['sites', 'list'],
    queryFn: () => apiGet<SiteOption[]>('/sites/list'),
    staleTime: 10 * 60 * 1000,
  });
}
