import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartLegend } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Activity, TrendingUp, Users, Database, Clock, AlertCircle } from "lucide-react";

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState("7");

  // Fetch analytics summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/admin/analytics/summary'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/analytics/summary', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch analytics summary');
      return response.json();
    },
  });

  // Fetch account performance
  const { data: accountMetrics, isLoading: accountsLoading } = useQuery({
    queryKey: ['/api/admin/analytics/accounts'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/analytics/accounts', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch account metrics');
      return response.json();
    },
  });

  // Fetch product usage
  const { data: productMetrics, isLoading: productsLoading } = useQuery({
    queryKey: ['/api/admin/analytics/products'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/analytics/products', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch product metrics');
      return response.json();
    },
  });

  // Fetch timeline data
  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['/api/admin/analytics/timeline', timeRange],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`/api/admin/analytics/timeline?days=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch timeline data');
      return response.json();
    },
  });

  // Fetch recent logs
  const { data: recentLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['/api/admin/analytics/logs'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/analytics/logs?limit=50', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch recent logs');
      return response.json();
    },
  });

  const chartConfig = {
    total_requests: {
      label: "Total Requests",
      color: "hsl(var(--chart-1))",
    },
    successful_requests: {
      label: "Successful",
      color: "hsl(var(--chart-2))",
    },
    failed_requests: {
      label: "Failed",
      color: "hsl(var(--chart-3))",
    },
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="card-total-requests">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-requests">
              {summaryLoading ? "..." : (summary?.total_requests || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card data-testid="card-success-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">
              {summaryLoading ? "..." : `${(summary?.success_rate || 0).toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">OTP fetch success rate</p>
          </CardContent>
        </Card>

        <Card data-testid="card-successful-requests">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful Requests</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-successful-requests">
              {summaryLoading ? "..." : (summary?.successful_requests || 0)}
            </div>
            <p className="text-xs text-muted-foreground">OTPs successfully retrieved</p>
          </CardContent>
        </Card>

        <Card data-testid="card-failed-requests">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Requests</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-failed-requests">
              {summaryLoading ? "..." : (summary?.failed_requests || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Failed OTP attempts</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Chart */}
      <Card data-testid="card-timeline-chart">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Request Timeline</CardTitle>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32" data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {timelineLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Loading timeline...</div>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <LineChart data={timeline?.map(d => ({
                ...d,
                total_requests: Number(d.total_requests),
                successful_requests: Number(d.successful_requests),
                failed_requests: Number(d.failed_requests)
              })) || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip />
                <ChartLegend />
                <Line 
                  type="monotone" 
                  dataKey="total_requests" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  name="Total Requests"
                />
                <Line 
                  type="monotone" 
                  dataKey="successful_requests" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  name="Successful"
                />
                <Line 
                  type="monotone" 
                  dataKey="failed_requests" 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  name="Failed"
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Performance */}
        <Card data-testid="card-account-performance">
          <CardHeader>
            <CardTitle>Account Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse p-3 border border-border rounded-md">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {accountMetrics?.slice(0, 5).map((account: any) => (
                  <div key={account.account_id} className="flex items-center justify-between p-3 border border-border rounded-md">
                    <div>
                      <p className="font-medium text-foreground" data-testid={`text-account-${account.account_id}`}>
                        {account.label}
                      </p>
                      <p className="text-sm text-muted-foreground">{account.host}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.total_requests} requests
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={account.success_rate > 80 ? "default" : account.success_rate > 50 ? "secondary" : "destructive"}>
                        {account.success_rate.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Usage */}
        <Card data-testid="card-product-usage">
          <CardHeader>
            <CardTitle>Product Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Loading products...</div>
              </div>
            ) : productMetrics && productMetrics.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <PieChart>
                  <Pie
                    data={productMetrics}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ title, total_requests }) => `${title}: ${total_requests}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="total_requests"
                  >
                    {productMetrics.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No product usage data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card data-testid="card-recent-activity">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse p-3 border border-border rounded-md">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2 mb-1"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentLogs?.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant={log.status === 'success' ? "default" : "destructive"}>
                        {log.status}
                      </Badge>
                      <span className="font-medium text-foreground">
                        {log.products?.title || log.product_id}
                      </span>
                      {log.accounts?.label && (
                        <span className="text-sm text-muted-foreground">
                          via {log.accounts.label}
                        </span>
                      )}
                    </div>
                    {log.detail && (
                      <p className="text-sm text-muted-foreground mt-1">{log.detail}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}