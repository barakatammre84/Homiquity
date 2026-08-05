/**
 * Static route → SEO metadata registry, plus pure helpers to render and inject a
 * per-URL <head> block. Used by the server-side head-injection layer (server/seo)
 * so non-JS crawlers and social scrapers get correct per-URL title/meta/OG/Twitter
 * + JSON-LD, instead of the generic homepage shell.
 *
 * SOURCE-OF-TRUTH NOTE: the title/description here MIRROR the <SEOHead> props in
 * the page components (client/src/pages/**). They must stay in sync until a future
 * refactor has the pages consume this registry directly. Dynamic routes that need a
 * DB lookup (e.g. /learn/:slug articles) are resolved in server/seo, not here.
 *
 * Compliance: copy on this public surface must stay free of Reg Z trigger terms
 * (rates/payments/"as low as X%") and Reg N approval/guarantee language.
 */
import { absoluteUrl, DEFAULT_OG_IMAGE, type JsonLd } from "./schema";

export const SITE_NAME = "Homiquity";
// Keep in sync with the static <title> and SEOHead DEFAULT_TITLE.
export const DEFAULT_TITLE = "Homiquity - Clarity for Every Stage of Homeownership";
export const DEFAULT_DESCRIPTION =
  "Clarity for every stage of homeownership. Get pre-approved in minutes with a clear, calm mortgage experience. No jargon, no stress.";

export interface RouteMetaEntry {
  title: string;
  description: string;
  ogType?: string;
}

export interface ResolvedMeta extends RouteMetaEntry {
  canonicalPath: string;
  ogImage?: string;
}

/** Static public routes → metadata. Mirrors each page's <SEOHead> props. */
export const STATIC_ROUTE_META: Record<string, RouteMetaEntry> = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  "/learn": {
    title: "Mortgage Learning Center — Guides for Every Step of Homebuying",
    description:
      "Homiquity's Learning Center: clear, jargon-free guides on getting pre-approved, understanding mortgage types, improving your credit, and buying your first home.",
  },
  "/faq": {
    title: "Mortgage FAQ — Answers to Common Homebuying Questions",
    description:
      "Straight answers to the mortgage questions buyers ask most — pre-approval, credit, down payments, closing, and what to expect at each step.",
  },
  "/glossary": {
    title: "Mortgage Glossary — Plain-English Definitions of Home Loan Terms",
    description:
      "Understand mortgage and homebuying terminology, from APR and escrow to PMI and underwriting — clear definitions with related terms and cross-references.",
  },
  "/resources": {
    title: "Homebuying Resources & Guides",
    description:
      "Curated guides and tools to help you navigate buying a home — from pre-approval and choosing an agent to understanding how mortgages work.",
  },
  "/down-payment-wizard": {
    title: "Down Payment Assistance Finder",
    description:
      "Explore down payment assistance and grant programs — filter by state, first-time buyer status, and credit score to see what each program offers.",
  },
  "/calculators": {
    title: "Mortgage Calculators — Affordability, Payments, Refinance & More",
    description:
      "Free mortgage calculators from Homiquity: home affordability, monthly payment, refinance, rent vs. buy, amortization, home equity, payoff, down payment, and VA/BAH — no sign-up required.",
  },
  "/calculators/mortgage": {
    title: "Mortgage Calculator — Monthly Payment & Cost Breakdown",
    description:
      "Free mortgage calculator. See your estimated monthly payment — principal, interest, taxes, insurance, PMI, and HOA — with an interactive amortization schedule. No sign-up required.",
  },
  "/calculators/rent-vs-buy": {
    title: "Rent vs. Buy Calculator — Compare the True Cost of Renting and Owning",
    description:
      "Free rent vs. buy calculator. Compare monthly costs, equity built, and long-term net worth between renting and owning to see which makes sense for you.",
  },
  "/calculators/affordability": {
    title: "Mortgage Affordability Calculator — How Much Home Can You Afford?",
    description:
      "Free mortgage affordability calculator. Adjust income, monthly debts, down payment, and credit score with interactive sliders to see your comfortable home price range — no sign-up, no credit check.",
  },
  "/calculators/amortization": {
    title: "Amortization Calculator — See Your Full Mortgage Payoff Schedule",
    description:
      "Free amortization calculator. See how much of every mortgage payment goes to principal vs. interest, your full year-by-year payoff schedule, and how extra payments save you interest and time.",
  },
  "/calculators/home-equity": {
    title: "Home Equity Calculator — How Much Equity Do You Have?",
    description:
      "Free home equity calculator. Enter your home's value and what you still owe to see your equity, your loan-to-value, and how much you could potentially borrow with a HELOC or cash-out refinance.",
  },
  "/calculators/payoff": {
    title: "Mortgage Payoff Calculator — Pay Off Your Home Faster",
    description:
      "Free mortgage payoff calculator. See how extra monthly payments, a one-time lump sum, or a biweekly schedule can shorten your loan and save thousands in interest.",
  },
  "/calculators/down-payment": {
    title: "Down Payment Calculator — How Much Cash Do You Need to Buy?",
    description:
      "Free down payment calculator. Enter a home price to see your down payment, estimated closing costs, and the total cash you'll need at the table — plus how much you'd need at 3%, 5%, 10%, and 20% down.",
  },
  "/calculators/bah": {
    title: "BAH Calculator — Turn Your Housing Allowance Into a Home | VA Loan",
    description:
      "Free Basic Allowance for Housing (BAH) calculator for active-duty service members. See how much home your BAH can buy off base with a VA loan — $0 down, no PMI.",
  },
  "/rates": {
    title: "Today's Mortgage Rates",
    description:
      "Compare current mortgage rates and APRs for purchase, refinance, cash-out, HELOC, and VA loans, with the assumptions behind every quote.",
  },
  "/rates/purchase": {
    title: "Purchase Mortgage Rates",
    description:
      "See current purchase mortgage rate and APR trends, with the loan assumptions behind every quote — no personal information required.",
  },
  "/rates/refinance": {
    title: "Refinance Mortgage Rates",
    description:
      "Compare current refinance mortgage rate and APR trends, with the loan assumptions behind every quote — no personal information required.",
  },
  "/rates/cash-out": {
    title: "Cash-Out Refinance Rates",
    description:
      "See current cash-out refinance rate and APR trends, with the loan assumptions behind every quote — no personal information required.",
  },
  "/rates/heloc": {
    title: "HELOC Rates",
    description:
      "Explore current home equity line of credit rate and APR trends, with the assumptions behind every quote — no personal information required.",
  },
  "/rates/va": {
    title: "VA Loan Rates",
    description:
      "See current VA loan rate and APR trends for eligible veterans and service members, with the loan assumptions behind every quote.",
  },
  "/privacy": {
    title: "Privacy Policy",
    description: "How Homiquity collects, uses, and protects your personal information.",
  },
  "/terms": {
    title: "Terms of Service",
    description: "The terms that govern your use of Homiquity.",
  },
  "/disclosures": {
    title: "Disclosures & Licensing",
    description: "Homiquity's mortgage disclosures, licensing, and Equal Housing Opportunity information.",
  },
};

