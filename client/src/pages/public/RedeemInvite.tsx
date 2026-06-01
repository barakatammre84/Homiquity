import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, Ticket, Shield } from "lucide-react";

export default function RedeemInvite() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/redeem-invite/:code");
  const { toast } = useToast();

  const [code, setCode] = useState(params?.code || "");
  const [validating, setValidating] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; role?: string; email?: string; error?: string } | null>(null);
  const [redeemed, setRedeemed] = useState(false);
  const [newRole, setNewRole] = useState("");

  useEffect(() => {
    if (params?.code) {
      setCode(params.code);
      validateCode(params.code);
    }
  }, [params?.code]);

  const validateCode = async (inviteCode: string) => {
    if (!inviteCode.trim()) return;
    setValidating(true);
    try {
      const res = await fetch(`/api/staff-invites/validate/${inviteCode.toUpperCase()}`);
      const data = await res.json();
      setValidation(data);
    } catch {
      setValidation({ valid: false, error: "Failed to validate code" });
    } finally {
      setValidating(false);
    }
  };

  const handleRedeem = async () => {
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }
    setRedeeming(true);
    try {
      const res = await fetch("/api/staff-invites/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRedeemed(true);
        setNewRole(data.role);
        toast({ title: data.message });
      } else {
        toast({ title: data.error || "Failed to redeem invite", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to redeem invite", variant: "destructive" });
    } finally {
      setRedeeming(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" data-testid="card-redeem-invite">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Ticket className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Redeem Staff Invite</CardTitle>
          <CardDescription>Enter your invite code to activate your staff role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {redeemed ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <h3 className="text-lg font-semibold" data-testid="text-redeem-success">Role Activated</h3>
              <p className="text-muted-foreground">
                Your account has been upgraded to{" "}
                <Badge variant="secondary" data-testid="badge-new-role">{newRole.replace(/_/g, " ")}</Badge>
              </p>
              <Button className="mt-4" onClick={() => navigate("/staff-dashboard")} data-testid="button-go-to-dashboard">
                Go to Staff Dashboard
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Invite Code</label>
                <Input
                  placeholder="Enter invite code (e.g. A1B2C3D4E5F6)"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setValidation(null);
                  }}
                  className="font-mono text-center tracking-widest"
                  data-testid="input-invite-code"
                />
              </div>

              {validating && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validating...
                </div>
              )}

              {validation && (
                <div className={`flex items-start gap-3 p-3 rounded-lg ${validation.valid ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-destructive/10"}`}>
                  {validation.valid ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium" data-testid="text-valid-invite">Valid invite code</p>
                        <p className="text-xs text-muted-foreground">
                          Role: <Badge variant="secondary" className="ml-1">{validation.role?.replace(/_/g, " ")}</Badge>
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-destructive" data-testid="text-invalid-invite">{validation.error}</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                {!validation && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => validateCode(code)}
                    disabled={!code.trim() || validating}
                    data-testid="button-validate-code"
                  >
                    {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                    Validate
                  </Button>
                )}
                <Button
                  className="flex-1"
                  onClick={handleRedeem}
                  disabled={!code.trim() || redeeming || (validation !== null && !validation.valid)}
                  data-testid="button-redeem-code"
                >
                  {redeeming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {!isAuthenticated ? "Sign in & Redeem" : "Redeem Code"}
                </Button>
              </div>

              {!isAuthenticated && (
                <p className="text-xs text-center text-muted-foreground">
                  You'll need to sign in before redeeming your invite code.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
