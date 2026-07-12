import { cn } from "@/lib/utils";

// Standard page scaffold. Owns the page background, centering, horizontal padding,
// vertical rhythm, and (optionally) the page header — so pages are a single clean
// wrapper instead of ad-hoc nested `min-h-screen` divs + bespoke header markup.
//
// Because the whole app routes its look through this one component, changing the
// app-wide page treatment later means editing this file, not every page.
//
// The header supports the variants that exist across the app (leading icon,
// eyebrow/kicker, a lead slot for back-links, a meta slot for status badges, and
// a right-aligned action) so pages can converge on this shell WITHOUT flattening
// their bespoke headers. Omit every header field for a container-only shell.
//
// Clean page:
//   <PageShell fullHeight width="wide" title="Documents" subtitle="Upload and track">
//     ...content
//   </PageShell>
//
// Header with icon + action + a back link + status badges:
//   <PageShell
//     width="content"
//     icon={<Shield className="h-7 w-7 text-primary" />}
//     title="Credit Authorization"
//     subtitle="FCRA-compliant credit disclosure and consent"
//     headerLead={<BackLink to="/tasks" />}
//     headerAction={<Button>Save</Button>}
//     headerMeta={<StatusBadges />}
//   >...content</PageShell>
//
// Container only (no header/background):
//   <PageShell width="content">...</PageShell>

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
  /** Wrap in a full-height page background (replaces per-page `min-h-screen bg-background`). */
  fullHeight?: boolean;
  /** Render a standard PageHeader above the content. */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small uppercase kicker rendered above the title. */
  eyebrow?: string;
  /** Leading icon rendered next to the title. */
  icon?: React.ReactNode;
  /** Slot rendered above the title row (e.g. a Back link). */
  headerLead?: React.ReactNode;
  /** Optional right-aligned header action (button, link). */
  headerAction?: React.ReactNode;
  /** Slot rendered below the title/subtitle (e.g. status badges, meta). */
  headerMeta?: React.ReactNode;
  /** data-testid for the <h1>. Defaults to "page-title"; pass the page's own id to preserve it. */
  titleTestId?: string;
  /** Applied to the inner max-width container. */
  className?: string;
  /** Wraps the children in a div with this class (e.g. "space-y-6" for vertical rhythm). */
  contentClassName?: string;
}

export function PageShell({
  children,
  width = "content",
  fullHeight = false,
  title,
  subtitle,
  eyebrow,
  icon,
  headerLead,
  headerAction,
  headerMeta,
  titleTestId,
  className = "",
  contentClassName,
}: PageShellProps) {
  const hasHeader =
    title != null || subtitle != null || eyebrow != null || headerLead != null;
  const inner = (
    <div className={cn("mx-auto w-full px-4 py-8 sm:py-10", WIDTHS[width], className)}>
      {hasHeader && (
        <PageHeader
          title={title}
          subtitle={subtitle}
          eyebrow={eyebrow}
          icon={icon}
          lead={headerLead}
          action={headerAction}
          meta={headerMeta}
          testId={titleTestId}
        />
      )}
      {contentClassName ? <div className={contentClassName}>{children}</div> : children}
    </div>
  );

  if (fullHeight) {
    return <div className="min-h-screen bg-background">{inner}</div>;
  }
  return inner;
}

interface PageHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small uppercase kicker rendered above the title. */
  eyebrow?: string;
  /** Leading icon rendered next to the title. */
  icon?: React.ReactNode;
  /** Slot rendered above the title row (e.g. a Back link). */
  lead?: React.ReactNode;
  /** Optional right-aligned action (button, link). */
  action?: React.ReactNode;
  /** Slot rendered below the title/subtitle (e.g. status badges, meta). */
  meta?: React.ReactNode;
  /** data-testid for the <h1>. Defaults to "page-title". */
  testId?: string;
  className?: string;
}

// Consistent page title block: same type scale, spacing, and optional icon,
// eyebrow, action, lead, and meta slots.
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  lead,
  action,
  meta,
  testId = "page-title",
  className = "",
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 space-y-3", className)}>
      {lead}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          {eyebrow && (
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <div className="flex items-center gap-3">
            {icon}
            {title != null && (
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid={testId}>
                {title}
              </h1>
            )}
          </div>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          {meta && <div className="pt-1">{meta}</div>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
