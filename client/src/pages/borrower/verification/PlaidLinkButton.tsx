import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Shield } from "lucide-react";

/**
 * Opens Plaid Link for one verification type.
 *
 * Two server round-trips: mint a link token, then exchange the public token
 * Plaid hands back. Credentials never reach this app — the exchange only ever
 * carries Plaid's opaque tokens.
 */
export function PlaidLinkButton({
  applicationId,
  verificationType,
  onSuccess,
  disabled,
}: {
  applicationId: string;
  verificationType: string;
  onSuccess: () => void;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkTokenId, setLinkTokenId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const createLinkTokenMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/verifications/link-token", {
        applicationId,
        verificationType,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setLinkToken(data.linkToken);
      setLinkTokenId(data.linkTokenId);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start verification",
        variant: "destructive",
      });
    },
  });

  const exchangeTokenMutation = useMutation({
    mutationFn: async (publicToken: string) => {
      const response = await apiRequest("POST", "/api/verifications/exchange", {
        publicToken,
        linkTokenId,
        applicationId,
        verificationType,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Verification Started",
        description: "Your verification is being processed.",
      });
      setLinkToken(null);
      setLinkTokenId(null);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to complete verification",
        variant: "destructive",
      });
    },
  });

  // v5 types public_token as `string | null` and adds a metadata argument.
  // Exchanging `null` would post a malformed body, so drop it instead.
  const handlePlaidSuccess = useCallback<PlaidLinkOnSuccess>(
    (publicToken) => {
      if (!publicToken) return;
      exchangeTokenMutation.mutate(publicToken);
    },
    [exchangeTokenMutation]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: () => {
      setIsLoading(false);
    },
  });

  const handleClick = async () => {
    if (linkToken && ready) {
      setIsLoading(true);
      open();
    } else {
      createLinkTokenMutation.mutate();
    }
  };

  // Auto-open when link token is ready
  if (linkToken && ready && !isLoading) {
    setIsLoading(true);
    open();
  }

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || createLinkTokenMutation.isPending || exchangeTokenMutation.isPending}
      data-testid={`button-verify-${verificationType}`}
    >
      {createLinkTokenMutation.isPending || exchangeTokenMutation.isPending ? (
        <>
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <Shield className="mr-2 h-4 w-4" />
          Verify Now
        </>
      )}
    </Button>
  );
}
