# Visual Consistency Standard — Homiquity

> Operational companion to [`design_guidelines.md`](./design_guidelines.md). That file is
> the design *language* (why); this file is the *checklist* you build and review against
> (what, exactly). **Code wins:** tokens live in `client/src/index.css` +
> `tailwind.config.ts`, primitives in `client/src/components/ui/**` and
> `client/src/components/brand/**`. When this doc and the code disagree, fix the doc.
>
> **Status.** Adopted 2026-07-14 as part of the app-wide UX consistency program
> (spacing · depth · icons · graphics). Items marked **⏳** are the adopted target being
> rolled out surface-by-surface (borrower dashboard first); until a surface is converted,
> its prior styling is still correct. Copy/terminology/voice is a **separate later track**
> (compliance-gated) — not covered here.

---

## 1. Spacing & scaffold — quick reference

`PageShell` owns page geometry (see `design_guidelines.md` → *Layout & spacing*). The
canonical values, in one place:

| Dimension | Canonical | Retire |
|---|---|---|
| Container width | `narrow` 2xl (forms) · `content` 4xl (default) · `wide` 6xl (dashboards) · `full` 7xl (data/marketing) | page-level `max-w-xl / 3xl / 5xl` |
| Gutter | `px-4 sm:px-6 lg:px-8` (PageShell) | bespoke `px-4` / `px-4 sm:px-6` at page level |
| Page vertical padding | PageShell `py-8 sm:py-10` | per-page `py-12/16/20/24` (except marketing hero) |
| Section rhythm | `space-y-6` default (`-4` compact, `-8` generous) | everything else at page level |
| Card padding | `p-6` default, `p-4` dense | `p-2 / p-3 / p-8` |
| Page `<h1>` | `text-2xl sm:text-3xl` | `text-xl / 4xl / 5xl` h1s |

⏳ PageShell applies flat `px-4` today; Phase 2 upgrades its gutter to the three-step
`px-4 sm:px-6 lg:px-8` so every page inherits it (one file, not per-page).

**Exceptions (documented, allowed):** full-bleed marketing/hero pages, centered
spinner/empty-state routes, and auth pages (`max-w-md` centered card).

---

## 2. Elevation & surface — quick reference

Wired in `tailwind.config.ts` from the existing `--shadow-*` vars (see
`design_guidelines.md` → *Radii, elevation, motion*):

| Utility | Maps to | Use |
|---|---|---|
| `shadow-card` | `--shadow-sm` | resting content card **on `bg-surface`** |
| `shadow-card-hover` | `--shadow-md` | hover lift on a clickable card (pair with `hover-elevate`) |
| `shadow-card-lg` | `--shadow-lg` | hero-overlapping / emphasis card |

- `--surface: 210 40% 97%` → `bg-surface` — the light-gray **app/dashboard ground**. White
  canvas (Layer 0) stays for public/reading/form surfaces.
- Cards keep their **hairline** (`border-card-border`) as a second separation cue — shadow
  is additive, not a replacement.
- **Retire these ad-hoc surface shadows** (from the audit): `shadow-2xl`
  (`BuyingPowerEstimator.tsx`), `shadow-lg border-0` (`borrower/Documents.tsx`,
  `borrower/Messages.tsx`, `agent-broker/BrokerDashboard.tsx`), one-off colored
  `shadow-primary/25` (`public/Landing.tsx`) and `shadow-primary/5` (`FramedPhoto.tsx`),
  and raw `hover:shadow-md/lg` on cards (`BuyerProperties.tsx`, `CalculatorsHub.tsx`).
  Overlays (popover/dialog/dropdown/toast/sheet) keep their Radix shadows — untouched.

---

## 3. Icon registry (one glyph per concept) ⏳

Import icons **by semantic name** from `client/src/lib/icons.ts`, never directly from
`lucide-react` in a page/component. Canonical glyphs are chosen as the already-dominant
one to minimize migration. The audit found each concept drawn 3–6 ways; this table is the
single source.

