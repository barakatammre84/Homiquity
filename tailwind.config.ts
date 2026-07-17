import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)", /* 12px — cards, modals */
        md: "calc(var(--radius) - 4px)", /* 8px — inputs, selects, buttons */
        sm: "calc(var(--radius) - 8px)", /* 4px — small chips, badges */
      },
      /* Card elevation scale — wires the near-flat neutral --shadow-* vars
         (index.css) so surfaces use a named, tunable card shadow instead of
         Tailwind's stock shadows. A content card on bg-surface uses shadow-card;
         hover lifts to shadow-card-hover; hero/emphasis uses shadow-card-lg.
         Overlays keep Radix's own shadows. See design_guidelines.md → elevation. */
      boxShadow: {
        card: "var(--shadow-sm)",
        "card-hover": "var(--shadow-md)",
        "card-lg": "var(--shadow-lg)",
      },
      colors: {
        // Flat / base colors (regular buttons)
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        // Layer 0-surface: light-gray app/dashboard page ground (bg-surface).
        // White cards sit on it so their shadow-card reads. Public/reading
        // surfaces stay on bg-background.
        surface: {
          DEFAULT: "hsl(var(--surface) / <alpha-value>)",
          foreground: "hsl(var(--surface-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
          subtle: "hsl(var(--destructive-subtle) / <alpha-value>)",
          "subtle-foreground": "hsl(var(--destructive-subtle-foreground) / <alpha-value>)",
        },
        // Semantic pops — the bridge from the CSS vars to utilities. Use these
        // (or the <Badge>/<Alert> variants) instead of raw text-emerald-600 /
        // bg-amber-100 etc. The *-subtle pair is the AA-safe status-chip surface.
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
          subtle: "hsl(var(--success-subtle) / <alpha-value>)",
          "subtle-foreground": "hsl(var(--success-subtle-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
          subtle: "hsl(var(--warning-subtle) / <alpha-value>)",
          "subtle-foreground": "hsl(var(--warning-subtle-foreground) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          foreground: "hsl(var(--info-foreground) / <alpha-value>)",
          subtle: "hsl(var(--info-subtle) / <alpha-value>)",
          "subtle-foreground": "hsl(var(--info-subtle-foreground) / <alpha-value>)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)"
        },
        status: {
          online: "rgb(34 197 94)",
          away: "rgb(245 158 11)",
          busy: "rgb(239 68 68)",
          offline: "rgb(156 163 175)",
          // Semantic pop states — deliberately outside the monochromatic ramp
          // so approvals/alerts stand out in dense pipeline views.
          success: "#10B981", // Day 1 Certainty / auto-approved
          warning: "#F59E0B", // pending loan-officer review
          danger: "#EF4444", // TCPA opt-out / credit alert
        },
        // "Royal Blue Emerald" ramp. The dark end (950/900/700) is a vivid
        // royal-blue gradient used only for the dark hero surfaces on the
        // persona/landing pages; the light end (500→50) stays neutral slate for
        // micro-copy, borders, and section fills. Prefer the semantic tokens
        // (bg-background, text-foreground, …) in components.
        precision: {
          950: "#0A1E52", // deep royal navy — hero gradient anchor
          900: "#1B3B9E", // royal blue — hero gradient mid
          700: "#2456D6", // vivid royal blue — hero gradient end + glow
          500: "#64748B", // Muted Slate — placeholders, micro-copy
          300: "#94A3B8", // slate-400 — hover borders, disabled states
          100: "#E2E8F0", // slate-200 — card hairlines, active input bg
          50: "#F8FAFC", // Ultra-Light Gray — data-section separation
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        display: ["var(--font-serif)"], /* hero/display headings (Source Serif 4) */
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Precision skeleton: field-level loading pulse between ramp stops
        // (slate-200 -> slate-50) instead of a generic gray spinner.
        "skeleton-precision": {
          "0%, 100%": { backgroundColor: "#E2E8F0" },
          "50%": { backgroundColor: "#F8FAFC" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "skeleton-precision": "skeleton-precision 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
