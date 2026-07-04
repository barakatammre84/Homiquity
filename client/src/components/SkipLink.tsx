/**
 * Keyboard skip-link: the first focusable element in every layout, letting
 * keyboard/screen-reader users bypass the nav and jump to <main id="main">.
 * WCAG 2.4.1. Always in the DOM (so it's reliably first in the tab order);
 * translated off the top of the viewport until focused, then slides in — this
 * avoids the sr-only / focus:not-sr-only cascade fragility.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-md bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring"
      data-testid="link-skip-to-content"
    >
      Skip to content
    </a>
  );
}
