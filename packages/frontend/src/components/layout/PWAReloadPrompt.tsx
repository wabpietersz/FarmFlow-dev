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
    <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-50 md:inset-x-auto md:bottom-6 md:right-6">
      <Card className="border-border bg-background/95 shadow-sm backdrop-blur md:w-[24rem]">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <RefreshCw className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              A new version is available
            </p>
            <p className="text-xs text-muted-foreground">
              Update to refresh cached assets and keep the installed app in sync.
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