| Concept | Canonical | Retire (map to canonical) | Notes |
|---|---|---|---|
| done / complete | `CheckCircle2` | `CheckCircle`, `CircleCheck`, `CircleCheckBig` | dominant already (64 files) |
| money (generic) | `DollarSign` | `CircleDollarSign`, `HandCoins` | |
| savings / down payment | `PiggyBank` | — | reserved sense, not generic money |
| funding / disbursement | `Banknote` | — | reserved sense (e.g. journey "Funded") |
| assets / wallet | `Wallet` | — | reserved sense (bank/asset balances) |
| home / property | `Home` | `House` | dominant (72 files) |
| lender / company / bank | `Building2` | `Building`, `Landmark` | the institution, not the borrower's home |
| person (one) | `User` | `UserCircle`, `CircleUser`, `Contact` | |
| people / team | `Users` | — | |
| document | `FileText` | `File`, `Files` | dominant (143 occ) |
| verified document | `FileCheck` | — | reserved sense |
| attachment | `Paperclip` | — | |
| upload | `Upload` | — | borrower "provide a doc" action |
| tasks / checklist | `ClipboardCheck` | — | the to-do concept |
| time / due | `Clock` | — | |
| security / encryption | `ShieldCheck` | `Shield` | trust/lock surfaces |
| warning / attention | `AlertTriangle` | — | pairs with `warning` tokens |
| info | `Info` | — | |
| success accent | `CheckCircle2` | — | same as "done" |
| edit | `Pencil` | `Edit`, `Edit2`, `Edit3` | |
| add / new | `Plus` | `PlusCircle` | |
| forward / next | `ArrowRight` | `ChevronRight` (nav rows keep Chevron) | |
| calendar / schedule | `Calendar` | `CalendarDays` | |
| phone | `Phone` | — | |
| email | `Mail` | — | |
| location | `MapPin` | — | |
| analytics / insights | `BarChart3` | `LineChart`, `TrendingUp` (trend stays) | |
| settings | `Settings` | — | |
| rate / pricing | `Percent` | — | |

**Sizing (`h-N w-N` only — retire `size-4`):** inline `h-4 w-4` · emphasis `h-5 w-5` ·
badge/dense `h-3.5 w-3.5` · feature `h-6`/`h-8` · empty-state `h-10`. Buttons keep the
internal `[&_svg]:size-4`. Icon-only controls **must** carry `aria-label`.

*Registry shape (Phase 2):* `icons.ts` re-exports the canonical lucide component under a
semantic name (`export { CheckCircle2 as DoneIcon } …`) or a typed record; a lint flags
direct `lucide-react` imports outside `icons.ts` (non-blocking first, then ratcheted).

---

## 4. Brand & `<Logo>` — the white-label mechanism ⏳

**Boundary:** private/authenticated surfaces are tenant-branded; public marketing stays
Homiquity (see `design_guidelines.md` → *Branding & white-label*).

### `<Logo>` — `client/src/components/brand/Logo.tsx`
Replaces the ~13 copy-pasted `homiquity` wordmark spans (`Navigation.tsx:174`,
`app-sidebar.tsx:270`, `Footer.tsx:16`, `PrivateLayout.tsx:103`, and public `Login`,
`Signup`, `VerifyEmail`, `AffordabilityCheck`, `Waitlist`, `PartnerWaitlist`, `Landing`,
`ForgotPassword`, `ResetPassword`, `not-found`) — which today vary in weight
(`font-bold`/`semibold`), size (`text-2xl/xl/sm`) and color (`text-primary` /
`text-sidebar-foreground` / none).

- Props: `size` (`sm | md | lg`), `variant` (`wordmark | mark | lockup`),
  `tone` (`brand | onDark | mono`). One type ramp, one weight, tokenized color.
- **Branding-aware:** reads `BrandingProvider`. On a **private** surface with an active
  tenant, renders the tenant logo (`--brand-logo`) / `brandName`; otherwise the Homiquity
  wordmark + logomark. On **public** surfaces, always Homiquity.
- Logomark: a single inline-SVG mark (brand-token colored) — first real logomark in the app.

