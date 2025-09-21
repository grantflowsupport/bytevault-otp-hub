import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  History, 
  Search, 
  Filter, 
  RotateCcw, 
  Calendar, 
  User, 
  FileText, 
  Database,
  ChevronLeft,
  ChevronRight,
  BarChart3
} from "lucide-react";

interface AuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_ids?: string[];
  old_values?: any;
  new_values?: any;
  metadata?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

interface AuditStats {
  total_actions: number;
  actions_by_type: Record<string, number>;
  entities_by_type: Record<string, number>;
  daily_activity: Record<string, number>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AuditLogs() {
  const { toast } = useToast();
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 25,
    entity_type: '',
    action: '',
    admin_user_id: '',
    start_date: '',
    end_date: '',
  });

  // Fetch audit logs
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['/api/audit/logs', filters],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });

      const response = await fetch(`/api/audit/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch audit logs');
      return response.json();
    },
  });

  // Fetch audit statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/audit/stats'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/audit/stats', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch audit statistics');
      return response.json();
    },
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: async (auditId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`/api/audit/rollback/${auditId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rollback action');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rollback Successful",
        description: "The action has been successfully rolled back.",
      });
      refetchLogs();
      setSelectedLog(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Rollback Failed",
        description: error.message,
      });
    },
  });

  const logs: AuditLog[] = logsData?.logs || [];
  const pagination: Pagination = logsData?.pagination || { page: 1, limit: 25, total: 0, pages: 0 };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleRollback = (log: AuditLog) => {
    if (window.confirm(`Are you sure you want to rollback this ${log.action} action on ${log.entity_type}?`)) {
      rollbackMutation.mutate(log.id);
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'create': return 'default';
      case 'update': return 'secondary';
      case 'delete': return 'destructive';
      default: return 'outline';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatJsonData = (data: any) => {
    if (!data) return 'N/A';
    return JSON.stringify(data, null, 2);
  };

  if (logsLoading && !logs.length) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="animate-pulse h-6 bg-muted rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Card */}
      {stats && (
        <Card data-testid="card-audit-stats">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Audit Statistics (Last 30 Days)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total_actions}</div>
                <div className="text-sm text-muted-foreground">Total Actions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{Object.keys(stats.actions_by_type).length}</div>
                <div className="text-sm text-muted-foreground">Action Types</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{Object.keys(stats.entities_by_type).length}</div>
                <div className="text-sm text-muted-foreground">Entity Types</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{Object.keys(stats.daily_activity).length}</div>
                <div className="text-sm text-muted-foreground">Active Days</div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Actions by Type</h4>
                <div className="space-y-1">
                  {Object.entries(stats.actions_by_type).map(([action, count]) => (
                    <div key={action} className="flex justify-between text-sm">
                      <span className="capitalize">{action}</span>
                      <span>{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Entities Modified</h4>
                <div className="space-y-1">
                  {Object.entries(stats.entities_by_type).map(([entity, count]) => (
                    <div key={entity} className="flex justify-between text-sm">
                      <span className="capitalize">{entity.replace('_', ' ')}</span>
                      <span>{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card data-testid="card-audit-filters">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="entity-type">Entity Type</Label>
              <Select value={filters.entity_type} onValueChange={(value) => handleFilterChange('entity_type', value)}>
                <SelectTrigger data-testid="select-entity-type">
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All entities</SelectItem>
                  <SelectItem value="products">Products</SelectItem>
                  <SelectItem value="accounts">Accounts</SelectItem>
                  <SelectItem value="product_accounts">Product Mappings</SelectItem>
                  <SelectItem value="product_credentials">Product Credentials</SelectItem>
                  <SelectItem value="user_access">User Access</SelectItem>
                  <SelectItem value="notification_settings">Notification Settings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="action">Action</Label>
              <Select value={filters.action} onValueChange={(value) => handleFilterChange('action', value)}>
                <SelectTrigger data-testid="select-action">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="bulk_create">Bulk Create</SelectItem>
                  <SelectItem value="bulk_update">Bulk Update</SelectItem>
                  <SelectItem value="bulk_delete">Bulk Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="admin-user">Admin User ID</Label>
              <Input
                id="admin-user"
                value={filters.admin_user_id}
                onChange={(e) => handleFilterChange('admin_user_id', e.target.value)}
                placeholder="Filter by admin user"
                data-testid="input-admin-user"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="datetime-local"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="datetime-local"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                data-testid="input-end-date"
              />
            </div>
          </div>

          <Button
            onClick={() => setFilters({ page: 1, limit: 25, entity_type: '', action: '', admin_user_id: '', start_date: '', end_date: '' })}
            variant="outline"
            data-testid="button-clear-filters"
          >
            Clear Filters
          </Button>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card data-testid="card-audit-logs">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <History className="h-5 w-5" />
              <span>Audit Logs</span>
              <Badge variant="secondary">{pagination.total} total</Badge>
            </div>
            <Button 
              onClick={() => refetchLogs()} 
              variant="outline" 
              size="sm"
              data-testid="button-refresh-logs"
            >
              <Search className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found matching your criteria.
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedLog?.id === log.id ? 'bg-muted' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                  data-testid={`log-entry-${log.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {log.action}
                      </Badge>
                      <span className="font-medium">{log.entity_type}</span>
                      {log.entity_id && (
                        <span className="text-sm text-muted-foreground">
                          ID: {log.entity_id.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4" />
                        <span>{log.admin_user_id.slice(0, 8)}...</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatTimestamp(log.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {selectedLog?.id === log.id && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {log.old_values && (
                          <div>
                            <Label className="text-sm font-medium">Previous Values</Label>
                            <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                              {formatJsonData(log.old_values)}
                            </pre>
                          </div>
                        )}
                        {log.new_values && (
                          <div>
                            <Label className="text-sm font-medium">New Values</Label>
                            <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                              {formatJsonData(log.new_values)}
                            </pre>
                          </div>
                        )}
                      </div>

                      {log.metadata && (
                        <div>
                          <Label className="text-sm font-medium">Metadata</Label>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-24">
                            {formatJsonData(log.metadata)}
                          </pre>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground space-y-1">
                          {log.ip_address && <div>IP: {log.ip_address}</div>}
                          {log.user_agent && (
                            <div>User Agent: {log.user_agent.slice(0, 100)}...</div>
                          )}
                        </div>

                        {['create', 'update', 'delete'].includes(log.action) && log.entity_id && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRollback(log);
                            }}
                            variant="destructive"
                            size="sm"
                            disabled={rollbackMutation.isPending}
                            data-testid={`button-rollback-${log.id}`}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            {rollbackMutation.isPending ? 'Rolling back...' : 'Rollback'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total records)
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  variant="outline"
                  size="sm"
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <Button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  variant="outline"
                  size="sm"
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}