/** Normalize a pathname (drop a trailing slash except root, strip query/hash). */
export function normalizePath(pathname: string): string {
  const clean = pathname.split("?")[0].split("#")[0];
  if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
  return clean || "/";
}

/** Resolve static-route metadata, or null for routes handled dynamically (or unknown). */
export function resolveStaticMeta(pathname: string): ResolvedMeta | null {
  const path = normalizePath(pathname);
  const entry = STATIC_ROUTE_META[path];
  if (!entry) return null;
  return { ...entry, canonicalPath: path };
}

/** Escape a string for safe insertion into an HTML attribute or text node. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render the per-URL <head> SEO block (title/meta/canonical/OG/Twitter). */
export function renderSeoHeadTags(meta: ResolvedMeta): string {
  const title = meta.title.includes("Homiquity") ? meta.title : `${meta.title} | ${SITE_NAME}`;
  const canonical = absoluteUrl(meta.canonicalPath);
  const image = absoluteUrl(meta.ogImage || DEFAULT_OG_IMAGE);
  const ogType = meta.ogType || "website";
  const tags = [
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<title>${escapeHtml(title)}</title>`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:type" content="${escapeHtml(ogType)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ];
  return tags.join("\n    ");
}

/** Render a page-scoped JSON-LD <script> from schema nodes (escaping "<" for safety). */
export function renderJsonLdScript(items: Array<JsonLd | null | undefined>): string {
  const nodes = items.filter(Boolean) as JsonLd[];
  if (nodes.length === 0) return "";
  const json = JSON.stringify(nodes.length === 1 ? nodes[0] : nodes).replace(/</g, "\\u003c");
  return `<script type="application/ld+json" data-page-jsonld>${json}</script>`;
}

const SEO_BLOCK_RE = /<!-- SEO:START[\s\S]*?<!-- SEO:END -->/;

/**
 * Replace the marked SEO block in the index.html template with per-URL head tags,
 * and inject the page JSON-LD before </head>. If the marker is absent (template
 * drift), the head tags are skipped but JSON-LD is still injected — never throws.
 */
export function injectSeo(template: string, headTags: string, jsonLdScript: string): string {
  let html = SEO_BLOCK_RE.test(template) ? template.replace(SEO_BLOCK_RE, headTags) : template;
  if (jsonLdScript) {
    html = html.includes("</head>")
      ? html.replace("</head>", `    ${jsonLdScript}\n  </head>`)
      : html + jsonLdScript;
  }
  return html;
}

/**
 * Ungated, indexable static routes for the sitemap. Gated routes (persona LPs,
 * /apply, /rates/*) are deliberately excluded until the F1 config flip — add them
 * then. Article URLs (/learn/:slug) are appended dynamically from the DB, so new
 * admin-authored articles never drift out of the sitemap. Every path here exists
 * in STATIC_ROUTE_META.
 */
export const SITEMAP_STATIC_PATHS: string[] = [
  "/",
  "/learn",
  "/faq",
  "/glossary",
  "/resources",
  "/down-payment-wizard",
  "/calculators",
  "/calculators/mortgage",
  "/calculators/rent-vs-buy",
  "/calculators/affordability",
  "/calculators/amortization",
  "/calculators/home-equity",
  "/calculators/payoff",
  "/calculators/down-payment",
  "/calculators/bah",
  "/privacy",
  "/terms",
  "/disclosures",
];

export interface SitemapArticle {
  slug: string;
  /** ISO date (YYYY-MM-DD) for <lastmod>; omitted if unknown. */
  lastmod?: string;
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Build the sitemap XML from the static route list + DB-sourced article slugs. */
export function buildSitemapXml(articles: SitemapArticle[]): string {
  const entries: string[] = [];
  for (const routePath of SITEMAP_STATIC_PATHS) {
    entries.push(`  <url><loc>${xmlEscape(absoluteUrl(routePath))}</loc></url>`);
  }
  for (const article of articles) {
    const loc = xmlEscape(absoluteUrl(`/learn/${article.slug}`));
    const lastmod = article.lastmod ? `<lastmod>${xmlEscape(article.lastmod)}</lastmod>` : "";
    entries.push(`  <url><loc>${loc}</loc>${lastmod}</url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
}