### `BrandingProvider` — `client/src/components/brand/BrandingProvider.tsx`
The white-label seam. Mounted on `PrivateLayout` only.

- Resolves the active tenant's co-brand profile (`co_brand_profiles`, keyed by the
  session's LO/broker) and sets the **brandable** CSS vars on the layout root via
  `style`/`setProperty`: `--primary`, `--accent`, `--sidebar`, `--ring`, `--brand-logo`.
  Defaults to Royal Blue Emerald / Homiquity when there is no tenant.
- Because the private UI is built on `bg-primary` / `bg-accent` **semantic** classes, the
  whole portal re-skins automatically — and it stays **token-guard-safe** (no inline hex,
  no raw palette classes in components).
- **Never overrides fixed tokens:** the neutral ramp, `--surface` + elevation, and all
  semantic status tokens (success/warning/info/destructive) are constant across tenants.
- **Contrast:** derive `--primary-foreground` / `--accent-foreground` from the chosen
  color's luminance (or validate the picked color for AA on save). White text is not
  assumed to pass; the co-branding settings color inputs should reject or auto-correct a
  brand color that can't carry accessible text.
- **Out of scope of the token seam:** the pre-existing public co-brand landing
  `/partner/:profileId` (`agent-broker/PartnerLanding.tsx`) keeps its own inline colors.

### Data gaps to close (feature completion, Phase 4)
- `agent-broker/AgentCoBranding.tsx` has **no logo-upload control** and never sends
  `logoUrl`/`heroImageUrl` — add the upload (through the object-storage layer) and wire it
  through the POST/PATCH in `server/routes/agent-broker.ts`.
- Resolve *which* tenant brand an authenticated session uses (LO assigned to the file, or
  the broker org). **Compliance gate before ship** (advertising/NMLS — see below).

---

## 5. Graphics & illustration layer ⏳

Today the authenticated app has **no illustration layer** — one functional SVG in the
whole client, and 11 photos confined to public marketing. The custom graphic layer:

- **`client/src/components/illustrations/`** — a small set of **brand-token-colored inline
  SVG** spot-illustrations (they consume `--primary`/`--accent`/slate tokens, so they
  re-skin per tenant and stay guard-safe). Simple, geometric, on-brand — not stock clip-art.
- **Where they appear:** the primary empty states (see §6) and the dashboard/onboarding
  hero moments. Keep them lightweight (inline, no external requests — matches the CSP/perf
  posture and the marketing photo manifest pattern in `client/src/lib/lifestyleImages.ts`).
- **Scope note:** authored in-repo (simple SVG). Anything requiring commissioned
  art/photography is out of autonomous scope — flag for design.

---

## 6. Empty-state standard ⏳

**`client/src/components/ui/empty-state.tsx` is the only sanctioned zero-state.** It takes
an icon (registry) or an illustration slot (§5) + title + description + optional action.
Today it is used in 2 pages while ~18 hand-roll the generic "lucide icon inside a
`rounded-full bg-muted` circle" look the user called out as feeling stock.

- **Add an `illustration` slot** to `EmptyState` (falls back to a registry icon at `h-10`).
- **Replace the hand-rolled zero-states** — named offenders: `borrower/Dashboard.tsx`,
  `borrower/Tasks.tsx`, `lending/BorrowerDealComparison.tsx`,
  `calculators/MortgageCalculator.tsx`, `calculators/AffordabilityCalculator.tsx`,
  `agent-broker/FindAnAgent.tsx`, `staff/TaskOperations.tsx`,
  `realtor-engine/StrategySessions.tsx` (among ~18). `lending/ApplicationSummary.tsx` uses
  both patterns on one page — consolidate to `EmptyState`.
- The dashboard's own "all caught up" tasks state and RenterHome's `HomeReadinessPassport`
  ring are good references for the target quality.

---

## 7. Reference-surface spec — the borrower dashboard exemplar

The worked example of the whole standard (spacing · surface + `shadow-card` · registry
icons · vertical timeline · branding-aware chrome). Implementation detail:
`client/src/pages/borrower/Dashboard.tsx`.

