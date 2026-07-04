import { Navigation } from "@/components/Navigation";
import { SkipLink } from "@/components/SkipLink";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <SkipLink />
      <Navigation />
      <main id="main" tabIndex={-1} className="focus:outline-none">{children}</main>
    </div>
  );
}
