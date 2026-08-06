import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddressInput } from "@/components/AddressInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PRICE_RANGES, PROPERTY_TYPES, TIMELINES } from "./types";

/**
 * Lead capture for an agent referral. The submit-time disclosure ("you agree
 * to be contacted by a Homiquity partner agent…") is consent copy — keep it
 * verbatim and adjacent to the submit control.
 */
export function ReferralRequestDialog({
  open,
  onClose,
  selectedAgentId,
}: {
  open: boolean;
  onClose: () => void;
  selectedAgentId: string | null;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    buyingTimeline: "",
    priceRange: "",
    propertyType: "",
    specialNeeds: "",
    preApproved: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    status: string;
    matchedAgent?: { firstName: string; lastName: string; brokerage: string | null; photoUrl: string | null } | null;
  } | null>(null);

  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData & { preferredAgentId?: string }) => {
      const res = await apiRequest("POST", "/api/agent-referral-requests", data);
      return res.json();
    },
    onSuccess: (result) => {
      setMatchResult(result);
      setSubmitted(true);
      toast({
        title: "Request submitted",
        description: result.status === "matched"
          ? "We found a great agent match for you!"
          : "We'll match you with a top agent within 24 hours.",
      });
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again or call us for help.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.location || !formData.buyingTimeline) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    submitMutation.mutate({
      ...formData,
      preferredAgentId: selectedAgentId || undefined,
    });
  };

  const handleClose = () => {
    setSubmitted(false);
    setMatchResult(null);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      location: "",
      buyingTimeline: "",
      priceRange: "",
      propertyType: "",
      specialNeeds: "",
      preApproved: false,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-referral-request">
        {submitted && matchResult ? (
          <div className="text-center py-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
            >
              <CheckCircle2 className="w-16 h-16 text-success-subtle-foreground mx-auto mb-4" />
            </motion.div>
            <h3 className="text-xl font-bold text-foreground mb-2" data-testid="text-referral-success">
              {matchResult.status === "matched" ? "You've been matched!" : "Request received!"}
            </h3>
            {matchResult.matchedAgent ? (
              <div className="mt-4">
                <p className="text-muted-foreground mb-4">
                  We found a great agent for you. They'll reach out within 24 hours.
                </p>
                <Card className="p-4 inline-flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={matchResult.matchedAgent.photoUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {matchResult.matchedAgent.firstName[0]}
                      {matchResult.matchedAgent.lastName?.[0] || ""}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="font-semibold text-foreground" data-testid="text-matched-agent-name">
                      {matchResult.matchedAgent.firstName} {matchResult.matchedAgent.lastName}
                    </p>
                    {matchResult.matchedAgent.brokerage && (
                      <p className="text-sm text-muted-foreground">{matchResult.matchedAgent.brokerage}</p>
                    )}
                  </div>
                </Card>
              </div>
            ) : (
              <p className="text-muted-foreground">
                We're finding the best agent match for your needs. You'll hear from us within 24 hours.
              </p>
            )}
            <div className="flex flex-col gap-2 mt-6">
              <Button onClick={() => navigate("/apply")} data-testid="button-get-preapproved">
                Get Pre-Approved While You Wait
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button variant="outline" onClick={handleClose} data-testid="button-close-success">
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl" data-testid="text-dialog-title">
                Get connected with a top agent
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Tell us about your home search and we'll match you with the right agent.
              </p>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ref-firstName">First name *</Label>
                  <Input
                    id="ref-firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    data-testid="input-referral-firstname"
                  />
                </div>
                <div>
                  <Label htmlFor="ref-lastName">Last name *</Label>
                  <Input
                    id="ref-lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    data-testid="input-referral-lastname"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ref-email">Email *</Label>
                <Input
                  id="ref-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  data-testid="input-referral-email"
                />
              </div>

              <div>
                <Label htmlFor="ref-phone">Phone</Label>
                <Input
                  id="ref-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  data-testid="input-referral-phone"
                />
              </div>

              <div>
                <Label htmlFor="ref-location">Where are you looking to buy? *</Label>
                <AddressInput
                  placeholder="City, state, or neighborhood"
                  defaultValue={formData.location}
                  mode="location"
                  onChange={(val) => setFormData({ ...formData, location: val })}
                  onSelect={(result) => {
                    const loc = result.city && result.state ? `${result.city}, ${result.state}` : result.formattedAddress;
                    setFormData({ ...formData, location: loc });
                  }}
                />
              </div>

              <div>
                <Label>When are you looking to buy? *</Label>
                <Select
                  value={formData.buyingTimeline}
                  onValueChange={(v) => setFormData({ ...formData, buyingTimeline: v })}
                >
                  <SelectTrigger data-testid="select-referral-timeline">
                    <SelectValue placeholder="Select a timeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMELINES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Price range</Label>
                  <Select
                    value={formData.priceRange}
                    onValueChange={(v) => setFormData({ ...formData, priceRange: v })}
                  >
                    <SelectTrigger data-testid="select-referral-price">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICE_RANGES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Property type</Label>
                  <Select
                    value={formData.propertyType}
                    onValueChange={(v) => setFormData({ ...formData, propertyType: v })}
                  >
                    <SelectTrigger data-testid="select-referral-property-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="ref-needs">Anything specific you need? (optional)</Label>
                <Textarea
                  id="ref-needs"
                  placeholder="e.g. School district preferences, accessibility needs, must-have features..."
                  value={formData.specialNeeds}
                  onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
                  className="resize-none"
                  rows={3}
                  data-testid="input-referral-needs"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-preapproved">
                <input
                  type="checkbox"
                  checked={formData.preApproved}
                  onChange={(e) => setFormData({ ...formData, preApproved: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm text-muted-foreground">I'm already pre-approved for a mortgage</span>
              </label>

              <Button
                type="submit"
                className="w-full"
                disabled={submitMutation.isPending}
                data-testid="button-submit-referral"
              >
                {submitMutation.isPending ? "Submitting..." : "Find My Agent Match"}
                {!submitMutation.isPending && <ArrowRight className="w-4 h-4 ml-1" />}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By submitting, you agree to be contacted by a Homiquity partner agent.
                Your information is secure and never sold to third parties.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
