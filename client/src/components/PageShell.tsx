import { cn } from "@/lib/utils";

// Standard page container. Gives every page identical centering, horizontal
// padding, and vertical rhythm so the app feels uniform, while still allowing the
// legitimate width variety pages need (forms are narrow, dashboards are wide).
//
// Replaces ad-hoc `mx-auto max-w-Nxl px-4 py-8` strings scattered across pages.

type PageWidth = "narrow" | "content" | "wide" | "full";

const WIDTHS: Record<PageWidth, string> = {
  narrow: "max-w-2xl", // focused forms, single-column flows
  content: "max-w-4xl", // articles, settings, most content pages
  wide: "max-w-6xl", // dashboards, multi-column layouts
  full: "max-w-7xl", // data-dense / edge-to-edge pages
};

interface PageShellProps {
  children: React.ReactNode;
  /** Semantic max-width. Default "content". */
  width?: PageWidth;
  className?: string;
}

export function PageShell({ children, width = "content", className = "" }: PageShellProps) {
  return (
    <div className={cn("mx-auto w-full px-4 py-8 sm:py-10", WIDTHS[width], className)}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional right-aligned action (button, link). */
  action?: React.ReactNode;
  className?: string;
}

// Consistent page title block: same type scale, spacing, and optional action slot.
export function PageHeader({ title, subtitle, action, className = "" }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="page-title">
          {title}
        </h1>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
