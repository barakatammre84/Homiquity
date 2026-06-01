import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { SiGoogle, SiLinkedin, SiApple } from "react-icons/si";
import { Separator } from "@/components/ui/separator";

interface SocialLoginButtonsProps {
  mode: "login" | "signup";
}

export function SocialLoginButtons({ mode }: SocialLoginButtonsProps) {
  const { data, isLoading } = useQuery<{ providers: Record<string, boolean> }>({
    queryKey: ["/api/auth/providers"],
    staleTime: 60000,
  });

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
      icon: SiLinkedin,
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

  if (isLoading || configuredButtons.length === 0) return null;

  function handleSocialLogin(provider: string) {
    window.location.href = `/api/auth/${provider}`;
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
            <btn.icon className="h-4 w-4" />
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
