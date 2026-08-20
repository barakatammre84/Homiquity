/**
 * Icon registry — one canonical lucide glyph per concept.
 *
 * The audit found 178 ad-hoc `lucide-react` import sites and the same concept
 * drawn 3–6 ways (e.g. "done" as CheckCircle2 / CheckCircle / CircleCheckBig).
 * Import icons by SEMANTIC NAME from here, not directly from `lucide-react`, so
 * a concept always renders with the same glyph. The concept→glyph decisions and
 * their rationale live in
 * knowledge-base/handbook/design/DESIGN_SYSTEM.md §7 (Iconography).
 *
 * This file is the ONE place allowed to import from `lucide-react` directly.
 *
 * Usage:
 *   import { Icons, iconSize } from "@/lib/icons";
 *   <Icons.done className={iconSize.inline} />
 *   // dynamic:  const Glyph = Icons[name]; <Glyph className={iconSize.emphasis} />
 */
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  DollarSign,
  PiggyBank,
  Banknote,
  Wallet,
  Home,
  Building2,
  User,
  Users,
  FileText,
  FileCheck,
  Paperclip,
  Upload,
  ClipboardCheck,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Info,
  Pencil,
  Plus,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Phone,
  Mail,
  MapPin,
  BarChart3,
  TrendingUp,
  Settings,
  Percent,
  Download,
  XCircle,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Sparkles,
  Send,
} from "lucide-react";

/**
 * Canonical concept → glyph map. Canonical choices are the already-dominant
 * glyph for each concept, to minimise migration when pages adopt the registry.
 */
export const Icons = {
  done: CheckCircle2, // complete / success (dominant: 64 files)
  money: DollarSign, // generic money / price
  savings: PiggyBank, // savings / down payment (reserved sense)
  funding: Banknote, // funding / disbursement (e.g. "Funded")
  assets: Wallet, // bank / asset balances (reserved sense)
  home: Home, // the borrower's home / property (dominant: 72 files)
  lender: Building2, // lender / company / institution
  person: User, // one person
  people: Users, // team / group
  document: FileText, // document (dominant: 143 occ)
  documentVerified: FileCheck, // verified document (reserved sense)
  attachment: Paperclip, // file attachment
  upload: Upload, // "provide a document" action
  tasks: ClipboardCheck, // to-do / checklist
  time: Clock, // time / due
  security: ShieldCheck, // security / encryption / trust
  warning: AlertTriangle, // attention (pairs with warning tokens)
  info: Info, // informational
  edit: Pencil, // edit
  add: Plus, // add / new
  next: ArrowRight, // forward CTA
  navNext: ChevronRight, // nav-row chevron
  navPrev: ChevronLeft, // nav-row chevron, backwards (pager "previous")
  download: Download, // download a file
  reject: XCircle, // reject / deny action (pairs with `done` for verify)
  zoomIn: ZoomIn, // viewer zoom in
  zoomOut: ZoomOut, // viewer zoom out
  rerun: RefreshCw, // re-run / refresh an operation
  calendar: Calendar, // schedule / date
  phone: Phone, // phone
  email: Mail, // email
  location: MapPin, // location / address
  analytics: BarChart3, // analytics / insights
  trend: TrendingUp, // upward trend
  settings: Settings, // settings
  rate: Percent, // rate / pricing
  coach: Sparkles, // the Homi (dominant glyph on /ai-coach)
  send: Send, // submit a chat message (dominant: coach Composer)
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof Icons;

/**
 * Canonical icon size rungs (`h-N w-N` form only). See the standard §3.
 * inline = body default · emphasis = prominent inline · dense = badges ·
 * feature/featureLg = feature blocks · empty = empty-state glyph.
 */
export const iconSize = {
  inline: "h-4 w-4",
  emphasis: "h-5 w-5",
  dense: "h-3.5 w-3.5",
  feature: "h-6 w-6",
  featureLg: "h-8 w-8",
  empty: "h-10 w-10",
} as const;

export type IconSizeRung = keyof typeof iconSize;
