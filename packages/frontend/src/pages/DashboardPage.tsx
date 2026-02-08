import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useDashboardSummary } from '@/hooks/useDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Egg,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingCart,
  Activity,
  Plus,
  ClipboardList,
} from 'lucide-react';

export default function DashboardPage() {
  const { hasPermission } = useAuthStore();
  const { data, isLoading } = useDashboardSummary();

  const summary = data?.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Active Batches"
          value={summary?.activeBatches}
          description="Across all sites"
          icon={Egg}
          loading={isLoading}
        />
        <MetricCard
          title="Avg FCR"
          value={summary?.averageFcr}
          description="Current growing batches"
          icon={Activity}
          loading={isLoading}
          format={(v) => v === 0 ? '--' : v.toFixed(2)}
        />
        <MetricCard
          title="Mortality (7d)"
          value={summary?.mortalityLast7Days}
          description="Last 7 days"
          icon={TrendingDown}
          loading={isLoading}
        />
        <MetricCard
          title="Outstanding"
          value={summary?.outstandingPayments}
          description="Pending payments"
          icon={DollarSign}
          loading={isLoading}
          format={(v) => `R ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <MetricCard
          title="Employees"
          value={summary?.totalEmployees}
          description="Active employees"
          icon={Users}
          loading={isLoading}
        />
        <MetricCard
          title="Recent Sales"
          value={summary?.recentSales?.count}
          description={
            summary?.recentSales
              ? `R ${summary.recentSales.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (7 days)`
              : 'Last 7 days'
          }
          icon={ShoppingCart}
          loading={isLoading}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {hasPermission('employees:create') && (
            <Button variant="outline" asChild>
              <Link to="/employees/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Link>
            </Button>
          )}
          {hasPermission('employees:read') && (
            <Button variant="outline" asChild>
              <Link to="/employees">
                <Users className="h-4 w-4 mr-2" />
                View Employees
              </Link>
            </Button>
          )}
          {hasPermission('batches:read') && (
            <Button variant="outline" asChild>
              <Link to="/batches">
                <ClipboardList className="h-4 w-4 mr-2" />
                View Batches
              </Link>
            </Button>
          )}
          {hasPermission('sales:read') && (
            <Button variant="outline" asChild>
              <Link to="/sales">
                <ShoppingCart className="h-4 w-4 mr-2" />
                View Sales
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Activity feed will show recent batch updates, sales, and employee changes once more data is available.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
  format,
}: {
  title: string;
  value?: number;
  description: string;
  icon: React.ElementType;
  loading: boolean;
  format?: (v: number) => string;
}) {
  const displayValue = loading
    ? null
    : value !== undefined
      ? format
        ? format(value)
        : String(value)
      : '--';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-2xl font-bold text-foreground">{displayValue}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
