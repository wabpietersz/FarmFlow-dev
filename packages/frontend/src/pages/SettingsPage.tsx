import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useSystemConfig, useUpdateSystemConfig } from '@/hooks/useFeed';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Save, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Reusable sub-component: editable string-list card
// ---------------------------------------------------------------------------

interface StringListCardProps {
  title: string;
  description: string;
  configKey: string;
  items: string[];
  setItems: React.Dispatch<React.SetStateAction<string[]>>;
  canEdit: boolean;
  onSave: (key: string, value: unknown) => Promise<void>;
  isSaving: boolean;
  placeholder?: string;
}

function StringListCard({
  title,
  description,
  configKey,
  items,
  setItems,
  canEdit,
  onSave,
  isSaving,
  placeholder = 'Add new item...',
}: StringListCardProps) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (items.some((i) => i.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('This item already exists');
      return;
    }
    setItems((prev) => [...prev, trimmed]);
    setNewItem('');
  };

  const handleRemove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No items configured.</p>
          )}
          {items.map((item, idx) => (
            <Badge key={idx} variant="secondary" className="gap-1 pr-1">
              {item}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>

        {canEdit && (
          <>
            <div className="flex gap-2">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="max-w-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            <div>
              <Button
                type="button"
                size="sm"
                disabled={isSaving}
                onClick={() => onSave(configKey, items)}
              >
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Alert thresholds type
// ---------------------------------------------------------------------------

interface AlertThresholds {
  mortalityRateWarning: number;
  fcrWarning: number;
  fcrCritical: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  mortalityRateWarning: 5,
  fcrWarning: 1.8,
  fcrCritical: 2.2,
};

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { hasPermission } = useAuthStore();
  const { data: configData, isLoading } = useSystemConfig();
  const updateConfig = useUpdateSystemConfig();

  const canEdit = hasPermission('system:update');

  // -- Local state for each config section --
  const [feedTypes, setFeedTypes] = useState<string[]>([]);
  const [mortalityCauses, setMortalityCauses] = useState<string[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<string[]>([]);
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS);

  // -- Hydrate local state from API data --
  useEffect(() => {
    if (!configData?.data) return;
    const configs = configData.data;

    const findValue = (key: string) => configs.find((c) => c.configKey === key)?.configValue;

    const ft = findValue('feed_types');
    if (Array.isArray(ft)) setFeedTypes(ft as string[]);

    const mc = findValue('mortality_causes');
    if (Array.isArray(mc)) setMortalityCauses(mc as string[]);

    const dg = findValue('designations');
    if (Array.isArray(dg)) setDesignations(dg as string[]);

    const lt = findValue('leave_types');
    if (Array.isArray(lt)) setLeaveTypes(lt as string[]);

    const at = findValue('alert_thresholds');
    if (at && typeof at === 'object') {
      setThresholds({ ...DEFAULT_THRESHOLDS, ...(at as Partial<AlertThresholds>) });
    }
  }, [configData]);

  // -- Save handler --
  const handleSave = async (key: string, value: unknown) => {
    try {
      await updateConfig.mutateAsync({ key, data: { configValue: value } });
      toast.success('Configuration updated');
    } catch {
      toast.error('Failed to update configuration');
    }
  };

  // -- Access guard --
  if (!hasPermission('system:read')) {
    return (
      <div className="text-center py-12">
        <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">Access Restricted</h3>
        <p className="text-sm text-muted-foreground">
          You do not have permission to view system settings.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Feed Types */}
        <StringListCard
          title="Feed Types"
          description="Manage the available feed types used across the system."
          configKey="feed_types"
          items={feedTypes}
          setItems={setFeedTypes}
          canEdit={canEdit}
          onSave={handleSave}
          isSaving={updateConfig.isPending}
          placeholder="e.g. Starter, Grower, Finisher..."
        />

        {/* Mortality Causes */}
        <StringListCard
          title="Mortality Causes"
          description="Define the list of mortality causes for daily record entries."
          configKey="mortality_causes"
          items={mortalityCauses}
          setItems={setMortalityCauses}
          canEdit={canEdit}
          onSave={handleSave}
          isSaving={updateConfig.isPending}
          placeholder="e.g. Disease, Heat Stress..."
        />

        {/* Designations */}
        <StringListCard
          title="Designations"
          description="Job designations available for employee records."
          configKey="designations"
          items={designations}
          setItems={setDesignations}
          canEdit={canEdit}
          onSave={handleSave}
          isSaving={updateConfig.isPending}
          placeholder="e.g. Farm Worker, Supervisor..."
        />

        {/* Leave Types */}
        <StringListCard
          title="Leave Types"
          description="Types of leave available to employees."
          configKey="leave_types"
          items={leaveTypes}
          setItems={setLeaveTypes}
          canEdit={canEdit}
          onSave={handleSave}
          isSaving={updateConfig.isPending}
          placeholder="e.g. Annual, Sick, Maternity..."
        />

        {/* Alert Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle>Alert Thresholds</CardTitle>
            <CardDescription>
              Configure warning and critical thresholds for production alerts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mortalityRateWarning">Mortality Rate Warning (%)</Label>
              <Input
                id="mortalityRateWarning"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={thresholds.mortalityRateWarning}
                onChange={(e) =>
                  setThresholds((prev) => ({
                    ...prev,
                    mortalityRateWarning: parseFloat(e.target.value) || 0,
                  }))
                }
                disabled={!canEdit}
                className="max-w-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fcrWarning">FCR Warning</Label>
              <Input
                id="fcrWarning"
                type="number"
                step="0.01"
                min="0"
                value={thresholds.fcrWarning}
                onChange={(e) =>
                  setThresholds((prev) => ({
                    ...prev,
                    fcrWarning: parseFloat(e.target.value) || 0,
                  }))
                }
                disabled={!canEdit}
                className="max-w-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fcrCritical">FCR Critical</Label>
              <Input
                id="fcrCritical"
                type="number"
                step="0.01"
                min="0"
                value={thresholds.fcrCritical}
                onChange={(e) =>
                  setThresholds((prev) => ({
                    ...prev,
                    fcrCritical: parseFloat(e.target.value) || 0,
                  }))
                }
                disabled={!canEdit}
                className="max-w-xs"
              />
            </div>

            {canEdit && (
              <div>
                <Button
                  type="button"
                  size="sm"
                  disabled={updateConfig.isPending}
                  onClick={() => handleSave('alert_thresholds', thresholds)}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {updateConfig.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
