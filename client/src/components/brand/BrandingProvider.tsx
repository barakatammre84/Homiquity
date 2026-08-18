import * as React from "react";

/**
 * White-label seam. On PRIVATE/authenticated surfaces only, a tenant (LO/broker)
 * brand overrides a small set of BRANDABLE tokens; everything else (neutral ramp,
 * surface + elevation, semantic status) is fixed. Because the private UI is built
 * on `bg-primary` / `bg-accent` SEMANTIC classes, overriding the CSS variables
 * re-skins the portal automatically — and stays token-guard-safe (no inline hex or
 * raw palette classes in components).
 *
 * Phase 2 ships this component INERT: with no `brand` it renders children
 * untouched (default Homiquity / Royal Blue Emerald). Phase 4 mounts it on
 * `PrivateLayout` and resolves the session's tenant (compliance-gated). Public
 * layouts never mount it.
 *
 * See DESIGN_SYSTEM.md → Brand & white-label. Fixed tokens are never overridden here.
 */

export interface Brand {
  /** Tenant display name (co_brand_profiles.brandName). */
  brandName?: string | null;
  /** Tenant logo URL (co_brand_profiles.logoUrl). */
  logoUrl?: string | null;
  /** Tenant brand hex, e.g. "#1e3a5f" (co_brand_profiles.primaryColor). */
  primaryColor?: string | null;
  /** Tenant accent hex (co_brand_profiles.accentColor). */
  accentColor?: string | null;
}

interface BrandingContextValue {
  brandName: string | null;
  logoUrl: string | null;
  /** True when a tenant brand is active (colors/logo/name present). */
  isWhiteLabeled: boolean;
}

const DEFAULT_CONTEXT: BrandingContextValue = {
  brandName: null,
  logoUrl: null,
  isWhiteLabeled: false,
};

const BrandingContext = React.createContext<BrandingContextValue>(DEFAULT_CONTEXT);

/** Read the active branding (defaults to Homiquity when no provider/tenant). */
export function useBranding(): BrandingContextValue {
  return React.useContext(BrandingContext);
}

// ---------------------------------------------------------------------------
// Color helpers — tenant colors arrive as hex but our tokens are `H S% L%`
// triplets (consumed via hsl(var(--x))). We convert, and derive an AA-readable
// foreground so white text is never assumed to pass on an arbitrary brand color.
// ---------------------------------------------------------------------------

function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, "");
  const expand = (s: string) =>
    s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  const full = expand(m);
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** hex → "H S% L%" (the token form) or null if unparseable. */
function hexToHslTriplet(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** WCAG relative luminance from linearised sRGB. */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE_FG = "0 0% 100%";
const SLATE_FG = "222 47% 11%"; // near-black slate = the house --foreground
const WHITE_LUM = 1;
const SLATE_LUM = luminance([15, 23, 42]); // #0F172A

/**
 * Choose the token foreground (white vs near-black slate) with the better
 * contrast against a brand color. A best-effort guard — the co-branding settings
 * UI (Phase 4) should reject a brand color where neither foreground clears AA.
 */
function readableForeground(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const bg = luminance(rgb);
  return contrastRatio(WHITE_LUM, bg) >= contrastRatio(SLATE_LUM, bg)
    ? WHITE_FG
    : SLATE_FG;
}

/** Build brandable CSS-var overrides for a tenant brand. Only BRANDABLE tokens. */
function brandStyle(brand: Brand): React.CSSProperties {
  const style: Record<string, string> = {};

  if (brand.primaryColor) {
    const primary = hexToHslTriplet(brand.primaryColor);
    if (primary) {
      // Brand hue drives the conversion action + the sidebar + the focus ring.
      style["--primary"] = primary;
      style["--sidebar"] = primary;
      style["--ring"] = primary;
      const fg = readableForeground(brand.primaryColor);
      if (fg) {
        style["--primary-foreground"] = fg;
        style["--sidebar-foreground"] = fg;
      }
    }
  }

  if (brand.accentColor) {
    const accent = hexToHslTriplet(brand.accentColor);
    if (accent) {
      style["--accent"] = accent;
      const fg = readableForeground(brand.accentColor);
      if (fg) style["--accent-foreground"] = fg;
    }
  }

  return style as React.CSSProperties;
}

export interface BrandingProviderProps {
  /**
   * Active tenant brand (from co_brand_profiles). Omit/null → default Homiquity
   * brand, so the provider is inert. Phase 4 resolves this on PrivateLayout.
   */
  brand?: Brand | null;
  children: React.ReactNode;
}

export function BrandingProvider({ brand, children }: BrandingProviderProps) {
  const isWhiteLabeled = !!(
    brand &&
    (brand.primaryColor || brand.logoUrl || brand.brandName)
  );

  const style = React.useMemo(
    () => (brand && (brand.primaryColor || brand.accentColor) ? brandStyle(brand) : undefined),
    [brand],
  );

  const value = React.useMemo<BrandingContextValue>(
    () => ({
      brandName: brand?.brandName ?? null,
      logoUrl: brand?.logoUrl ?? null,
      isWhiteLabeled,
    }),
    [brand?.brandName, brand?.logoUrl, isWhiteLabeled],
  );

  return (
    <BrandingContext.Provider value={value}>
      {style ? (
        // `display: contents` sets the brandable CSS vars for the subtree without
        // introducing a layout box (custom properties still inherit through it).
        <div style={{ display: "contents", ...style }}>{children}</div>
      ) : (
        children
      )}
    </BrandingContext.Provider>
  );
}
