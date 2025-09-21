import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, RefreshCw, Clock, Shield } from "lucide-react";

interface TOTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  totpData: any;
  product: any;
  onRefresh: () => void;
}

export default function TOTPModal({ isOpen, onClose, totpData, product, onRefresh }: TOTPModalProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (totpData && isOpen) {
      setTimeLeft(totpData.valid_for_seconds);
      
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [totpData, isOpen]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "2FA code copied to clipboard!",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy to clipboard",
      });
    }
  };

  const formatTime = (seconds: number) => {
    return `${seconds}s`;
  };

  const getProgressPercentage = () => {
    if (!totpData) return 0;
    const totalTime = totpData.valid_for_seconds || 30;
    return (timeLeft / totalTime) * 100;
  };

  const getProgressColor = () => {
    const percentage = getProgressPercentage();
    if (percentage > 60) return "bg-green-500";
    if (percentage > 30) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (!totpData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-totp">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>2FA Authenticator Code</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Info */}
          <div className="text-center">
            <h3 className="font-medium text-foreground" data-testid="text-product-name">
              {product.title}
            </h3>
            {totpData.issuer && (
              <p className="text-sm text-muted-foreground">
                Issuer: {totpData.issuer}
              </p>
            )}
            {totpData.account_label && (
              <p className="text-sm text-muted-foreground">
                Account: {totpData.account_label}
              </p>
            )}
          </div>

          {/* TOTP Code Display */}
          <Card className="bg-muted/50">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                {/* Main TOTP Code */}
                <div className="relative">
                  <div 
                    className="text-4xl font-mono font-bold tracking-widest text-foreground select-all cursor-pointer hover:bg-muted rounded p-2 transition-colors"
                    onClick={() => copyToClipboard(totpData.code)}
                    data-testid="text-totp-code"
                  >
                    {totpData.code}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Click to copy
                  </div>
                </div>

                {/* Countdown Timer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-center space-x-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid="text-countdown">
                      Valid for {formatTime(timeLeft)}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-1000 ${getProgressColor()}`}
                      style={{ width: `${getProgressPercentage()}%` }}
                    ></div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex justify-center">
                  {timeLeft > 0 ? (
                    <Badge variant="default">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      Expired
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Generated: {new Date(totpData.fetched_at).toLocaleTimeString()}</div>
            <div className="text-center text-muted-foreground">
              This code changes every 30 seconds
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button
              onClick={() => copyToClipboard(totpData.code)}
              variant="outline"
              className="flex-1"
              data-testid="button-copy-totp"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Code
            </Button>
            
            <Button
              onClick={() => {
                onRefresh();
                onClose();
              }}
              variant="outline"
              className="flex-1"
              data-testid="button-refresh-totp"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Get New Code
            </Button>
          </div>

          {/* Close Button */}
          <Button 
            onClick={onClose}
            variant="default"
            className="w-full"
            data-testid="button-close-totp"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}