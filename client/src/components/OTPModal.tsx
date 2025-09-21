import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface OTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  otpData: any;
  product: any;
  onRefresh: () => void;
}

export default function OTPModal({ isOpen, onClose, otpData, product, onRefresh }: OTPModalProps) {
  const { toast } = useToast();

  const copyOtp = async () => {
    if (otpData?.otp) {
      try {
        await navigator.clipboard.writeText(otpData.otp);
        toast({
          title: "Copied",
          description: "OTP copied to clipboard!",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to copy OTP",
        });
      }
    }
  };

  const handleRefresh = () => {
    onClose();
    setTimeout(() => onRefresh(), 500);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-otp">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            OTP Retrieved
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-auto p-1"
              data-testid="button-close-modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent/10 rounded-full">
            <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Latest OTP for <span className="font-medium text-foreground" data-testid="text-product-name">{product.title}</span>
            </p>
            
            {/* OTP Display */}
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <div className="text-3xl font-mono font-bold text-foreground mb-2" data-testid="text-otp-code">
                {otpData?.otp || "------"}
              </div>
              <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground">
                <span>From: <span data-testid="text-otp-from">{otpData?.from || "Unknown"}</span></span>
                <span>•</span>
                <span data-testid="text-otp-timestamp">{otpData?.fetched_at ? formatTimestamp(otpData.fetched_at) : "Unknown"}</span>
              </div>
            </div>
            
            {otpData?.subject && (
              <div className="text-sm text-muted-foreground mb-4">
                <p className="font-medium text-foreground mb-1">Subject:</p>
                <p data-testid="text-otp-subject">{otpData.subject}</p>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={copyOtp}
              className="w-full"
              data-testid="button-copy-otp"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy OTP
            </Button>
            <Button 
              variant="secondary"
              onClick={handleRefresh}
              className="w-full"
              data-testid="button-refresh-otp"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Get New OTP
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
