import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Egg } from 'lucide-react';

export default function BatchesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Batches</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Egg className="h-5 w-5" />
            Batch Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Batch management features are coming soon. You will be able to track
            batch lifecycle, daily records, and FCR calculations here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
