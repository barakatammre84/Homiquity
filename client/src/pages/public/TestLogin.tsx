import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getRoleHomeRoute } from "@/lib/roleRoutes";
import { 
  Wrench, 
  UserCheck, 
  Briefcase, 
  FileCheck, 
  ClipboardCheck, 
  Banknote, 
  Star, 
  Home,
  Handshake,
  Building2,
} from "lucide-react";

// No per-account passwords: POST /api/test-login validates every account
// against the single DEV_TEST_PASSWORD env var (server/auth.ts; runbook
// knowledge-base/runbooks/TEST_ACCOUNTS.md). This array once carried fake
// "<name>123" passwords the server never accepted — every quick card 401'd.
const testAccounts = [
  { email: "admin@test.com", role: "Tech/Ops Lead", roleKey: "admin", icon: Wrench, description: "Full system access & configuration", category: "staff" },
  { email: "lo@test.com", role: "Loan Officer", roleKey: "lo", icon: UserCheck, description: "Sales & lead qualification", category: "staff" },
  { email: "loa@test.com", role: "LOA", roleKey: "loa", icon: Briefcase, description: "Document collection & appointments", category: "staff" },
  { email: "processor@test.com", role: "Processor", roleKey: "processor", icon: FileCheck, description: "File bundling & pre-underwriting", category: "staff" },
  { email: "underwriter@test.com", role: "Underwriter", roleKey: "underwriter", icon: ClipboardCheck, description: "Final loan decisions", category: "staff" },
  { email: "closer@test.com", role: "Closer/Funder", roleKey: "closer", icon: Banknote, description: "Wire management & final docs", category: "staff" },
  { email: "broker@test.com", role: "Mortgage Broker", roleKey: "broker", icon: Handshake, description: "Loan origination & deal management", category: "staff" },
  { email: "lender@test.com", role: "Lender Rep", roleKey: "lender", icon: Building2, description: "Loan product & pricing management", category: "staff" },
  { email: "renter@test.com", role: "Aspiring Owner", roleKey: "aspiring_owner", icon: Star, description: "Explore homeownership & gap calculator", category: "client" },
  { email: "buyer@test.com", role: "Active Buyer", roleKey: "active_buyer", icon: Home, description: "Apply for mortgages & upload docs", category: "client" },
];

const staffAccounts = testAccounts.filter(a => a.category === "staff");
const clientAccounts = testAccounts.filter(a => a.category === "client");

export default function TestLogin() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  // One password for everything: the quick cards and the manual form both send
  // this value (all test accounts share DEV_TEST_PASSWORD).
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const sharedPasswordRef = useRef<HTMLInputElement>(null);

  const handleQuickLogin = (loginEmail: string) => {
    setEmail(loginEmail);
    if (!password) {
      toast({
        title: "Enter the shared dev password first",
        description: "All test accounts use the single DEV_TEST_PASSWORD from your .env.",
        variant: "destructive",
      });
      sharedPasswordRef.current?.focus();
      return;
    }
    void handleLogin(loginEmail, password);
  };

  const handleLogin = async (loginEmail: string, loginPassword: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/test-login", {
        email: loginEmail,
        password: loginPassword,
      });
      
      const data = await response.json();
      
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: "Logged in successfully",
        description: `Welcome, ${data.user.firstName}! Role: ${data.user.role}`,
      });

      // Land where the real login lands. This used to restate a staff-role list
      // and send every staff role to /staff-dashboard, which meant a broker, CPA
      // or realtor test account landed somewhere production would never put them.
      setLocation(getRoleHomeRoute(data.user.role));
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold leading-none" data-testid="text-page-title">Test Login</h1>
          <p className="text-muted-foreground mt-2">Select a test account or enter credentials manually</p>
        </div>

        {/* Shared dev password — type it once, then every card is one-click. */}
        <div className="max-w-md mx-auto space-y-2">
          <Label htmlFor="shared-password">Shared dev password</Label>
          <Input
            id="shared-password"
            ref={sharedPasswordRef}
            type="password"
            placeholder="DEV_TEST_PASSWORD from .env"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="input-shared-password"
          />
          <p className="text-xs text-muted-foreground">
            Every test account shares the one password in the <code>DEV_TEST_PASSWORD</code> env var
            (see knowledge-base/runbooks/TEST_ACCOUNTS.md). Enter it once, then click a card.
          </p>
        </div>

        {/* Staff Roles */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Staff Roles</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffAccounts.map((account) => (
              <Card
                key={account.email}
                className="cursor-pointer hover-elevate"
                onClick={() => handleQuickLogin(account.email)}
                data-testid={`card-login-${account.roleKey}`}
              >
                <CardHeader className="pb-2">
                  <account.icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{account.role}</CardTitle>
                  <CardDescription>{account.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {account.email}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Client Roles */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Client Roles</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {clientAccounts.map((account) => (
              <Card
                key={account.email}
                className="cursor-pointer hover-elevate"
                onClick={() => handleQuickLogin(account.email)}
                data-testid={`card-login-${account.roleKey}`}
              >
                <CardHeader className="pb-2">
                  <account.icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{account.role}</CardTitle>
                  <CardDescription>{account.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {account.email}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Manual Login</CardTitle>
            <CardDescription>Enter test credentials manually</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@test.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground" data-testid="text-credentials-hint">
          <p>
            All accounts share the single password in <code>DEV_TEST_PASSWORD</code> — no per-account
            passwords exist. Full account list: knowledge-base/runbooks/TEST_ACCOUNTS.md.
          </p>
        </div>
      </div>
    </div>
  );
}
