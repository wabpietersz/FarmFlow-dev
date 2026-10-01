import { useSearchParams, Link } from 'react-router-dom';
import { ArrowRight, Bell, Boxes, ClipboardCheck, HandCoins, HeartPulse, KeyRound, ListChecks, Settings, Store, Users, Wallet, type LucideIcon } from 'lucide-react';
import { PayrollSettings } from '@/components/settings/PayrollSettings';
import { ApprovalSettings } from '@/components/settings/ApprovalSettings';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { AccessSettings } from '@/components/settings/AccessSettings';
import { AlertSettings, ListsSettings } from '@/components/settings/ListsSettings';
import { ItemTypesSettings, StoresSettings } from '@/components/settings/StockSetupSettings';
import { FinanceSetupTab } from '@/components/finance/FinanceSetupTab';
import UserManagementPage from '@/pages/UserManagementPage';

type Section = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Permission needed to see the section */
  view: string;
  /** Permission needed to change things in it */
  edit: string;
};

const SECTIONS: Section[] = [
  { key: 'access', label: 'Access & roles', description: 'What each role can see and do in every part of FarmFlow.', icon: KeyRound, view: 'system:read', edit: 'users:update' },
  { key: 'users', label: 'Users', description: 'Who can sign in, their role and farm.', icon: Users, view: 'users:read', edit: 'users:update' },
  { key: 'lists', label: 'Lists & options', description: 'The choices offered in dropdowns and quick buttons.', icon: ListChecks, view: 'system:read', edit: 'system:update' },
  { key: 'item-types', label: 'Stock item types', description: 'The kinds of stock you keep and how each behaves.', icon: Boxes, view: 'inventory:read', edit: 'inventory:create' },
  { key: 'stores', label: 'Stores', description: 'Where stock is kept. Each farm has its own store.', icon: Store, view: 'inventory:read', edit: 'inventory:create' },
  { key: 'money', label: 'Money setup', description: 'Money categories and cost centres used to tag every rupee.', icon: Wallet, view: 'treasury:read', edit: 'treasury:accounts:manage' },
  { key: 'approvals', label: 'Approvals', description: 'Spending limits that need a manager’s yes.', icon: ClipboardCheck, view: 'system:read', edit: 'system:update' },
  { key: 'payroll', label: 'Payroll', description: 'EPF and ETF rates used on every payslip.', icon: HandCoins, view: 'payroll:read', edit: 'payroll:approve' },
  { key: 'health', label: 'Health & growth', description: 'Vaccination programmes and target growth curves.', icon: HeartPulse, view: 'batches:read', edit: 'batches:update' },
  { key: 'alerts', label: 'Alerts', description: 'When FarmFlow warns you about a batch.', icon: Bell, view: 'system:read', edit: 'system:update' },
];

/** One place for everything that configures FarmFlow. */
export default function SettingsPage() {
  const { hasPermission } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const visible = SECTIONS.filter((section) => hasPermission(section.view));
  const active = visible.find((section) => section.key === params.get('section')) ?? visible[0];

  if (!active) {
    return (
      <div className="py-16 text-center">
        <Settings className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">No settings available</h1>
        <p className="text-muted-foreground">Your role doesn't include any settings.</p>
      </div>
    );
  }

  const canEdit = hasPermission(active.edit);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-muted-foreground">Access, users, lists and the setup behind every module.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {visible.map((section) => {
            const selected = section.key === active.key;
            return (
              <button
                key={section.key}
                type="button"
                aria-current={selected ? 'page' : undefined}
                onClick={() => setParams({ section: section.key }, { replace: true })}
                className={cn(
                  'flex min-h-11 shrink-0 items-center gap-2.5 rounded-full px-4 text-sm font-semibold transition-colors lg:w-full',
                  selected ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <section.icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{section.label}</span>
              </button>
            );
          })}
        </nav>

        <section aria-labelledby="settings-section-title" className="min-w-0 space-y-5">
          <div>
            <h2 id="settings-section-title" className="text-xl font-bold">{active.label}</h2>
            <p className="text-sm text-muted-foreground">{active.description}{!canEdit ? ' You can view this section but not change it.' : ''}</p>
          </div>
          {active.key === 'access' ? <AccessSettings canEdit={canEdit} /> : null}
          {active.key === 'users' ? <UserManagementPage embedded /> : null}
          {active.key === 'lists' ? <ListsSettings canEdit={canEdit} /> : null}
          {active.key === 'item-types' ? <ItemTypesSettings canEdit={canEdit} /> : null}
          {active.key === 'stores' ? <StoresSettings canEdit={canEdit} /> : null}
          {active.key === 'money' ? <FinanceSetupTab canManage={canEdit} /> : null}
          {active.key === 'approvals' ? <ApprovalSettings canEdit={canEdit} /> : null}
          {active.key === 'payroll' ? <PayrollSettings canEdit={canEdit} /> : null}
          {active.key === 'health' ? <HealthLinks /> : null}
          {active.key === 'alerts' ? <AlertSettings canEdit={canEdit} /> : null}
        </section>
      </div>
    </div>
  );
}

function HealthLinks() {
  const links = [
    { to: '/farm-care?tab=programmes', title: 'Vaccination & medication programmes', text: 'The day-by-day health plan every new batch gets.' },
    { to: '/farm-care?tab=curves', title: 'Growth curves', text: 'Target weight, feed and mortality by day, from your breed guide.' },
    { to: '/farm-care?tab=houses', title: 'House turnaround', text: 'Cleaning checklist between batches.' },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {links.map((link) => (
        <Link key={link.to} to={link.to} className="group flex flex-col gap-1 rounded-3xl bg-panel p-5 transition-colors hover:bg-panel/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex items-center justify-between font-bold">{link.title}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
          <span className="text-sm text-muted-foreground">{link.text}</span>
        </Link>
      ))}
    </div>
  );
}
