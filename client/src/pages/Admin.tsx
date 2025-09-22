import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
// Removed Tabs import - using custom implementation
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import BulkUserManagement from "@/components/BulkUserManagement";
import NotificationSettings from "@/components/NotificationSettings";
import AuditLogs from "@/components/AuditLogs";

interface AdminProps {
  user: User;
}

export default function Admin({ user }: AdminProps) {
  const { toast } = useToast();
  const [productForm, setProductForm] = useState(() => {
    const stored = localStorage.getItem('productForm');
    return stored ? JSON.parse(stored) : {
      slug: '',
      title: '',
      description: '',
      is_active: true,
    };
  });

  const [accountForm, setAccountForm] = useState(() => {
    const stored = localStorage.getItem('accountForm');
    return stored ? JSON.parse(stored) : {
      label: '',
      imap_host: '',
      imap_port: 993,
      imap_user: '',
      imap_password: '',
      otp_regex: '\\b\\d{6}\\b',
      fetch_from_filter: '',
      is_active: true,
      priority: 100,
    };
  });

  const [mappingForm, setMappingForm] = useState(() => {
    const stored = localStorage.getItem('mappingForm');
    return stored ? JSON.parse(stored) : {
      product_id: '',
      account_id: '',
      is_active: true,
      sender_override: '',
      otp_regex_override: '',
      weight: 100,
    };
  });

  const [credentialForm, setCredentialForm] = useState(() => {
    const stored = localStorage.getItem('credentialForm');
    return stored ? JSON.parse(stored) : {
      product_id: '',
      label: 'Default',
      login_email: '',
      login_username: '',
      login_password: '',
      notes: '',
      is_active: true,
    };
  });

  const [userAccessForm, setUserAccessForm] = useState(() => {
    const stored = localStorage.getItem('userAccessForm');
    return stored ? JSON.parse(stored) : {
      user_email: '',
      product_id: '',
      expires_at: '',
    };
  });

  const [totpForm, setTotpForm] = useState({
    product_id: '',
    secret_base32: '',
    issuer: '',
    account_label: '',
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
    is_active: true,
  });

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'product' | 'account' | 'mapping' | 'credential' | 'user-access' | 'totp' | null;
    item: any;
  }>({
    isOpen: false,
    type: null,
    item: null,
  });

  // Tab state management - persist across remounts
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.slice(1);
    const stored = localStorage.getItem('adminTab');
    return hash || stored || 'products';
  });

  // Sync tab changes to URL hash and localStorage
  useEffect(() => {
    if (activeTab) {
      history.replaceState(null, '', `#${activeTab}`);
      localStorage.setItem('adminTab', activeTab);
    }
  }, [activeTab]);

  // Listen for external hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const newTab = window.location.hash.slice(1) || 'products';
      setActiveTab(newTab);
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Persist form data across remounts
  useEffect(() => {
    localStorage.setItem('productForm', JSON.stringify(productForm));
  }, [productForm]);

  useEffect(() => {
    localStorage.setItem('accountForm', JSON.stringify(accountForm));
  }, [accountForm]);

  useEffect(() => {
    localStorage.setItem('mappingForm', JSON.stringify(mappingForm));
  }, [mappingForm]);

  useEffect(() => {
    localStorage.setItem('credentialForm', JSON.stringify(credentialForm));
  }, [credentialForm]);

  useEffect(() => {
    localStorage.setItem('userAccessForm', JSON.stringify(userAccessForm));
  }, [userAccessForm]);

  // SECURITY: Never persist TOTP secrets to localStorage

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['/api/admin/products'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/products', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

  // Fetch accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['/api/admin/accounts'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/accounts', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch accounts');
      return response.json();
    },
  });

  // Fetch mappings
  const { data: mappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ['/api/admin/mappings'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/mappings', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch mappings');
      return response.json();
    },
  });

  // Fetch credentials
  const { data: credentials, isLoading: credentialsLoading } = useQuery({
    queryKey: ['/api/admin/credentials'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/credentials', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch credentials');
      return response.json();
    },
  });

  // Fetch user access
  const { data: userAccess, isLoading: userAccessLoading, isError: userAccessError, refetch: refetchUserAccess } = useQuery({
    queryKey: ['/api/admin/user-access'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/user-access', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch user access');
      return response.json();
    },
  });

  // Fetch TOTP configurations
  const { data: totpConfigs, isLoading: totpLoading } = useQuery({
    queryKey: ['/api/admin/totp'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/totp', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch TOTP configurations');
      return response.json();
    },
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: typeof productForm) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create product');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product created successfully",
      });
      setProductForm({
        slug: '',
        title: '',
        description: '',
        is_active: true,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Create account mutation
  const createAccountMutation = useMutation({
    mutationFn: async (data: typeof accountForm) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create account');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Account created successfully",
      });
      setAccountForm({
        label: '',
        imap_host: '',
        imap_port: 993,
        imap_user: '',
        imap_password: '',
        otp_regex: '\\b\\d{6}\\b',
        fetch_from_filter: '',
        is_active: true,
        priority: 100,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounts'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Create mapping mutation
  const createMappingMutation = useMutation({
    mutationFn: async (data: typeof mappingForm) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create mapping');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product-Account mapping created successfully",
      });
      setMappingForm({
        product_id: '',
        account_id: '',
        is_active: true,
        sender_override: '',
        otp_regex_override: '',
        weight: 100,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Create credential mutation
  const createCredentialMutation = useMutation({
    mutationFn: async (data: typeof credentialForm) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/credential', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create credential');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product credential created successfully",
      });
      setCredentialForm({
        product_id: '',
        label: 'Default',
        login_email: '',
        login_username: '',
        login_password: '',
        notes: '',
        is_active: true,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Create user access mutation
  const createUserAccessMutation = useMutation({
    mutationFn: async (data: typeof userAccessForm) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/user-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user access');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User access granted successfully",
      });
      setUserAccessForm({
        user_id: '',
        product_id: '',
        expires_at: '',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Delete TOTP configuration mutation
  const deleteTotpMutation = useMutation({
    mutationFn: async (product_id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`/api/admin/totp/product/${product_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete TOTP configuration');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "TOTP configuration deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/totp'] });
      setDeleteConfirm({ isOpen: false, type: null, item: null });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error.message,
      });
    },
  });

  // Revoke user access mutation
  const revokeUserAccessMutation = useMutation({
    mutationFn: async ({ user_id, product_id }: { user_id: string; product_id: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/bulk-access/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_ids: [user_id], product_id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to revoke access');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/user-access'] });
      toast({
        title: "Success",
        description: "User access revoked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Create TOTP configuration mutation
  const createTotpMutation = useMutation({
    mutationFn: async (data: typeof totpForm) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/totp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create TOTP configuration');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "TOTP configuration created successfully",
      });
      // Clear form including sensitive secret
      setTotpForm({
        product_id: '',
        secret_base32: '',
        issuer: '',
        account_label: '',
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
        is_active: true,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/totp'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Delete mutations
  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`/api/admin/product/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete product');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
      setDeleteConfirm({ isOpen: false, type: null, item: null });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`/api/admin/account/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete account');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounts'] });
      toast({
        title: "Success",
        description: "Account deleted successfully",
      });
      setDeleteConfirm({ isOpen: false, type: null, item: null });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`/api/admin/mapping/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete mapping');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mappings'] });
      toast({
        title: "Success",
        description: "Mapping deleted successfully",
      });
      setDeleteConfirm({ isOpen: false, type: null, item: null });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteCredentialMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`/api/admin/credential/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete credential');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credentials'] });
      toast({
        title: "Success",
        description: "Credential deleted successfully",
      });
      setDeleteConfirm({ isOpen: false, type: null, item: null });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteUserAccessMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`/api/admin/user-access/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to revoke user access');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/user-access'] });
      toast({
        title: "Success",
        description: "User access revoked successfully",
      });
      setDeleteConfirm({ isOpen: false, type: null, item: null });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProductMutation.mutate(productForm, {
      onSuccess: () => {
        localStorage.removeItem('productForm');
        setProductForm({
          slug: '',
          title: '',
          description: '',
          is_active: true,
        });
      },
    });
  };

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAccountMutation.mutate(accountForm, {
      onSuccess: () => {
        // Clear form data from localStorage after successful submission
        localStorage.removeItem('accountForm');
        setAccountForm({
          label: '',
          imap_host: '',
          imap_port: 993,
          imap_user: '',
          imap_password: '',
          otp_regex: '\\b\\d{6}\\b',
          fetch_from_filter: '',
          is_active: true,
          priority: 100,
        });
      },
    });
  };

  const handleMappingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMappingMutation.mutate(mappingForm, {
      onSuccess: () => {
        localStorage.removeItem('mappingForm');
        setMappingForm({
          product_id: '',
          account_id: '',
          is_active: true,
          sender_override: '',
          otp_regex_override: '',
          weight: 100,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/mappings'] });
        toast({
          title: "Success",
          description: "Mapping created successfully",
        });
      },
    });
  };

  const handleCredentialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCredentialMutation.mutate(credentialForm, {
      onSuccess: () => {
        localStorage.removeItem('credentialForm');
        setCredentialForm({
          product_id: '',
          label: 'Default',
          login_email: '',
          login_username: '',
          login_password: '',
          notes: '',
          is_active: true,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/credentials'] });
        toast({
          title: "Success",
          description: "Credential created successfully",
        });
      },
    });
  };

  const handleUserAccessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUserAccessMutation.mutate(userAccessForm, {
      onSuccess: () => {
        localStorage.removeItem('userAccessForm');
        setUserAccessForm({
          user_email: '',
          product_id: '',
          expires_at: '',
        });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/user-access'] });
        toast({
          title: "Success",
          description: "User access granted successfully",
        });
      },
      onError: (error: Error) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      },
    });
  };

  const handleTotpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTotpMutation.mutate(totpForm);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground">Admin Panel</h2>
        <p className="text-muted-foreground mt-1">Manage products, accounts, and user access</p>
      </div>

      <div className="space-y-6">
        {/* Custom Tab Navigation */}
        <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          {[
            { id: "products", label: "Products" },
            { id: "accounts", label: "Accounts" },
            { id: "mappings", label: "Mappings" },
            { id: "credentials", label: "Credentials" },
            { id: "totp", label: "2FA (TOTP)" },
            { id: "users", label: "User Access" },
            { id: "bulk", label: "Bulk Management" },
            { id: "notifications", label: "Notifications" },
            { id: "audit", label: "Audit Logs" },
            { id: "analytics", label: "Analytics" }
          ].map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:bg-background/50"
              }`}
              tabIndex={-1}
              onKeyDown={(e) => e.preventDefault()}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Products Tab */}
        {activeTab === "products" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create Product Form */}
            <Card>
              <CardHeader>
                <CardTitle>Create Product</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProductSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={productForm.slug}
                      onChange={(e) => setProductForm({...productForm, slug: e.target.value})}
                      placeholder="gmail-business"
                      required
                      data-testid="input-product-slug"
                    />
                  </div>
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={productForm.title}
                      onChange={(e) => setProductForm({...productForm, title: e.target.value})}
                      placeholder="Gmail Business"
                      required
                      data-testid="input-product-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={productForm.description}
                      onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                      placeholder="Business Gmail accounts for the marketing team"
                      rows={3}
                      data-testid="input-product-description"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_active"
                      checked={productForm.is_active}
                      onCheckedChange={(checked) => setProductForm({...productForm, is_active: !!checked})}
                      data-testid="checkbox-product-active"
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={createProductMutation.isPending}
                    data-testid="button-create-product"
                  >
                    {createProductMutation.isPending ? 'Creating...' : 'Create Product'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Products List */}
            <Card>
              <CardHeader>
                <CardTitle>Existing Products</CardTitle>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
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
                    {products?.map((product: any) => (
                      <div key={product.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                        <div>
                          <p className="font-medium text-foreground" data-testid={`text-product-title-${product.id}`}>{product.title}</p>
                          <p className="text-sm text-muted-foreground" data-testid={`text-product-slug-${product.id}`}>{product.slug}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={product.is_active ? "default" : "secondary"}>
                            {product.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteConfirm({ isOpen: true, type: 'product', item: product })}
                            data-testid={`button-delete-product-${product.id}`}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* Accounts Tab */}
        {activeTab === "accounts" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create Account Form */}
            <Card>
              <CardHeader>
                <CardTitle>Create IMAP Account</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAccountSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="account-label">Label</Label>
                    <Input
                      id="account-label"
                      value={accountForm.label}
                      onChange={(e) => setAccountForm({...accountForm, label: e.target.value})}
                      placeholder="Gmail Marketing"
                      required
                      data-testid="input-account-label"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="imap-host">IMAP Host</Label>
                      <Input
                        id="imap-host"
                        value={accountForm.imap_host}
                        onChange={(e) => setAccountForm({...accountForm, imap_host: e.target.value})}
                        placeholder="imap.gmail.com"
                        required
                        data-testid="input-imap-host"
                      />
                    </div>
                    <div>
                      <Label htmlFor="imap-port">Port</Label>
                      <Input
                        id="imap-port"
                        type="number"
                        value={accountForm.imap_port}
                        onChange={(e) => setAccountForm({...accountForm, imap_port: parseInt(e.target.value)})}
                        placeholder="993"
                        required
                        data-testid="input-imap-port"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="imap-user">IMAP User</Label>
                    <Input
                      id="imap-user"
                      type="email"
                      value={accountForm.imap_user}
                      onChange={(e) => setAccountForm({...accountForm, imap_user: e.target.value})}
                      placeholder="marketing@company.com"
                      required
                      data-testid="input-imap-user"
                    />
                  </div>
                  <div>
                    <Label htmlFor="imap-password">IMAP Password</Label>
                    <Input
                      id="imap-password"
                      type="password"
                      value={accountForm.imap_password}
                      onChange={(e) => setAccountForm({...accountForm, imap_password: e.target.value})}
                      placeholder="••••••••••••"
                      required
                      data-testid="input-imap-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="otp-regex">OTP Regex</Label>
                    <Input
                      id="otp-regex"
                      value={accountForm.otp_regex}
                      onChange={(e) => setAccountForm({...accountForm, otp_regex: e.target.value})}
                      placeholder="\b\d{6}\b"
                      data-testid="input-otp-regex"
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Input
                      id="priority"
                      type="number"
                      value={accountForm.priority}
                      onChange={(e) => setAccountForm({...accountForm, priority: parseInt(e.target.value)})}
                      placeholder="100"
                      data-testid="input-priority"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="account_active"
                      checked={accountForm.is_active}
                      onCheckedChange={(checked) => setAccountForm({...accountForm, is_active: !!checked})}
                      data-testid="checkbox-account-active"
                    />
                    <Label htmlFor="account_active">Active</Label>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={createAccountMutation.isPending}
                    data-testid="button-create-account"
                  >
                    {createAccountMutation.isPending ? 'Creating...' : 'Create Account'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Accounts List */}
            <Card>
              <CardHeader>
                <CardTitle>IMAP Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                {accountsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse p-3 border border-border rounded-md">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2 mb-1"></div>
                        <div className="h-3 bg-muted rounded w-2/3"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {accounts?.map((account: any) => (
                      <div key={account.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                        <div>
                          <p className="font-medium text-foreground" data-testid={`text-account-label-${account.id}`}>{account.label}</p>
                          <p className="text-sm text-muted-foreground" data-testid={`text-account-host-${account.id}`}>{account.imap_host}:{account.imap_port}</p>
                          <p className="text-sm text-muted-foreground" data-testid={`text-account-user-${account.id}`}>{account.imap_user}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={account.is_active ? "default" : "secondary"}>
                            {account.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteConfirm({ isOpen: true, type: 'account', item: account })}
                            data-testid={`button-delete-account-${account.id}`}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* Mappings Tab */}
        {activeTab === "mappings" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create Mapping Form */}
            <Card>
              <CardHeader>
                <CardTitle>Create Product-Account Mapping</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleMappingSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="mapping-product">Product</Label>
                    <Select value={mappingForm.product_id} onValueChange={(value) => setMappingForm({...mappingForm, product_id: value})}>
                      <SelectTrigger data-testid="select-mapping-product">
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map((product: any) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.title} ({product.slug})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="mapping-account">IMAP Account</Label>
                    <Select value={mappingForm.account_id} onValueChange={(value) => setMappingForm({...mappingForm, account_id: value})}>
                      <SelectTrigger data-testid="select-mapping-account">
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map((account: any) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.label} ({account.imap_host})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="weight">Weight (Priority)</Label>
                      <Input
                        id="weight"
                        type="number"
                        value={mappingForm.weight}
                        onChange={(e) => setMappingForm({...mappingForm, weight: parseInt(e.target.value)})}
                        placeholder="100"
                        data-testid="input-mapping-weight"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sender-override">Sender Override (optional)</Label>
                    <Input
                      id="sender-override"
                      value={mappingForm.sender_override}
                      onChange={(e) => setMappingForm({...mappingForm, sender_override: e.target.value})}
                      placeholder="noreply@example.com"
                      data-testid="input-sender-override"
                    />
                  </div>
                  <div>
                    <Label htmlFor="regex-override">OTP Regex Override (optional)</Label>
                    <Input
                      id="regex-override"
                      value={mappingForm.otp_regex_override}
                      onChange={(e) => setMappingForm({...mappingForm, otp_regex_override: e.target.value})}
                      placeholder="\b\d{6}\b"
                      data-testid="input-regex-override"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="mapping_active"
                      checked={mappingForm.is_active}
                      onCheckedChange={(checked) => setMappingForm({...mappingForm, is_active: !!checked})}
                      data-testid="checkbox-mapping-active"
                    />
                    <Label htmlFor="mapping_active">Active</Label>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={createMappingMutation.isPending || !mappingForm.product_id || !mappingForm.account_id}
                    data-testid="button-create-mapping"
                  >
                    {createMappingMutation.isPending ? 'Creating...' : 'Create Mapping'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Existing Mappings List */}
            <Card>
              <CardHeader>
                <CardTitle>Existing Mappings</CardTitle>
              </CardHeader>
              <CardContent>
                {mappingsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse p-3 border border-border rounded-md">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2 mb-1"></div>
                        <div className="h-3 bg-muted rounded w-2/3"></div>
                      </div>
                    ))}
                  </div>
                ) : mappings && mappings.length > 0 ? (
                  <div className="space-y-3">
                    {mappings.map((mapping: any) => (
                      <div key={mapping.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                        <div>
                          <p className="font-medium text-foreground" data-testid={`text-mapping-product-${mapping.id}`}>
                            {mapping.products?.title || 'Unknown Product'}
                          </p>
                          <p className="text-sm text-muted-foreground" data-testid={`text-mapping-account-${mapping.id}`}>
                            {mapping.accounts?.label || 'Unknown Account'}
                          </p>
                          <p className="text-xs text-muted-foreground">Weight: {mapping.weight}</p>
                          {mapping.sender_override && (
                            <p className="text-xs text-muted-foreground">Sender: {mapping.sender_override}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={mapping.is_active ? "default" : "secondary"}>
                            {mapping.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteConfirm({ isOpen: true, type: 'mapping', item: mapping })}
                            data-testid={`button-delete-mapping-${mapping.id}`}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No mappings created yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* Credentials Tab */}
        {activeTab === "credentials" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create Credential Form */}
            <Card>
              <CardHeader>
                <CardTitle>Create Product Credential</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCredentialSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="credential-product">Product</Label>
                    <Select value={credentialForm.product_id} onValueChange={(value) => setCredentialForm({...credentialForm, product_id: value})}>
                      <SelectTrigger data-testid="select-credential-product">
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map((product: any) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.title} ({product.slug})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="credential-label">Label</Label>
                    <Input
                      id="credential-label"
                      value={credentialForm.label}
                      onChange={(e) => setCredentialForm({...credentialForm, label: e.target.value})}
                      placeholder="Default"
                      required
                      data-testid="input-credential-label"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-email">Login Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={credentialForm.login_email}
                      onChange={(e) => setCredentialForm({...credentialForm, login_email: e.target.value})}
                      placeholder="user@example.com"
                      data-testid="input-login-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-username">Login Username</Label>
                    <Input
                      id="login-username"
                      value={credentialForm.login_username}
                      onChange={(e) => setCredentialForm({...credentialForm, login_username: e.target.value})}
                      placeholder="username"
                      data-testid="input-login-username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Login Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={credentialForm.login_password}
                      onChange={(e) => setCredentialForm({...credentialForm, login_password: e.target.value})}
                      placeholder="••••••••"
                      data-testid="input-login-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="credential-notes">Notes</Label>
                    <Textarea
                      id="credential-notes"
                      value={credentialForm.notes}
                      onChange={(e) => setCredentialForm({...credentialForm, notes: e.target.value})}
                      placeholder="Additional notes for users"
                      rows={3}
                      data-testid="input-credential-notes"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="credential_active"
                      checked={credentialForm.is_active}
                      onCheckedChange={(checked) => setCredentialForm({...credentialForm, is_active: !!checked})}
                      data-testid="checkbox-credential-active"
                    />
                    <Label htmlFor="credential_active">Active</Label>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={createCredentialMutation.isPending || !credentialForm.product_id}
                    data-testid="button-create-credential"
                  >
                    {createCredentialMutation.isPending ? 'Creating...' : 'Create Credential'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Existing Credentials List */}
            <Card>
              <CardHeader>
                <CardTitle>Existing Credentials</CardTitle>
              </CardHeader>
              <CardContent>
                {credentialsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse p-3 border border-border rounded-md">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2 mb-1"></div>
                        <div className="h-3 bg-muted rounded w-2/3"></div>
                      </div>
                    ))}
                  </div>
                ) : credentials && credentials.length > 0 ? (
                  <div className="space-y-3">
                    {credentials.map((credential: any) => (
                      <div key={credential.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                        <div>
                          <p className="font-medium text-foreground" data-testid={`text-credential-label-${credential.id}`}>
                            {credential.label}
                          </p>
                          <p className="text-sm text-muted-foreground" data-testid={`text-credential-product-${credential.id}`}>
                            {credential.products?.title || 'Unknown Product'}
                          </p>
                          <p className="text-xs text-muted-foreground">{credential.login_email}</p>
                          <p className="text-xs text-muted-foreground">Username: {credential.login_username}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={credential.is_active ? "default" : "secondary"}>
                            {credential.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteConfirm({ isOpen: true, type: 'credential', item: credential })}
                            data-testid={`button-delete-credential-${credential.id}`}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No credentials created yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* TOTP Tab */}
        {activeTab === "totp" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create TOTP Configuration Form */}
            <Card>
              <CardHeader>
                <CardTitle>Create TOTP Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTotpSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="totp-product">Product</Label>
                    <Select value={totpForm.product_id} onValueChange={(value) => setTotpForm({...totpForm, product_id: value})}>
                      <SelectTrigger data-testid="select-totp-product">
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map((product: any) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.title} ({product.slug})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="secret-base32">TOTP Secret (Base32)</Label>
                    <Input
                      id="secret-base32"
                      type="password"
                      value={totpForm.secret_base32}
                      onChange={(e) => setTotpForm({...totpForm, secret_base32: e.target.value})}
                      placeholder="JBSWY3DPEHPK3PXP"
                      required
                      data-testid="input-totp-secret"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Base32-encoded secret from authenticator app setup
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="issuer">Issuer</Label>
                    <Input
                      id="issuer"
                      value={totpForm.issuer}
                      onChange={(e) => setTotpForm({...totpForm, issuer: e.target.value})}
                      placeholder="ByteVault OTP Hub"
                      data-testid="input-totp-issuer"
                    />
                  </div>
                  <div>
                    <Label htmlFor="account-label">Account Label</Label>
                    <Input
                      id="account-label"
                      value={totpForm.account_label}
                      onChange={(e) => setTotpForm({...totpForm, account_label: e.target.value})}
                      placeholder="Gmail Business Account"
                      data-testid="input-totp-label"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="digits">Digits</Label>
                      <Select value={totpForm.digits.toString()} onValueChange={(value) => setTotpForm({...totpForm, digits: parseInt(value)})}>
                        <SelectTrigger data-testid="select-totp-digits">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6">6</SelectItem>
                          <SelectItem value="8">8</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="period">Period (s)</Label>
                      <Select value={totpForm.period.toString()} onValueChange={(value) => setTotpForm({...totpForm, period: parseInt(value)})}>
                        <SelectTrigger data-testid="select-totp-period">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30</SelectItem>
                          <SelectItem value="60">60</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="algorithm">Algorithm</Label>
                      <Select value={totpForm.algorithm} onValueChange={(value) => setTotpForm({...totpForm, algorithm: value})}>
                        <SelectTrigger data-testid="select-totp-algorithm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SHA1">SHA1</SelectItem>
                          <SelectItem value="SHA256">SHA256</SelectItem>
                          <SelectItem value="SHA512">SHA512</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="totp-active"
                      checked={totpForm.is_active}
                      onCheckedChange={(checked) => setTotpForm({...totpForm, is_active: !!checked})}
                      data-testid="checkbox-totp-active"
                    />
                    <Label htmlFor="totp-active">Active</Label>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={createTotpMutation.isPending || !totpForm.product_id || !totpForm.secret_base32}
                    data-testid="button-create-totp"
                  >
                    {createTotpMutation.isPending ? 'Creating...' : 'Create TOTP'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Existing TOTP Configurations List */}
            <Card>
              <CardHeader>
                <CardTitle>Existing TOTP Configurations</CardTitle>
              </CardHeader>
              <CardContent>
                {totpLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse p-3 border border-border rounded-md">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2 mb-1"></div>
                        <div className="h-3 bg-muted rounded w-2/3"></div>
                      </div>
                    ))}
                  </div>
                ) : totpConfigs?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No TOTP configurations found</p>
                ) : (
                  <div className="space-y-3">
                    {totpConfigs?.map((config: any) => (
                      <div key={config.id} className="p-3 border border-border rounded-md">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm" data-testid={`text-totp-issuer-${config.id}`}>{config.issuer || 'No Issuer'}</div>
                            <div className="text-xs text-muted-foreground" data-testid={`text-totp-label-${config.id}`}>{config.account_label || 'No Label'}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {config.digits} digits • {config.period}s period • {config.algorithm}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={config.is_active ? "default" : "secondary"} className="text-xs">
                              {config.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteConfirm({ isOpen: true, type: 'totp', item: config })}
                              data-testid={`button-delete-totp-${config.id}`}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Grant User Access Form */}
            <Card>
              <CardHeader>
                <CardTitle>Grant User Access</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUserAccessSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="user-email">User Email</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={userAccessForm.user_email}
                      onChange={(e) => setUserAccessForm({...userAccessForm, user_email: e.target.value})}
                      placeholder="user@example.com"
                      required
                      data-testid="input-user-email"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the user's email address from Supabase Auth
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="access-product">Product</Label>
                    <Select value={userAccessForm.product_id} onValueChange={(value) => setUserAccessForm({...userAccessForm, product_id: value})}>
                      <SelectTrigger data-testid="select-access-product">
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map((product: any) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.title} ({product.slug})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="expires-at">Expires At (optional)</Label>
                    <Input
                      id="expires-at"
                      type="datetime-local"
                      value={userAccessForm.expires_at}
                      onChange={(e) => setUserAccessForm({...userAccessForm, expires_at: e.target.value})}
                      data-testid="input-expires-at"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty for unlimited access
                    </p>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={createUserAccessMutation.isPending || !userAccessForm.user_email || !userAccessForm.product_id}
                    data-testid="button-grant-access"
                  >
                    {createUserAccessMutation.isPending ? 'Granting...' : 'Grant Access'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Existing User Access List */}
            <Card>
              <CardHeader>
                <CardTitle>Existing User Access</CardTitle>
              </CardHeader>
              <CardContent>
                {userAccessLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse p-3 border border-border rounded-md">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2 mb-1"></div>
                        <div className="h-3 bg-muted rounded w-2/3"></div>
                      </div>
                    ))}
                  </div>
                ) : userAccessError ? (
                  <div className="text-center py-8">
                    <p className="text-destructive mb-4">Failed to load user access records</p>
                    <Button 
                      onClick={() => refetchUserAccess()} 
                      variant="outline"
                      data-testid="button-retry-user-access"
                    >
                      Retry
                    </Button>
                  </div>
                ) : userAccess && userAccess.length > 0 ? (
                  <div className="space-y-3">
                    {userAccess.map((access: any) => (
                      <div key={access.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                        <div>
                          <p className="font-medium text-foreground" data-testid={`text-access-user-${access.id}`}>
                            User: {access.user_email || access.user_id}
                          </p>
                          <p className="text-sm text-muted-foreground" data-testid={`text-access-product-${access.id}`}>
                            Product: {access.products?.title || 'Unknown Product'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {access.expires_at ? `Expires: ${new Date(access.expires_at).toLocaleDateString()}` : 'No expiration'}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={access.expires_at && new Date(access.expires_at) < new Date() ? "destructive" : "default"}>
                            {access.expires_at && new Date(access.expires_at) < new Date() ? "Expired" : "Active"}
                          </Badge>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteConfirm({ isOpen: true, type: 'user-access', item: access })}
                            data-testid={`button-revoke-access-${access.id}`}
                          >
                            Revoke
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No user access records yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* Bulk Management Tab */}
        {activeTab === "bulk" && (
        <div className="space-y-6">
          <BulkUserManagement />
        </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
        <div className="space-y-6">
          <NotificationSettings />
        </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === "audit" && (
        <div className="space-y-6">
          <AuditLogs />
        </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
        <div className="space-y-6">
          <AnalyticsDashboard />
        </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && setDeleteConfirm({ isOpen: false, type: null, item: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.type === 'product' && `Are you sure you want to delete the product "${deleteConfirm.item?.title}"? This action cannot be undone and will remove all associated mappings, credentials, and user access.`}
              {deleteConfirm.type === 'account' && `Are you sure you want to delete the account "${deleteConfirm.item?.label}"? This action cannot be undone and will remove all associated mappings.`}
              {deleteConfirm.type === 'mapping' && `Are you sure you want to delete this product-account mapping? This action cannot be undone.`}
              {deleteConfirm.type === 'credential' && `Are you sure you want to delete the credential "${deleteConfirm.item?.label}"? This action cannot be undone.`}
              {deleteConfirm.type === 'user-access' && `Are you sure you want to revoke access for this user? This action cannot be undone.`}
              {deleteConfirm.type === 'totp' && `Are you sure you want to delete the TOTP configuration "${deleteConfirm.item?.issuer || 'Unknown'}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm.type === 'product') {
                  deleteProductMutation.mutate(deleteConfirm.item.id);
                } else if (deleteConfirm.type === 'account') {
                  deleteAccountMutation.mutate(deleteConfirm.item.id);
                } else if (deleteConfirm.type === 'mapping') {
                  deleteMappingMutation.mutate(deleteConfirm.item.id);
                } else if (deleteConfirm.type === 'credential') {
                  deleteCredentialMutation.mutate(deleteConfirm.item.id);
                } else if (deleteConfirm.type === 'user-access') {
                  deleteUserAccessMutation.mutate(deleteConfirm.item.id);
                } else if (deleteConfirm.type === 'totp') {
                  deleteTotpMutation.mutate(deleteConfirm.item.product_id);
                }
              }}
              disabled={
                deleteProductMutation.isPending || 
                deleteAccountMutation.isPending || 
                deleteMappingMutation.isPending || 
                deleteCredentialMutation.isPending || 
                deleteUserAccessMutation.isPending ||
                deleteTotpMutation.isPending
              }
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {
                deleteProductMutation.isPending || 
                deleteAccountMutation.isPending || 
                deleteMappingMutation.isPending || 
                deleteCredentialMutation.isPending || 
                deleteUserAccessMutation.isPending ||
                deleteTotpMutation.isPending
                  ? 'Deleting...' 
                  : 'Delete'
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
