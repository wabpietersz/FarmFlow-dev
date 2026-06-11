import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useDashboardExceptions, useEnhancedDashboard, useExecutiveDashboard, useRecentActivity } from '@/hooks/useDashboard';
import EnhancedMetricCard from '@/components/dashboard/EnhancedMetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DashboardPeriod } from '@farmflow/shared';
import {
  Egg,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingCart,
  Activity,
  Plus,
  ClipboardList,
  Wheat,
  Clock,
  CalendarCheck,
  Landmark,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const PERIODS: { label: string; value: DashboardPeriod }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'YTD', value: 'ytd' },
];

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function DashboardPage() {
  const { hasPermission } = useAuthStore();
  const [period, setPeriod] = useState<DashboardPeriod>('7d');

  const { data, isLoading } = useEnhancedDashboard(period);
  const summary = data?.data;
  const executiveQuery = useExecutiveDashboard();
  const exceptionsQuery = useDashboardExceptions();
  const executive = executiveQuery.data?.data;
  const exceptions = exceptionsQuery.data?.data;
  const { data: activityData } = useRecentActivity(10);
  const activities = (activityData as unknown as { data?: { id: number; type: string; action: string; description: string; timestamp: string }[] })?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

        {/* Period Selector */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriod(p.value)}
              className="h-7 px-3 text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Enhanced Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <EnhancedMetricCard
          title="Active Batches"
          value={String(summary?.activeBatches ?? 0)}
          description="across all sites"
          icon={Egg}
          loading={isLoading}
        />
        <EnhancedMetricCard
          title="Avg FCR"
          value={summary?.averageFcr ? summary.averageFcr.toFixed(2) : '--'}
          icon={Activity}
          loading={isLoading}
          trend={summary?.averageFcrTrend}
          sparklineColor="#404040"
          invertTrend // lower FCR is better
        />
        <EnhancedMetricCard
          title="Mortality"
          value={String(summary?.mortalityLast7Days ?? 0)}
          description={`last ${period === 'ytd' ? 'YTD' : period}`}
          icon={TrendingDown}
          loading={isLoading}
          trend={summary?.mortalityTrend}
          sparklineColor="#dc2626"
          invertTrend // lower mortality is better
        />
        <EnhancedMetricCard
          title="Outstanding"
          value={formatCurrency(summary?.outstandingPayments ?? 0)}
          description="pending payments"
          icon={DollarSign}
          loading={isLoading}
        />
        <EnhancedMetricCard
          title="Employees"
          value={String(summary?.totalEmployees ?? 0)}
          description="active"
          icon={Users}
          loading={isLoading}
        />
        <EnhancedMetricCard
          title="Recent Sales"
          value={String(summary?.recentSales?.count ?? 0)}
          description={
            summary?.recentSales
              ? formatCurrency(summary.recentSales.totalAmount)
              : undefined
          }
          icon={ShoppingCart}
          loading={isLoading}
          trend={summary?.salesTrend}
          sparklineColor="#525252"
        />
        <EnhancedMetricCard
          title="Feed Inventory"
          value={`${summary?.feedInventoryStatus?.lowStockItems ?? 0} low`}
          description={`of ${summary?.feedInventoryStatus?.totalItems ?? 0} items`}
          icon={Wheat}
          loading={isLoading}
        />
        <EnhancedMetricCard
          title="Pending Payroll"
          value={String(summary?.pendingPayroll?.count ?? 0)}
          description={
            summary?.pendingPayroll
              ? formatCurrency(summary.pendingPayroll.totalAmount)
              : undefined
          }
          icon={Clock}
          loading={isLoading}
        />
        <EnhancedMetricCard
          title="Attendance Rate"
          value={`${summary?.attendanceRate?.rate ?? 0}%`}
          description={
            summary?.attendanceRate
              ? `${summary.attendanceRate.presentToday}/${summary.attendanceRate.totalActive} today`
              : undefined
          }
          icon={CalendarCheck}
          loading={isLoading}
        />
        <EnhancedMetricCard
          title="Cash Position"
          value={formatCurrency(executive?.cash.totalBookBalance ?? 0)}
          description={`Bank ${formatCurrency(executive?.cash.bankBalance ?? 0)}`}
          icon={Landmark}
          loading={executiveQuery.isLoading}
        />
        <EnhancedMetricCard
          title="Exception Load"
          value={String(
            (exceptions?.summary.negativeStockRisk ?? 0)
            + (exceptions?.summary.paymentWithoutTreasuryLink ?? 0)
            + (exceptions?.summary.chequeAgeing ?? 0)
            + (exceptions?.summary.overduePayables ?? 0),
          )}
          description="tracked control exceptions"
          icon={Clock}
          loading={exceptionsQuery.isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Executive Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Overdue payables</span>
              <span className="font-medium">{formatCurrency(executive?.payables.overdueAmount ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Outstanding receivables</span>
              <span className="font-medium">{formatCurrency(executive?.receivables.outstandingAmount ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active batch revenue</span>
              <span className="font-medium">{formatCurrency(executive?.profitability.totalRevenue ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gross margin</span>
              <span className="font-medium">{formatCurrency(executive?.profitability.grossMargin ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pending approvals</span>
              <span className="font-medium">{executive?.payables.pendingApprovalCount ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Control Exceptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Negative stock risk</span>
              <span className="font-medium">{exceptions?.summary.negativeStockRisk ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Missing treasury link</span>
              <span className="font-medium">{exceptions?.summary.paymentWithoutTreasuryLink ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cheque ageing</span>
              <span className="font-medium">{exceptions?.summary.chequeAgeing ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Overdue receivables</span>
              <span className="font-medium">{exceptions?.summary.overdueReceivables ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Missing cost components</span>
              <span className="font-medium">{exceptions?.summary.missingCostComponents ?? 0}</span>
            </div>
          </CardContent>
        </Card>
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
          {hasPermission('reports:read') && (
            <Button variant="outline" asChild>
              <Link to="/reports">
                <Activity className="h-4 w-4 mr-2" />
                View Reports
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity) => {
                const typeVariant: Record<string, 'secondary' | 'outline' | 'destructive'> = {
                  batch: 'secondary',
                  sale: 'secondary',
                  employee: 'outline',
                  feed: 'outline',
                  payroll: 'destructive',
                  attendance: 'outline',
                };
                const timeAgo = getTimeAgo(activity.timestamp);
                return (
                  <div key={activity.id} className="flex items-center gap-3 text-sm">
                    <Badge variant={typeVariant[activity.type] || 'outline'} className="capitalize">
                      {activity.type}
                    </Badge>
                    <span className="text-foreground flex-1">{activity.description}</span>
                    <span className="text-muted-foreground text-xs whitespace-nowrap">{timeAgo}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No recent activity to display.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
