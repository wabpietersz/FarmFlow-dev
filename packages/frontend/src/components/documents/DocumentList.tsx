import { useRef } from 'react';
import { useDocuments, useUploadDocument, useDeleteDocument, useDocumentDownload } from '@/hooks/useDocuments';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, Trash2, FileText, Image, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentListProps {
  entityType: string;
  entityId: number | string;
  title?: string;
}

const fileTypeIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return Image;
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return FileSpreadsheet;
  return FileText;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function DocumentList({ entityType, entityId, title = 'Documents' }: DocumentListProps) {
  const { hasPermission } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useDocuments(entityType, entityId);
  const uploadMutation = useUploadDocument(entityType, entityId);
  const deleteMutation = useDeleteDocument(entityType, entityId);
  const downloadMutation = useDocumentDownload();

  const docs = data?.data ?? [];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadMutation.mutateAsync(file);
      toast.success('Document uploaded successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast.error(message);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (docId: number) => {
    try {
      const result = await downloadMutation.mutateAsync(docId);
      window.open(result.url, '_blank');
    } catch {
      toast.error('Failed to download document');
    }
  };

  const handleDelete = async (docId: number, fileName: string) => {
    if (!confirm(`Delete "${fileName}"?`)) return;
    try {
      await deleteMutation.mutateAsync(docId);
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {hasPermission('employees:read') && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              onChange={handleFileSelect}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading documents...</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => {
              const Icon = fileTypeIcon(doc.fileType);
              return (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDownload(doc.id)}
                      disabled={downloadMutation.isPending}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {hasPermission('employees:delete') && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleDelete(doc.id, doc.fileName)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
