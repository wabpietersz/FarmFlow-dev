import { useState } from 'react';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { AccessLevel, AccessModuleKey } from '@farmflow/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccessMatrix, useSetAccessLevel } from '@/hooks/useAccess';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const LEVELS: Array<{ value: AccessLevel; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

/** Who can do what: one row per role, one column per module, three levels each. */
export function AccessSettings({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading, error } = useAccessMatrix();
  const setLevel = useSetAccessLevel();
  const [pending, setPending] = useState<string | null>(null);
  const [focusRole, setFocusRole] = useState<string | null>(null);
  const matrix = data?.data;

  if (isLoading) return <Skeleton className="h-96 rounded-3xl" />;
  if (error || !matrix) return <p className="rounded-2xl bg-danger-soft p-4 text-sm font-medium text-danger">{getApiErrorMessage(error, 'Could not load access levels.')}</p>;

  const change = async (role: string, moduleKey: AccessModuleKey, level: AccessLevel) => {
    const key = `${role}:${moduleKey}`;
    setPending(key);
    try {
      await setLevel.mutateAsync({ role, moduleKey, level });
      const roleLabel = matrix.roles.find((r) => r.role === role)?.roleLabel ?? role;
      const moduleLabel = matrix.modules.find((m) => m.key === moduleKey)?.label ?? moduleKey;
      toast.success(`${roleLabel}: ${moduleLabel} set to ${LEVELS.find((l) => l.value === level)!.label}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not change access'));
    } finally {
      setPending(null);
    }
  };

  const roles = focusRole ? matrix.roles.filter((r) => r.role === focusRole) : matrix.roles;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <LevelExplainer level="None" text="The module is hidden and its data can't be opened." />
        <LevelExplainer level="User" text="Day-to-day work: see records and enter new ones." />
        <LevelExplainer level="Admin" text="Everything User can do, plus manage, approve, delete and configure." />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Show role">
        <button type="button" onClick={() => setFocusRole(null)} className={pill(!focusRole)}>All roles</button>
        {matrix.roles.map((role) => (
          <button key={role.role} type="button" onClick={() => setFocusRole(role.role)} className={pill(focusRole === role.role)}>{role.roleLabel}</button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/95 px-4 py-3 text-left font-semibold">Module</th>
              {roles.map((role) => (
                <th key={role.role} className="px-3 py-3 text-left font-semibold">
                  <span className="flex items-center gap-1.5">{role.roleLabel}{role.locked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Always full access" /> : null}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.modules.map((module) => (
              <tr key={module.key} className="border-b border-border last:border-0">
                <th scope="row" className="sticky left-0 z-10 w-64 bg-card px-4 py-3 text-left align-top font-normal">
                  <p className="font-bold">{module.label}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{module.description}</p>
                  <details className="mt-1 text-[13px] text-muted-foreground">
                    <summary className="cursor-pointer font-semibold text-primary">What each level allows</summary>
                    <p className="mt-1"><span className="font-semibold text-foreground">User:</span> {module.userCan}</p>
                    <p className="mt-1"><span className="font-semibold text-foreground">Admin:</span> {module.adminCan}</p>
                  </details>
                </th>
                {roles.map((role) => {
                  const current = role.levels[module.key] ?? 'none';
                  const key = `${role.role}:${module.key}`;
                  const disabled = !canEdit || role.locked || pending === key;
                  return (
                    <td key={role.role} className="px-3 py-3 align-top">
                      <div
                        role="radiogroup"
                        aria-label={`${role.roleLabel}, ${module.label}`}
                        className={cn('inline-flex rounded-full bg-muted p-1', pending === key && 'opacity-60')}
                      >
                        {LEVELS.map((level) => (
                          <button
                            key={level.value}
                            type="button"
                            role="radio"
                            aria-checked={current === level.value}
                            disabled={disabled}
                            onClick={() => current !== level.value && change(role.role, module.key, level.value)}
                            className={cn(
                              'min-h-9 rounded-full px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed',
                              current === level.value
                                ? level.value === 'admin'
                                  ? 'bg-primary text-primary-foreground'
                                  : level.value === 'user'
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'bg-card text-muted-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {level.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-muted-foreground">
        Changes apply within a minute. People already signed in see the change the next time the app loads. System admins always keep full access.
      </p>
    </div>
  );
}

function pill(active: boolean) {
  return cn('min-h-10 rounded-full px-4 text-sm font-semibold transition-colors', active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground');
}

function LevelExplainer({ level, text }: { level: string; text: string }) {
  return (
    <div className="rounded-2xl bg-panel p-4">
      <p className="font-bold">{level}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
