# Homiquity - Clarity for Every Stage of Homeownership

## Overview
Homiquity is a mortgage platform designed to automate and streamline the mortgage process, aiming for 3-minute pre-approvals and clear mortgage decisions. It provides a conversational pre-approval form, a properties marketplace with affordability checks, and comprehensive tools for borrowers and staff. The platform leverages graph-based underwriting logic and document intelligence for data extraction, ensuring deterministic underwriting rules for regulatory compliance and Fair Lending risk mitigation. Homiquity is envisioned as a full-stack homeownership ecosystem with modules for mortgage origination (Homiquity Lend), property search (Homiquity Listings), and AI guidance (Homiquity Coach), with future plans for Title, Protect, and Invest modules.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, Vite, Wouter, and TanStack Query, utilizing a custom design system based on Shadcn/ui (Radix UI) and Tailwind CSS, supporting light and dark themes. The brand uses a premium, distinctive identity with a color palette of Deep Navy, Vibrant Emerald, Warm Amber, and Ocean Blue, and Inter as the primary font. UI elements feature rounded buttons, subtle shadows, and gradient backgrounds. Key UI components include a conversational pre-approval form, a user dashboard, loan options comparison, and a properties marketplace.

The Borrower Portal follows "Calm Path" design principles, focusing on single dominant CTAs, trust layer cards, prominent journey progress steppers with stage time estimates, and collapsible secondary sections. First-visit onboarding uses a focused single-step-at-a-time flow.

The Staff Dashboard (`StaffDashboard.tsx`) acts as a Unified Command Center, integrating pipeline, tasks, compliance, data retention, audit logs, and automation activity. It features KPI cards, pipeline distribution, role-tailored tabs, inline compliance checklists, automation badges, and dedicated tabs for compliance and intelligence metrics.

### Technical Implementations
The backend uses Node.js, Express.js, and TypeScript, with PostgreSQL (Neon serverless) and Drizzle ORM. Authentication supports email/password and social OAuth (Google, LinkedIn, Apple) via Passport.js. Role-Based Access Control (RBAC) is enforced using `requireRole()` middleware. The API is RESTful, includes structured error handling, robust logging, and security measures like Helmet, CSRF protection, and rate limiting. An email notification service uses Nodemailer, and PDFKit generates branded letters.

The platform includes an AI Homebuyer Coach powered by OpenAI GPT-5-mini, a Deterministic Underwriting Engine aligned with Fannie Mae/Freddie Mac rules, a Pricing Engine, and an Underwriting Rules DSL. AI integration is primarily for document data extraction. MISMO 3.4 GSE Compliance is supported via XML export. A Document Management System provides OCR, classification, and data extraction. Other features include a rules-driven Loan Pipeline & Borrower Dashboards, Property Search & Qualification with an affordability marketplace, and Compliance & Security features.

Key features include an Affordability Calculator, a "Can I Afford This Home?" tool for property-specific analysis, and a "Find an Agent" matching page with smart referral requests.

### System Design Choices
The project adopts a domain-based modular structure for both server routes, client pages, and database schemas to enhance maintainability and scalability.

The `BorrowerGraph` service aggregates all user data into a single queryable profile, leveraging a 3-tier data trust model to determine eligibility, readiness, and predictive signals. This powers dashboard integrations and property intelligence features.

The intelligence layer provides foundational data aggregation, state tracking, and matching infrastructure through a defined schema with tables for borrower profiles, real estate owned, lender products, borrower state history, readiness checklist, intent events, lender match results, and anonymized borrower facts. Key services include a borrower state machine, a lender matching engine, and an intent tracker.

The Deep Intelligence Layer extends the platform with closed-loop feedback and predictive signals, including an Analytics Event Pipeline, Outcome Tracker, Document Confidence scoring, and a Predictive Engine. These components provide insights into conversion funnels, document accuracy, predictions, benchmarks, and platform health, displayed through dedicated API routes and within the Staff Dashboard and Borrower PredictionInsights.

## External Dependencies

### Third-Party Services
-   **Neon Database:** Serverless PostgreSQL hosting.
-   **Google Gemini AI:** Used for document data extraction.
-   **OpenAI (via Replit AI Integrations):** Powers the AI Homebuyer Coach (GPT-5-mini).
-   **Plaid:** For automated employment, identity, income, and asset verification.
-   **Redfin (unofficial API):** For property listings search and details.
-   **RapidAPI:** For property lookup and auto-complete services.
-   **Google Maps Platform:** Places API (New) for address autocomplete, Geocoding API for place details, Address Validation API, Maps JavaScript API for interactive maps, Street View Static API for street imagery. Env: `GOOGLE_MAPS_API_KEY`. Backend routes: `server/routes/geocode.ts` — `GET /api/geocode/autocomplete` (supports `mode=address|location` query param for street-level vs city/ZIP searches), `GET /api/geocode/details`, `GET /api/geocode/validate`, `GET /api/config/maps-key`. Frontend components: `AddressInput.tsx` (autocomplete dropdown with `mode` and `onChange` props for controlled text + structured select), `PropertyMap.tsx` (interactive map), `StreetView.tsx` (static street view image). Integrated into: AffordabilityCheck, LivePropertyDetail, PropertyForm, HomeownerDashboard, DealRescue, PreApproval, LoanPipeline, FindAnAgent (hero + referral + directory filter), BuyerProperties, URLAForm (current address + property address).

### UI Component Libraries
-   **Radix UI:** Headless, accessible component primitives.
-   **cmdk:** Command palette component.
-   **react-day-picker:** Calendar/date picker.
-   **recharts:** Data visualization.
-   **embla-carousel-react:** Carousel component.
-   **vaul:** Drawer component.
-   **lucide-react:** Icon library.
-   **framer-motion:** Animation library.