- **Shell:** `min-h-full bg-surface`; a full-bleed royal-blue **hero** (`bg-accent
  text-accent-foreground` — re-skins to the tenant brand via BrandingProvider; never
  `text-white`), then a `max-w-6xl` two-column grid overlapping the hero (`-mt-8`),
  collapsing to one column on mobile. Keep the existing sidebar chrome — no competing top nav.
- **Left column (wider):** the "next step" card → **Tasks** card (`BorrowerRequests`,
  restyled to an uppercase "TASKS" label + "Complete items" action + "all caught up" empty
  state) → **Loan Progress** card (`JourneyTracker` new `variant="vertical"`: our 7 steps as
  a vertical timeline — COMPLETE = `bg-success` check + green connector, CURRENT =
  `bg-primary` emerald dot [not blue], UPCOMING = gray).
- **Right column (narrower):** **Pre-Approved** card (new `PreApprovedCard` —
  `preApprovalAmount` + "View pre-approval letter" reusing the prequal endpoints; the
  staff-only "Edit" is omitted) → **Contact** card (company contact) → **Loan Team** card
  (assigned LO; NMLS from `user.nmlsId` **only when present**; **no LO phone** — no
  `users.phone` column exists). Contact/Loan-Team are the split of today's combined
  `TrustLayer`.
- **Mobile order:** next-step → Tasks → Pre-Approved → Loan Progress → Contact → Loan Team →
  secondary (FinancialSnapshot / LoanDetails / PredictionInsights / activity, all collapsed).
- **Preserve:** RenterHome empty state, staff redirect, ApplicationSwitcher, status gating,
  every `data-testid`. **Never fabricate** NMLS/phone (compliance).

---

## 8. PageShell adoption checklist (for the propagation sweep)

Converting one of the 57% opt-out pages:

1. Delete the hand-rolled wrapper (`<div className="min-h-screen …">`, `mx-auto max-w-…
   px-… py-…`). If the page already imports PageShell but wraps it in `min-h-screen` (the
   calculators), remove that wrapper.
2. Wrap content in `<PageShell width={narrow|content|wide|full}>` — pick by the table in §1.
   Inside `PrivateLayout`, don't set `fullHeight` (the layout supplies `bg-background`);
   dashboards set `bg-surface` on their own inner ground.
3. Move the page header into `PageHeader` props (`title`/`subtitle`/`icon`/`eyebrow`/
   `headerAction`), passing `titleTestId` to keep the existing `data-testid`. Or omit all
   header fields for a container-only shell and keep your own header as the first child.
4. Replace bespoke `space-y-*`/card padding with the §1 tiers; replace direct `lucide`
   icon imports with the registry (§3); replace hand-rolled zero-states with `EmptyState`
   (§6); on dashboards, adopt `bg-surface` + `shadow-card` (§2).
5. Verify: `node scripts/design-token-guard.cjs` (baseline unchanged) + `pnpm check` + the
   `ux-reviewer` agent.

---

## 9. Enforcement

- **`scripts/design-token-guard.cjs`** — keeps raw palette colors at 0 and `bg-white`/
  `text-white` literals ≤ baseline. All new color goes through tokens (the royal-blue hero
  uses `bg-accent`/`text-accent-foreground`).
- **New lints (⏳, non-blocking → ratcheted):** flag page-level `min-h-screen` hand-rolls
  (PageShell drift) and direct `lucide-react` imports outside `icons.ts` (registry drift).
- **`.claude/agents/ux-reviewer.md`** + the **`ui-components`** skill carry these rules and
  are the review gate for every propagation batch.

## 10. Compliance & scope notes

- **White-label is a licensed-mortgage surface.** Re-skinning to a broker/LO brand raises
  advertising/NMLS questions (advertised entity, whose NMLS shows, any "Powered by
  Homiquity" attribution). Route feature completion through compliance review before ship.
  **Never fabricate NMLS or brand data.**
- **Copy/terminology/voice is a separate later track** — this standard is visual only.
- `knowledge-base/logs/ux-audit/` predates PageShell (2026-07-08) — historical reference,
  not the current standard; this doc supersedes its spacing/elevation notes.
