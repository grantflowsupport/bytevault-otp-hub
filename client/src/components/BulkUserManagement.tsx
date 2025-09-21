import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Upload, Download, UserPlus, UserMinus, Calendar, FileText } from "lucide-react";

interface ParsedUser {
  user_id: string;
  email: string;
  custom_expires_at?: string;
}

interface UserAccess {
  id: string;
  user_id: string;
  product_id: string;
  expires_at: string | null;
  created_at: string;
  products: {
    title: string;
    slug: string;
  };
}

export default function BulkUserManagement() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedProduct, setSelectedProduct] = useState("");
  const [defaultExpiresAt, setDefaultExpiresAt] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkExpiresAt, setBulkExpiresAt] = useState("");

  // Fetch products for selection
  const { data: products } = useQuery({
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

  // Fetch user access data
  const { data: userAccess, isLoading: userAccessLoading, refetch: refetchUserAccess } = useQuery({
    queryKey: ['/api/admin/user-access', selectedProduct],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const url = selectedProduct 
        ? `/api/admin/user-access?product_id=${selectedProduct}&limit=200`
        : '/api/admin/user-access?limit=200';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch user access');
      return response.json();
    },
    enabled: !!selectedProduct,
  });

  // CSV import mutation
  const importMutation = useMutation({
    mutationFn: async ({ users, product_id, expires_at }: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/bulk-access/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users, product_id, expires_at }),
      });

      if (!response.ok) throw new Error('Failed to import users');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import Completed",
        description: `${data.successful.length} users added successfully. ${data.failed.length} failed.`,
      });
      setParsedUsers([]);
      setCsvContent("");
      refetchUserAccess();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message,
      });
    },
  });

  // Bulk revoke mutation
  const revokeMutation = useMutation({
    mutationFn: async ({ user_ids, product_id }: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/bulk-access/revoke', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_ids, product_id }),
      });

      if (!response.ok) throw new Error('Failed to revoke access');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Access Revoked",
        description: `Revoked access for ${data.revoked_count} users.`,
      });
      setSelectedUsers([]);
      refetchUserAccess();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Revoke Failed",
        description: error.message,
      });
    },
  });

  // Bulk update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ access_ids, expires_at }: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/admin/bulk-access/update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_ids, expires_at }),
      });

      if (!response.ok) throw new Error('Failed to update access');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Access Updated",
        description: `Updated ${data.updated_count} user access records.`,
      });
      setSelectedUsers([]);
      setBulkExpiresAt("");
      refetchUserAccess();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message,
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      parseCSV(content);
    };
    reader.readAsText(file);
  };

  const parseCSV = (content: string) => {
    try {
      const lines = content.trim().split('\n');
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
      
      const users: ParsedUser[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const user: any = {};
        
        headers.forEach((header, index) => {
          if (values[index]) {
            if (header.includes('user_id') || header.includes('userid')) {
              user.user_id = values[index];
            } else if (header.includes('email')) {
              user.email = values[index];
            } else if (header.includes('expires')) {
              user.custom_expires_at = values[index];
            }
          }
        });
        
        if (user.user_id || user.email) {
          users.push({
            user_id: user.user_id || user.email,
            email: user.email || user.user_id,
            custom_expires_at: user.custom_expires_at,
          });
        }
      }
      
      setParsedUsers(users);
      toast({
        title: "CSV Parsed",
        description: `Found ${users.length} users in CSV file.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Parse Error",
        description: "Failed to parse CSV file. Please check the format.",
      });
    }
  };

  const handleExport = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const url = selectedProduct 
        ? `/api/admin/bulk-access/export?product_id=${selectedProduct}`
        : '/api/admin/bulk-access/export';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to export data');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'user_access_export.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Export Successful",
        description: "User access data exported successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export user access data.",
      });
    }
  };

  const handleImport = () => {
    if (!selectedProduct || parsedUsers.length === 0) {
      toast({
        variant: "destructive",
        title: "Missing Data",
        description: "Please select a product and upload a CSV file.",
      });
      return;
    }

    importMutation.mutate({
      users: parsedUsers,
      product_id: selectedProduct,
      expires_at: defaultExpiresAt || null,
    });
  };

  const handleBulkRevoke = () => {
    if (!selectedProduct || selectedUsers.length === 0) {
      toast({
        variant: "destructive",
        title: "No Selection",
        description: "Please select users to revoke access.",
      });
      return;
    }

    revokeMutation.mutate({
      user_ids: selectedUsers,
      product_id: selectedProduct,
    });
  };

  const handleBulkUpdate = () => {
    if (selectedUsers.length === 0) {
      toast({
        variant: "destructive",
        title: "No Selection",
        description: "Please select users to update.",
      });
      return;
    }

    // Get access IDs for selected users
    const accessIds = userAccess
      ?.filter((access: UserAccess) => selectedUsers.includes(access.user_id))
      .map((access: UserAccess) => access.id) || [];

    updateMutation.mutate({
      access_ids: accessIds,
      expires_at: bulkExpiresAt || null,
    });
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === userAccess?.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(userAccess?.map((access: UserAccess) => access.user_id) || []);
    }
  };

  return (
    <div className="space-y-6">
      {/* Product Selection */}
      <Card data-testid="card-product-selection">
        <CardHeader>
          <CardTitle>Select Product</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger data-testid="select-bulk-product">
              <SelectValue placeholder="Select a product for bulk operations" />
            </SelectTrigger>
            <SelectContent>
              {products?.map((product: any) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.title} ({product.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV Import */}
        <Card data-testid="card-csv-import">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>CSV Import</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="csv-file">Upload CSV File</Label>
              <Input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                data-testid="input-csv-file"
              />
              <p className="text-xs text-muted-foreground mt-1">
                CSV should have columns: user_id, email, expires_at (optional)
              </p>
            </div>
            
            <div>
              <Label htmlFor="default-expires">Default Expires At (optional)</Label>
              <Input
                id="default-expires"
                type="datetime-local"
                value={defaultExpiresAt}
                onChange={(e) => setDefaultExpiresAt(e.target.value)}
                data-testid="input-default-expires"
              />
            </div>

            {parsedUsers.length > 0 && (
              <div>
                <Label>Parsed Users ({parsedUsers.length})</Label>
                <div className="max-h-32 overflow-y-auto border border-border rounded p-2 text-sm">
                  {parsedUsers.slice(0, 10).map((user, index) => (
                    <div key={index} className="text-muted-foreground">
                      {user.email} ({user.user_id})
                    </div>
                  ))}
                  {parsedUsers.length > 10 && (
                    <div className="text-muted-foreground">
                      ... and {parsedUsers.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button 
              onClick={handleImport}
              disabled={!selectedProduct || parsedUsers.length === 0 || importMutation.isPending}
              className="w-full"
              data-testid="button-import-csv"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {importMutation.isPending ? 'Importing...' : 'Import Users'}
            </Button>
          </CardContent>
        </Card>

        {/* CSV Export */}
        <Card data-testid="card-csv-export">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="h-5 w-5" />
              <span>CSV Export</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Export User Access Data</Label>
              <p className="text-sm text-muted-foreground">
                Export user access data for the selected product as CSV
              </p>
            </div>

            <Button 
              onClick={handleExport}
              disabled={!selectedProduct}
              className="w-full"
              data-testid="button-export-csv"
            >
              <FileText className="h-4 w-4 mr-2" />
              Export to CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* User Access Management */}
      {selectedProduct && (
        <Card data-testid="card-user-management">
          <CardHeader>
            <CardTitle>User Access Management</CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                onClick={selectAllUsers}
                variant="outline"
                size="sm"
                data-testid="button-select-all"
              >
                {selectedUsers.length === userAccess?.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Badge variant="outline">
                {selectedUsers.length} selected
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bulk Actions */}
            <div className="flex items-center space-x-2 p-4 border border-border rounded-md">
              <div className="flex-1 space-y-2">
                <Label htmlFor="bulk-expires">Bulk Update Expires At</Label>
                <Input
                  id="bulk-expires"
                  type="datetime-local"
                  value={bulkExpiresAt}
                  onChange={(e) => setBulkExpiresAt(e.target.value)}
                  data-testid="input-bulk-expires"
                />
              </div>
              <div className="space-y-2">
                <Button
                  onClick={handleBulkUpdate}
                  disabled={selectedUsers.length === 0 || updateMutation.isPending}
                  size="sm"
                  data-testid="button-bulk-update"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
                <Button
                  onClick={handleBulkRevoke}
                  disabled={selectedUsers.length === 0 || revokeMutation.isPending}
                  variant="destructive"
                  size="sm"
                  data-testid="button-bulk-revoke"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  {revokeMutation.isPending ? 'Revoking...' : 'Revoke'}
                </Button>
              </div>
            </div>

            {/* User List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {userAccessLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse p-3 border border-border rounded-md">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : (
                userAccess?.map((access: UserAccess) => (
                  <div key={access.id} className="flex items-center space-x-3 p-3 border border-border rounded-md">
                    <Checkbox
                      checked={selectedUsers.includes(access.user_id)}
                      onCheckedChange={() => toggleUserSelection(access.user_id)}
                      data-testid={`checkbox-user-${access.user_id}`}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-foreground" data-testid={`text-user-${access.user_id}`}>
                        {access.user_id}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Product: {access.products.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expires: {access.expires_at ? new Date(access.expires_at).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                    <Badge variant={access.expires_at && new Date(access.expires_at) < new Date() ? "destructive" : "default"}>
                      {access.expires_at && new Date(access.expires_at) < new Date() ? "Expired" : "Active"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}