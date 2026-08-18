import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, MailCheck } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);
    try {
      // The endpoint always returns a generic success (no account enumeration),
      // so we show the same confirmation regardless of the outcome.
      await apiRequest("POST", "/api/auth/forgot-password", { email });
    } catch {
      // Intentionally swallow — the confirmation must not reveal failures.
    } finally {
      setIsSubmitting(false);
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <span className="text-2xl font-bold tracking-tight text-primary cursor-pointer" data-testid="text-brand-logo">
              homiquity
            </span>
          </Link>
          <p className="text-sm text-muted-foreground mt-2">Clarity for every stage of homeownership</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl" data-testid="text-forgot-title">Reset your password</CardTitle>
            <CardDescription>
              {sent
                ? "Check your inbox"
                : "Enter your email and we'll send you a link to set a new password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center space-y-4" data-testid="forgot-sent">
                <div className="flex justify-center">
                  <MailCheck className="h-10 w-10 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  If an account exists for <span className="font-medium text-foreground">{email}</span>, a
                  reset link is on its way. The link expires in 30 minutes.
                </p>
                <Button asChild variant="outline" className="w-full" data-testid="button-back-to-login">
                  <Link href="/login">
                    Back to sign in
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    data-testid="input-email"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || !email}
                  data-testid="button-submit-forgot"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Send reset link
                </Button>
                <div className="text-center text-sm">
                  <Link href="/login">
                    <span className="text-primary font-medium cursor-pointer" data-testid="link-back-login">
                      Back to sign in
                    </span>
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
