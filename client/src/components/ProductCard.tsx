import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import OTPModal from "./OTPModal";

interface ProductCardProps {
  product: any;
  user: User;
}

export default function ProductCard({ product, user }: ProductCardProps) {
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpData, setOtpData] = useState<any>(null);
  const { toast } = useToast();

  const getOtpMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`/api/get-otp/${product.slug}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to get OTP');
      }

      return data;
    },
    onSuccess: (data) => {
      setOtpData(data);
      setShowOtpModal(true);
    },
    onError: (error: Error) => {
      if (error.message.includes('rate_limited')) {
        toast({
          variant: "destructive",
          title: "Rate Limited",
          description: "Too many requests. Please try again in a moment.",
        });
      } else if (error.message.includes('otp_not_found')) {
        toast({
          variant: "destructive",
          title: "No OTP Found",
          description: "No recent OTP found in configured email accounts.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      }
    },
  });

  const handleGetOtp = () => {
    getOtpMutation.mutate();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Copied to clipboard!",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy to clipboard",
      });
    }
  };

  const getStatusColor = () => {
    if (!product.expires_at) return "default";
    const expiryDate = new Date(product.expires_at);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 1) return "destructive";
    if (daysUntilExpiry <= 7) return "secondary";
    return "default";
  };

  const getStatusText = () => {
    if (!product.expires_at) return "Never expires";
    const expiryDate = new Date(product.expires_at);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 0) return "Expired";
    if (daysUntilExpiry === 1) return "Expires tomorrow";
    if (daysUntilExpiry <= 7) return `Expires in ${daysUntilExpiry} days`;
    return expiryDate.toLocaleDateString();
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow" data-testid={`card-product-${product.id}`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground" data-testid={`text-product-title-${product.id}`}>
                {product.title}
              </h3>
              <p className="text-sm text-muted-foreground" data-testid={`text-product-description-${product.id}`}>
                {product.description}
              </p>
            </div>
            <Badge variant={getStatusColor()} data-testid={`badge-status-${product.id}`}>
              Active
            </Badge>
          </div>
          
          {/* Credentials Section */}
          {product.credentials && product.credentials.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-foreground mb-3">Login Credentials</h4>
              {product.credentials.map((credential: any) => (
                <div key={credential.id} className="space-y-2">
                  {credential.login_email && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Email:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono text-foreground" data-testid={`text-email-${credential.id}`}>
                          {credential.login_email}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 text-muted-foreground hover:text-foreground"
                          onClick={() => copyToClipboard(credential.login_email)}
                          data-testid={`button-copy-email-${credential.id}`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  )}
                  {credential.login_username && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Username:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono text-foreground" data-testid={`text-username-${credential.id}`}>
                          {credential.login_username}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 text-muted-foreground hover:text-foreground"
                          onClick={() => copyToClipboard(credential.login_username)}
                          data-testid={`button-copy-username-${credential.id}`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  )}
                  {credential.login_password && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Password:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono text-foreground">••••••••</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 text-muted-foreground hover:text-foreground"
                          onClick={() => copyToClipboard(credential.login_password)}
                          data-testid={`button-copy-password-${credential.id}`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Access Info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-muted-foreground" data-testid={`text-expiry-${product.id}`}>
                Expires: {getStatusText()}
              </span>
            </div>
          </div>
          
          {/* Get OTP Button */}
          <Button 
            onClick={handleGetOtp}
            disabled={getOtpMutation.isPending}
            className="w-full"
            data-testid={`button-get-otp-${product.id}`}
          >
            {getOtpMutation.isPending ? "Getting OTP..." : "Get OTP"}
          </Button>
        </CardContent>
      </Card>

      <OTPModal 
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        otpData={otpData}
        product={product}
        onRefresh={handleGetOtp}
      />
    </>
  );
}
