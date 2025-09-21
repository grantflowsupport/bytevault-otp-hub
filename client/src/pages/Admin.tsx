import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import BulkUserManagement from "@/components/BulkUserManagement";

interface AdminProps {
  user: User;
}

export default function Admin({ user }: AdminProps) {
  const { toast } = useToast();
  const [productForm, setProductForm] = useState({
    slug: '',
    title: '',
    description: '',
    is_active: true,
  });

  const [accountForm, setAccountForm] = useState({
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

  const [mappingForm, setMappingForm] = useState({
    product_id: '',
    account_id: '',
    is_active: true,
    sender_override: '',
    otp_regex_override: '',
    weight: 100,
  });

  const [credentialForm, setCredentialForm] = useState({
    product_id: '',
    label: 'Default',
    login_email: '',
    login_username: '',
    login_password: '',
    notes: '',
    is_active: true,
  });

  const [userAccessForm, setUserAccessForm] = useState({
    user_id: '',
    product_id: '',
    expires_at: '',
  });

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

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProductMutation.mutate(productForm);
  };

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAccountMutation.mutate(accountForm);
  };

  const handleMappingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMappingMutation.mutate(mappingForm);
  };

  const handleCredentialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCredentialMutation.mutate(credentialForm);
  };

  const handleUserAccessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUserAccessMutation.mutate(userAccessForm);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground">Admin Panel</h2>
        <p className="text-muted-foreground mt-1">Manage products, accounts, and user access</p>
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="mappings">Mappings</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="users">User Access</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Management</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mappings" className="space-y-6">
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
                <p className="text-muted-foreground">Mapping list will be displayed here when API is available.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="credentials" className="space-y-6">
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
                <p className="text-muted-foreground">Credential list will be displayed here when API is available.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Grant User Access Form */}
            <Card>
              <CardHeader>
                <CardTitle>Grant User Access</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUserAccessSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="user-id">User ID</Label>
                    <Input
                      id="user-id"
                      value={userAccessForm.user_id}
                      onChange={(e) => setUserAccessForm({...userAccessForm, user_id: e.target.value})}
                      placeholder="User UUID from Supabase Auth"
                      required
                      data-testid="input-user-id"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Get User UUID from Supabase Auth dashboard
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
                    disabled={createUserAccessMutation.isPending || !userAccessForm.user_id || !userAccessForm.product_id}
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
                <p className="text-muted-foreground">User access list will be displayed here when API is available.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bulk" className="space-y-6">
          <BulkUserManagement />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
