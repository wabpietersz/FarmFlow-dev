import { useState, useMemo } from 'react';
import { useHRAnalytics, exportReportCsv } from '@/hooks/useReports';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Download, Users, Clock, Calendar, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils';

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-4)', 'var(--chart-3)', 'var(--chart-5)', 'var(--danger)'];

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 6);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export default function HRAnalyticsTab() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);

  const { data: reportData, isLoading } = useHRAnalytics({ startDate, endDate });
  const analytics = reportData?.data;

  const attendanceByMonth = analytics?.attendanceByMonth ?? [];
  const attendanceByEmployee = analytics?.attendanceByEmployee ?? [];
  const leaveUtilization = analytics?.leaveUtilization ?? [];
  const payrollByMonth = analytics?.payrollByMonth ?? [];
  const overtimeByMonth = analytics?.overtimeByMonth ?? [];

  const avgAttendanceRate = useMemo(() => {
    if (attendanceByMonth.length === 0) return 0;
    return attendanceByMonth.reduce((sum, m) => sum + m.rate, 0) / attendanceByMonth.length;
  }, [attendanceByMonth]);

  const totalLeaveUsed = leaveUtilization.reduce((sum, l) => sum + l.totalUsed, 0);
  const latestPayroll = payrollByMonth[payrollByMonth.length - 1];
  const totalOvertime = overtimeByMonth.reduce((sum, o) => sum + o.totalHours, 0);

  const handleExport = async () => {
    try {
      await exportReportCsv('hr-analytics', { startDate, endDate });
      toast.success('Report exported successfully');
    } catch {
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-[160px]" />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { title: 'Avg Attendance Rate', value: `${avgAttendanceRate.toFixed(1)}%`, icon: Users },
          { title: 'Total Leave Used', value: `${totalLeaveUsed} days`, icon: Calendar },
          { title: 'Latest Payroll Cost', value: formatCurrency(latestPayroll?.grossTotal ?? 0), icon: DollarSign },
          { title: 'Total Overtime', value: `${totalOvertime.toFixed(1)} hrs`, icon: Clock },
        ].map((card) => (
          <Card key={card.title}>
            <CardContent className="pt-6">
              {isLoading ? (
                <>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-32" />
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  </div>
                  <card.icon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Rate by Month */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Rate by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : attendanceByMonth.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No attendance data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={attendanceByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'Attendance Rate']} />
                  <Legend />
                  <Line type="monotone" dataKey="rate" name="Attendance Rate" stroke={CHART_COLORS[0]} strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payroll Cost Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Payroll Cost Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : payrollByMonth.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No payroll data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={payrollByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v: number) => formatCurrencyCompact(v)} />
                  <Tooltip formatter={(value: number | undefined) => [formatCurrency(value ?? 0)]} />
                  <Legend />
                  <Bar dataKey="grossTotal" name="Gross" fill={CHART_COLORS[0]} stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="netTotal" name="Net" fill={CHART_COLORS[1]} stackId="b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Utilization */}
        <Card>
          <CardHeader>
            <CardTitle>Leave Utilization by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : leaveUtilization.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No leave data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={leaveUtilization.map((l) => ({ name: l.leaveType.replace(/_/g, ' '), value: l.totalUsed }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                    labelLine
                  >
                    {leaveUtilization.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Overtime by Month */}
        <Card>
          <CardHeader>
            <CardTitle>Overtime Hours by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : overtimeByMonth.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No overtime data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={overtimeByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)} hrs`]} />
                  <Legend />
                  <Bar dataKey="totalHours" name="Overtime Hours" fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Employee Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance by Employee</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : attendanceByEmployee.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No data available</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Present Days</TableHead>
                    <TableHead className="text-right">Total Days</TableHead>
                    <TableHead className="text-right">Attendance Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceByEmployee.map((emp) => (
                    <TableRow key={emp.employeeId}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell className="text-right">{emp.presentDays}</TableCell>
                      <TableCell className="text-right">{emp.totalDays}</TableCell>
                      <TableCell className={`text-right font-medium ${emp.rate >= 80 ? 'text-success' : emp.rate >= 60 ? 'text-warning' : 'text-danger'}`}>
                        {emp.rate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
