import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';

export default function PWAReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Check for updates every hour
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="shadow-lg border-primary/20">
        <CardContent className="flex items-center gap-3 p-4">
          <RefreshCw className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              A new version is available
            </p>
            <p className="text-xs text-muted-foreground">
              Click update to get the latest features
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => updateServiceWorker(true)}
            className="h-8"
          >
            Update
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
