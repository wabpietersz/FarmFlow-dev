import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiDelete } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import type { Document } from '@farmflow/shared';

export function useDocuments(entityType: string, entityId: number | string | undefined) {
  return useQuery({
    queryKey: ['documents', entityType, entityId],
    queryFn: () => apiGet<Document[]>(`/documents/${entityType}/${entityId}`),
    enabled: !!entityId,
  });
}

export function useUploadDocument(entityType: string, entityId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);
      formData.append('entityId', String(entityId));

      const token = await getIdToken();
      const baseUrl = import.meta.env.VITE_API_URL || '/api';

      const response = await fetch(`${baseUrl}/documents/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
    },
  });
}

export function useDeleteDocument(entityType: string, entityId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docId: number) => apiDelete<void>(`/documents/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
    },
  });
}

export function useDocumentDownload() {
  return useMutation({
    mutationFn: async (docId: number) => {
      const token = await getIdToken();
      const baseUrl = import.meta.env.VITE_API_URL || '/api';

      const response = await fetch(`${baseUrl}/documents/${docId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Download failed');
      const result = await response.json();
      return result.data as { url: string; fileName: string };
    },
  });
}
