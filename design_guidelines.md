# Design Guidelines: AI-Powered Mortgage Lending Platform

## Design Approach
**Reference-Based: Better.com Benchmark**

Drawing from Better.com's digital-first mortgage experience: clean minimalism, data transparency, speed-focused interactions, and trust-building through clarity. The platform prioritizes efficiency and professionalism while making complex financial decisions accessible.

## Core Design Principles
1. **Radical Transparency**: Every loan detail, rate, and cost visible upfront
2. **Speed Indicators**: Show progress, time estimates prominently (e.g., "3-minute pre-approval")
3. **Trust Through Clarity**: Clean layouts, professional typography, no visual clutter
4. **Data-Driven Design**: Financial comparisons as visual centerpieces

## Typography System

**Font Stack**: Inter or Work Sans via Google Fonts CDN
- **Headings**: Font weight 600-700, tight letter spacing (-0.02em)
- **Body**: Font weight 400, line height 1.6
- **Financial Data**: Font weight 500-600, tabular numbers
- **Micro-copy**: Font weight 400, size 0.875rem

**Hierarchy**:
- Hero Headlines: 3rem (mobile) / 4.5rem (desktop)
- Section Headers: 2rem / 3rem
- Card Titles: 1.25rem / 1.5rem
- Body Text: 1rem
- Labels/Captions: 0.875rem
- Financial Figures: 1.5rem-2rem (prominent display)

## Layout System

**Spacing Primitives**: Tailwind units 2, 4, 6, 8, 12, 16
- Component padding: p-6 to p-8
- Section spacing: py-12 (mobile) / py-16 (desktop)
- Card gaps: gap-4 to gap-6
- Form field spacing: space-y-4

**Grid Structure**:
- Max-width containers: max-w-7xl for main content
- Form sections: max-w-2xl (centered, focused)
- Dashboard grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Loan comparison: grid-cols-1 lg:grid-cols-3 (side-by-side cards)

## Component Library

### Navigation
- Sticky top navigation with minimal height (h-16)
- Logo left, primary actions right (Login/Get Started)
- Burger menu for mobile, horizontal for desktop
- Persistent CTA button in nav (e.g., "Get Pre-Approved")

### Hero Section
- Full-width, 85vh viewport height
- Large hero image: modern home exterior or family in new home (professional photography)
- Centered content overlay with semi-transparent blur backdrop for text/buttons
- Headline + sub-headline + dual CTAs ("Get Pre-Approved" primary, "Check Rates" secondary)
- Trust indicators below CTAs (e.g., "2.3M+ homes financed | Average 21-day closing")

### Forms (Pre-Approval, Application)
- Single-column layout, max-w-2xl centered
- Large touch-friendly inputs (h-12 minimum)
- Progress indicator at top (step X of Y with visual bar)
- Inline validation with clear error states
- Auto-save indicators ("Saved automatically")
- Primary action button: full-width on mobile, auto-width on desktop

### Loan Comparison Cards
- Three-column grid on desktop, stacked on mobile
- Card structure: Loan type header → Monthly payment (largest text) → Rate/APR → Points → Down payment → Closing costs → Total cost
- Visual distinction for "Recommended" option (subtle border treatment)
- "Lock This Rate" CTA button per card
- Expandable details section for full amortization

### Dashboard Layouts
**Borrower Dashboard**:
- Status timeline component showing stages (Application → Documents → Underwriting → Approved)
- Card grid for: Current loan status, Required documents, Saved properties, Rate watch
- Document upload area with drag-drop zone

**Broker Portal**:
- Stats row: Total referrals, Active loans, Commissions earned
- Table view: Client list with search/filter, loan status badges, action buttons
- Lead marketplace section with pre-approved buyer cards

**Admin Dashboard**:
- KPI metrics row (approval rate, avg processing time, volume)
- Charts: Loan volume over time, approval funnel
- Recent activity feed

### Property Search (MLS Integration)
- Masonry grid layout for property cards (2-3 columns)
- Property card: Large image → Price (prominent) → Address → Beds/Baths/Sqft → "See Loan Options" CTA
- Filter sidebar: Price range, location, property type, beds/baths
- Map view toggle option

### Document Upload
- Drag-drop zone with clear visual feedback
- Document type categorization (Income, Assets, Identification)
- Upload progress indicators
- Thumbnail previews with file names
- Security reassurance text ("Bank-level encryption")

### Status Tracking
- Horizontal stepper on desktop, vertical on mobile
- Clear visual states: Completed (checkmark), Active (pulse), Pending (outline)
- Estimated time remaining per stage
- Notifications area for required actions

## Visual Elements

### Buttons
- Primary: Rounded corners (rounded-lg), h-12 minimum, px-8
- Secondary: Outlined variant with same sizing
- Disabled state: reduced opacity with cursor-not-allowed
- Button on image overlays: backdrop-blur-sm with semi-transparent background

### Cards
- Subtle shadow (shadow-sm), rounded corners (rounded-xl)
- Padding: p-6 to p-8
- Hover state: slight shadow increase (shadow-md)
- Clean borders for separation where needed

### Icons
- **Library**: Heroicons via CDN (outline for nav/secondary, solid for states)
- Size: 20px (standard), 24px (prominent actions)
- Placement: Left of button text, above card titles, inline with data labels

### Data Visualization
- Simple bar charts for loan comparisons
- Timeline/stepper for process tracking
- Percentage indicators for loan-to-value, DTI ratios
- Use HTML/CSS for simple visualizations, Chart.js for complex charts

## Images

### Required Images
1. **Hero Image**: Professional photo of modern home exterior or happy family at new home entrance - full-width, high-quality
2. **About Section**: Team photo or modern office workspace - establishes trust
3. **Property Listings**: MLS property photos - multiple per listing in carousel
4. **Placeholder States**: Generic home icon for properties without images

### Image Treatment
- Hero: Full-bleed with gradient overlay for text legibility
- Property cards: 16:9 aspect ratio, object-cover
- Lazy loading for all non-critical images

## Accessibility
- Form labels always visible (no placeholder-only patterns)
- Focus states: visible outline on all interactive elements
- ARIA labels for icon-only buttons
- Keyboard navigation through all workflows
- Color contrast meeting WCAG AA standards minimum

## Mobile Considerations
- Touch targets: minimum 44x44px
- Single-column forms on mobile
- Collapsible sections for long content
- Bottom-sheet modals for mobile actions
- Sticky CTAs for key actions

## Page-Specific Layouts

### Landing Page
- Hero with image + pre-approval CTA
- Social proof section (stats, testimonials) - 3-column grid
- "How It Works" - 4-step visual process
- Loan comparison preview - showing sample rates
- Broker partnership CTA section
- Footer with quick links, contact, trust badges

### Pre-Approval Flow
- Multi-step form (3-4 steps max)
- Persistent progress bar
- Exit-intent save prompt
- Results page: Approval amount + next steps

### Loan Comparison Page
- Filter controls at top (loan type, term, down payment slider)
- 3-column card grid for loan options
- Sticky "Compare Selected" button
- Detailed breakdown modal on card click

This comprehensive design creates a professional, efficient, and trustworthy mortgage platform matching Better.com's digital-first approach while supporting all core features including pre-approval, loan comparison, property search, and multi-user dashboards.