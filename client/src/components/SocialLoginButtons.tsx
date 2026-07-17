import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { SiGoogle, SiApple } from "react-icons/si";
// simple-icons dropped the LinkedIn glyph (brand licensing); Font Awesome still ships it.
import { FaLinkedin } from "react-icons/fa";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Icons, iconSize } from "@/lib/icons";

interface SocialLoginButtonsProps {
  mode: "login" | "signup";
}

interface ProvidersResponse {
  providers: Record<string, boolean>;
  // Development only — the env vars each unconfigured provider is waiting on.
  // See GET /api/auth/providers in server/socialAuth.ts.
  missing?: Record<string, string[]>;
}

export function SocialLoginButtons({ mode }: SocialLoginButtonsProps) {
  const { data, isLoading, error } = useQuery<ProvidersResponse>({
    queryKey: ["/api/auth/providers"],
    staleTime: 60000,
  });

  // A failed lookup hides every social button. Borrowers can still sign in with
  // email, so the page stays quiet — but the failure must not be invisible to us.
  useEffect(() => {
    if (error) {
      console.error("[auth] /api/auth/providers failed — social login buttons are hidden:", error);
    }
  }, [error]);

  const providers = data?.providers;
  const label = mode === "login" ? "Sign in" : "Sign up";
  const separatorText = mode === "login" ? "or continue with email" : "or sign up with email";

  const buttons = [
    {
      key: "google",
      label: `${label} with Google`,
      icon: SiGoogle,
      configured: providers?.google ?? false,
    },
    {
      key: "linkedin",
      label: `${label} with LinkedIn`,
      icon: FaLinkedin,
      configured: providers?.linkedin ?? false,
    },
    {
      key: "apple",
      label: `${label} with Apple`,
      icon: SiApple,
      configured: providers?.apple ?? false,
    },
  ];

  const configuredButtons = buttons.filter((b) => b.configured);

  function handleSocialLogin(provider: string) {
    window.location.href = `/api/auth/${provider}`;
  }

  if (isLoading) return null;

  // Nothing to offer: the whole section disappears. That is the right outcome for
  // borrowers either way, so production still renders nothing at all here.
  if (configuredButtons.length === 0) {
    return <DevProviderNotice error={error} missing={data?.missing} />;
  }

  return (
    <>
      <div className="space-y-2">
        {configuredButtons.map((btn) => (
          <Button
            key={btn.key}
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => handleSocialLogin(btn.key)}
            data-testid={`button-${btn.key}-login`}
          >
            <btn.icon className={iconSize.inline} />
            {btn.label}
          </Button>
        ))}
      </div>
      <div className="relative my-6">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
          {separatorText}
        </span>
      </div>
    </>
  );
}

/**
 * Why this exists: with no provider configured this section renders nothing at
 * all. That is right for borrowers — never show a button that cannot work — but
 * locally it is indistinguishable from a broken build, and a Google button that
 * had simply never been configured cost a live debugging session on 2026-07-16.
 * In development the absence explains itself instead.
 *
 * Only shown when the section is empty, never as a running tally of every
 * unconfigured provider: LinkedIn and Apple are deliberately unset, so a banner
 * listing them would be permanent, and a warning that cannot be cleared is one
 * developers learn to scroll past. This one clears the moment it is resolved.
 *
 * `import.meta.env.DEV` is false in every built bundle, so Vite drops this from
 * production output; the server withholds `missing` outside development anyway.
 */
function DevProviderNotice({
  error,
  missing,
}: {
  error: Error | null;
  missing?: Record<string, string[]>;
}) {
  if (!import.meta.env.DEV) return null;

  const unconfigured = Object.entries(missing ?? {});
  if (!error && unconfigured.length === 0) return null;

  return (
    <Alert variant="warning" className="mb-6" data-testid="alert-dev-provider-notice">
      <Icons.warning className={iconSize.inline} />
      <AlertTitle>Social login hidden (dev only)</AlertTitle>
      <AlertDescription>
        {error ? (
          <span data-testid="text-dev-provider-error">
            Couldn&rsquo;t reach <code>/api/auth/providers</code>, so every social button is
            hidden: {error.message}
          </span>
        ) : (
          <ul className="space-y-1" data-testid="list-dev-provider-missing">
            {unconfigured.map(([provider, envVars]) => (
              <li key={provider}>
                <span className="font-medium capitalize">{provider}</span> — set{" "}
                {envVars.map((name, i) => (
                  <span key={name}>
                    {i > 0 && ", "}
                    <code>{name}</code>
                  </span>
                ))}{" "}
                in <code>.env</code> and restart.
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}
