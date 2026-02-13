import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import type { DashboardTrend } from '@farmflow/shared';

interface EnhancedMetricCardProps {
  title: string;
  value: string;
  description?: string;
  icon: React.ElementType;
  loading: boolean;
  trend?: DashboardTrend;
  sparklineColor?: string;
  invertTrend?: boolean; // For metrics where "down" is good (e.g., mortality)
}

export default function EnhancedMetricCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
  trend,
  sparklineColor = '#2563eb',
  invertTrend = false,
}: EnhancedMetricCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-28 mb-2" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  const sparklineData = trend?.sparkline?.map((v, i) => ({ i, v })) ?? [];
  const isPositive = invertTrend
    ? trend?.direction === 'down'
    : trend?.direction === 'up';
  const isNegative = invertTrend
    ? trend?.direction === 'up'
    : trend?.direction === 'down';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <div className="flex items-center gap-1 mt-1">
              {trend && trend.direction !== 'flat' && (
                <>
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : isNegative ? (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  ) : (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      isPositive
                        ? 'text-green-600'
                        : isNegative
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {trend.changePercent > 0 ? '+' : ''}{trend.changePercent}%
                  </span>
                </>
              )}
              {description && (
                <span className="text-xs text-muted-foreground">{description}</span>
              )}
            </div>
          </div>

          {sparklineData.length > 1 && (
            <div className="w-16 h-8">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData}>
                  <defs>
                    <linearGradient id={`sparkFill-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={sparklineColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={sparklineColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={sparklineColor}
                    strokeWidth={1.5}
                    fill={`url(#sparkFill-${title.replace(/\s/g, '')})`}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
