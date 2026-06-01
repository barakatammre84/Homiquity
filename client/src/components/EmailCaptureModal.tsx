import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Mail, ArrowRight, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "homiquity_email_capture";
const PAGE_VIEW_KEY = "homiquity_anon_pageviews";
const TRIGGER_THRESHOLD = 3;

interface EmailCaptureState {
  dismissed: boolean;
  captured: boolean;
  dismissedAt?: number;
}

function getState(): EmailCaptureState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { dismissed: false, captured: false };
}

function setState(state: EmailCaptureState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function incrementPageViews(): number {
  try {
    const current = parseInt(localStorage.getItem(PAGE_VIEW_KEY) || "0", 10);
    const next = current + 1;
    localStorage.setItem(PAGE_VIEW_KEY, String(next));
    return next;
  } catch {}
  return 0;
}

export function EmailCaptureModal() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) return;

    const allowedPaths = ["/resources", "/learn", "/education", "/first-time-buyer", "/down-payment-wizard", "/article", "/faq"];
    if (!allowedPaths.some(p => location.startsWith(p))) return;

    const state = getState();
    if (state.captured || state.dismissed) {
      if (state.dismissedAt && Date.now() - state.dismissedAt > 7 * 24 * 60 * 60 * 1000) {
        setState({ dismissed: false, captured: false });
      } else {
        return;
      }
    }

    const views = incrementPageViews();
    if (views >= TRIGGER_THRESHOLD) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading, location]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    setState({ dismissed: true, captured: false, dismissedAt: Date.now() });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const form = e.target as HTMLFormElement;
    const honeypot = (form.elements.namedItem("website") as HTMLInputElement)?.value || "";
    try {
      await fetch("/api/email-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          source: location,
          website: honeypot,
        }),
      });
      setState({ dismissed: false, captured: true });
      setShow(false);
      toast({ title: "You're on the list!", description: "We'll send you helpful mortgage tips and rate updates." });
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }, [email, toast]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}
          data-testid="modal-email-capture-overlay"
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-card rounded-xl shadow-2xl border w-full max-w-sm overflow-hidden"
            data-testid="modal-email-capture"
          >
            <div className="relative p-6">
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
                data-testid="button-dismiss-email-capture"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>

              <div className="text-center mb-5">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Stay in the loop</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Get personalized rate alerts, homebuying tips, and down payment assistance updates.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  data-testid="input-email-capture"
                />
                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" data-testid="input-honeypot" />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={submitting} data-testid="button-submit-email">
                  {submitting ? "Sending..." : "Get Updates"}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>

              <div className="flex items-center justify-center gap-1.5 mt-4">
                <Shield className="h-3 w-3 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">No spam, ever. Unsubscribe anytime.</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
