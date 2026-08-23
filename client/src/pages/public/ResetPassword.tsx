import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast({ title: "Invalid link", description: "This reset link is missing its token.", variant: "destructive" });
      return;
    }
    if (password.length < 8 || password !== confirm) return;

    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password });
      setDone(true);
    } catch (error: any) {
      const message =
        typeof error?.message === "string" && error.message.includes("400")
          ? "This reset link is invalid or has expired. Request a new one."
          : "Something went wrong. Please try again.";
      toast({ title: "Reset failed", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <Logo size="lg" tone="brand" data-testid="text-brand-logo" />
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl" data-testid="text-reset-title">Choose a new password</CardTitle>
            <CardDescription>
              {done ? "All set" : "Enter and confirm your new password below."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="text-center space-y-4" data-testid="reset-done">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Your password has been reset. You can now sign in with your new password.
                </p>
                <Button className="w-full" onClick={() => navigate("/login")} data-testid="button-go-login">
                  Go to sign in
                </Button>
              </div>
            ) : !token ? (
              <div className="text-center space-y-4" data-testid="reset-no-token">
                <p className="text-sm text-muted-foreground">
                  This reset link is missing or malformed. Please request a new one.
                </p>
                <Button asChild variant="outline" className="w-full" data-testid="button-request-new">
                  <Link href="/forgot-password">
                    Request a new link
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      data-testid="input-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Toggle password visibility"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  {tooShort && (
                    <p className="text-xs text-destructive" data-testid="error-too-short">
                      Password must be at least 8 characters.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    data-testid="input-confirm"
                  />
                  {mismatch && (
                    <p className="text-xs text-destructive" data-testid="error-mismatch">
                      Passwords don't match.
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || password.length < 8 || password !== confirm}
                  data-testid="button-submit-reset"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Reset password
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
