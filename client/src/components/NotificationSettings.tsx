import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Bell, Mail, Clock, AlertTriangle, CheckCircle, Send } from "lucide-react";

interface NotificationSettings {
  access_expiry_warning_days: number;
  admin_alerts_enabled: boolean;
  admin_email: string;
  daily_notifications_enabled: boolean;
  notification_time: string;
}

export default function NotificationSettings() {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState("");

  // Fetch notification settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/notifications/settings'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/notifications/settings', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch notification settings');
      return response.json();
    },
  });

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<NotificationSettings>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSettings),
      });

      if (!response.ok) throw new Error('Failed to update notification settings');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Notification settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/settings'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message,
      });
    },
  });

  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/notifications/test-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to send test email');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test Email Sent",
        description: "Check your inbox for the test email.",
      });
      setTestEmail("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Test Email Failed",
        description: error.message,
      });
    },
  });

  // Trigger expiry check mutation
  const triggerCheckMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/notifications/trigger-expiry-check', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to trigger expiry check');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Expiry Check Completed",
        description: `Processed ${data.results.processed} notifications. ${data.results.successful} sent, ${data.results.failed} failed.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Check Failed",
        description: error.message,
      });
    },
  });

  const handleSettingUpdate = (key: keyof NotificationSettings, value: any) => {
    if (!settings) return;
    
    const updatedSettings = {
      ...settings,
      [key]: value,
    };
    
    updateMutation.mutate({ [key]: value });
  };

  const handleTestEmail = () => {
    if (!testEmail) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter an email address to test.",
      });
      return;
    }
    
    testEmailMutation.mutate(testEmail);
  };

  if (settingsLoading) {
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
      {/* Email Configuration */}
      <Card data-testid="card-email-config">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Email Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="admin-email">Admin Email</Label>
            <Input
              id="admin-email"
              type="email"
              value={settings?.admin_email || ""}
              onChange={(e) => handleSettingUpdate('admin_email', e.target.value)}
              placeholder="admin@example.com"
              data-testid="input-admin-email"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Email address for admin alerts and notifications
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Switch
              checked={settings?.admin_alerts_enabled || false}
              onCheckedChange={(checked) => handleSettingUpdate('admin_alerts_enabled', checked)}
              data-testid="switch-admin-alerts"
            />
            <Label htmlFor="admin-alerts">Enable Admin Alerts</Label>
          </div>

          <div className="border-t pt-4">
            <Label htmlFor="test-email">Test Email Configuration</Label>
            <div className="flex space-x-2 mt-2">
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                data-testid="input-test-email"
              />
              <Button
                onClick={handleTestEmail}
                disabled={testEmailMutation.isPending}
                data-testid="button-test-email"
              >
                <Send className="h-4 w-4 mr-2" />
                {testEmailMutation.isPending ? 'Sending...' : 'Test'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expiry Notifications */}
      <Card data-testid="card-expiry-notifications">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>Expiry Notifications</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="warning-days">Warning Days</Label>
            <Input
              id="warning-days"
              type="number"
              min="1"
              max="30"
              value={settings?.access_expiry_warning_days || 7}
              onChange={(e) => handleSettingUpdate('access_expiry_warning_days', parseInt(e.target.value))}
              data-testid="input-warning-days"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Send warning emails this many days before access expires
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Switch
              checked={settings?.daily_notifications_enabled || false}
              onCheckedChange={(checked) => handleSettingUpdate('daily_notifications_enabled', checked)}
              data-testid="switch-daily-notifications"
            />
            <Label htmlFor="daily-notifications">Enable Daily Notification Checks</Label>
          </div>

          <div>
            <Label htmlFor="notification-time">Daily Check Time</Label>
            <Input
              id="notification-time"
              type="time"
              value={settings?.notification_time || "09:00"}
              onChange={(e) => handleSettingUpdate('notification_time', e.target.value)}
              data-testid="input-notification-time"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Time of day to run automatic expiry checks
            </p>
          </div>

          <div className="border-t pt-4">
            <Button
              onClick={() => triggerCheckMutation.mutate()}
              disabled={triggerCheckMutation.isPending}
              variant="outline"
              data-testid="button-trigger-check"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {triggerCheckMutation.isPending ? 'Checking...' : 'Run Expiry Check Now'}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Manually trigger expiry notification check
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notification Status */}
      <Card data-testid="card-notification-status">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notification Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Badge variant={settings?.admin_alerts_enabled ? "default" : "secondary"}>
                {settings?.admin_alerts_enabled ? "Enabled" : "Disabled"}
              </Badge>
              <span className="text-sm">Admin Alerts</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant={settings?.daily_notifications_enabled ? "default" : "secondary"}>
                {settings?.daily_notifications_enabled ? "Enabled" : "Disabled"}
              </Badge>
              <span className="text-sm">Daily Checks</span>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>
                Next check scheduled for: {settings?.notification_time || '09:00'} daily
              </span>
            </div>
            <div className="mt-1">
              Warning period: {settings?.access_expiry_warning_days || 7} days before expiry
            </div>
          </div>

          {settings?.admin_email && (
            <div className="text-sm">
              <strong>Admin Email:</strong> {settings.admin_email}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}