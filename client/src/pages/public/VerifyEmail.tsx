import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type Status = "verifying" | "success" | "error";

export default function VerifyEmail() {
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");
  // Verification links are visited once; guard against React StrictMode's
  // double-invoke so we don't burn the single-use token on the first mount.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }

    (async () => {
      try {
        const res = await apiRequest("POST", "/api/auth/verify-email", { token });
        const data = await res.json();
        setStatus("success");
        setMessage(data.message || "Your email is confirmed. Thank you!");
      } catch {
        setStatus("error");
        setMessage("This verification link is invalid or has expired.");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <span className="text-2xl font-bold tracking-tight text-flare cursor-pointer" data-testid="text-brand-logo">
              homiquity
            </span>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl" data-testid="text-verify-title">Email verification</CardTitle>
            <CardDescription>
              {status === "verifying" ? "Confirming your email…" : status === "success" ? "You're all set" : "We couldn't verify"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="flex justify-center" data-testid={`verify-${status}`}>
                {status === "verifying" && <Loader2 className="h-10 w-10 text-primary animate-spin" />}
                {status === "success" && <CheckCircle2 className="h-10 w-10 text-primary" />}
                {status === "error" && <XCircle className="h-10 w-10 text-destructive" />}
              </div>
              {status !== "verifying" && (
                <p className="text-sm text-muted-foreground" data-testid="verify-message">{message}</p>
              )}
              {status !== "verifying" && (
                <Button asChild className="w-full" data-testid="button-continue">
                  <Link href="/dashboard">
                    Continue
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
