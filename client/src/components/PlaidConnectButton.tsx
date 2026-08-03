import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Landmark, RefreshCw } from "lucide-react";

/**
 * Inline Plaid Link launcher — opens the Plaid connect modal right where it's
 * rendered (chat, checklist panel) instead of routing to /verification, so the
 * borrower connects without leaving the conversation.
 *
 * Reuses the existing verification flow: POST /api/verifications/link-token →
 * usePlaidLink modal → POST /api/verifications/exchange. Degrades gracefully:
 * if Plaid isn't configured in the environment the link-token call returns 503
 * and we surface a clear "upload instead" toast rather than breaking the UI.
 * Requires an owned applicationId (the caller falls back to a /verification link
 * when none is available yet).
 */
export function PlaidConnectButton({
  applicationId,
  verificationType = "assets",
  label = "Connect with Plaid",
  size = "sm",
  variant = "outline",
  className,
  testId,
  onDone,
}: {
  applicationId: string;
  verificationType?: "assets" | "income" | "employment";
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "secondary";
  className?: string;
  testId?: string;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkTokenId, setLinkTokenId] = useState<string | null>(null);
  const openedRef = useRef(false);

  const reset = () => {
    setLinkToken(null);
    setLinkTokenId(null);
    openedRef.current = false;
  };

  const createLinkToken = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/verifications/link-token", {
        applicationId,
        verificationType,
      });
      return res.json();
    },
    onSuccess: (data: { linkToken: string; linkTokenId: string }) => {
      setLinkToken(data.linkToken);
      setLinkTokenId(data.linkTokenId);
    },
    onError: (err: Error) => {
      toast({
        title: "Bank connection unavailable",
        description: err.message || "You can upload statements instead for now.",
        variant: "destructive",
      });
    },
  });

  const exchange = useMutation({
    mutationFn: async (publicToken: string) => {
      const res = await apiRequest("POST", "/api/verifications/exchange", {
        publicToken,
        linkTokenId,
        applicationId,
        verificationType,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Bank connected", description: "We're verifying your accounts securely." });
      reset();
      queryClient.invalidateQueries({ queryKey: ["/api/coach/insights"] });
      onDone?.();
    },
    onError: (err: Error) => {
      reset();
      toast({
        title: "Couldn't finish connecting",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // react-plaid-link v5 types public_token as `string | null` and passes link
  // metadata as a second argument. The null case is real — Link can complete
  // without a token — and exchanging `null` would post a malformed body, so it
  // is dropped here rather than handed to the mutation.
  const handleSuccess = useCallback<PlaidLinkOnSuccess>(
    (publicToken) => {
      if (!publicToken) return;
      exchange.mutate(publicToken);
    },
    [exchange],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: () => reset(),
  });

  // Open the modal once, as soon as the token is created and Plaid is ready.
  useEffect(() => {
    if (linkToken && ready && !openedRef.current) {
      openedRef.current = true;
      open();
    }
  }, [linkToken, ready, open]);

  const busy = createLinkToken.isPending || exchange.isPending;

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      disabled={busy}
      onClick={() => createLinkToken.mutate()}
      data-testid={testId}
    >
      {busy ? (
        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Landmark className="mr-1.5 h-3.5 w-3.5" />
      )}
      {busy ? "Connecting…" : label}
    </Button>
  );
}
