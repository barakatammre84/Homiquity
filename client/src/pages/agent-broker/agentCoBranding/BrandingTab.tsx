import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, Mail, Phone, Shield } from "lucide-react";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  type CoBrandProfile,
} from "./types";

export function BrandingTab({ profile }: { profile: CoBrandProfile | null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    brandName: profile?.brandName || "",
    tagline: profile?.tagline || "",
    contactEmail: profile?.contactEmail || user?.email || "",
    contactPhone: profile?.contactPhone || "",
    websiteUrl: profile?.websiteUrl || "",
    nmlsId: profile?.nmlsId || "",
    licenseNumber: profile?.licenseNumber || "",
    bio: profile?.bio || "",
    disclaimerText: profile?.disclaimerText || "",
    primaryColor: profile?.primaryColor || DEFAULT_PRIMARY_COLOR,
    accentColor: profile?.accentColor || DEFAULT_ACCENT_COLOR,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (profile) {
        return apiRequest("PATCH", `/api/co-brand/profile/${profile.id}`, formData);
      }
      return apiRequest("POST", "/api/co-brand/profile", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/co-brand/profile"] });
      toast({ title: "Saved", description: "Your branding profile has been updated." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save profile", variant: "destructive" }),
  });

  return (
    <div className="space-y-6" data-testid="branding-tab">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand Identity</CardTitle>
          <CardDescription>Configure how your landing pages and pre-approval letters look to clients.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Brand Name</label>
              <Input
                value={formData.brandName}
                onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                placeholder="e.g., Smith Realty Group"
                className="mt-1"
                data-testid="input-brand-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Tagline</label>
              <Input
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                placeholder="e.g., Your trusted home partner"
                className="mt-1"
                data-testid="input-tagline"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Professional Bio</label>
            <Textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Tell clients about your experience and expertise..."
              className="mt-1"
              rows={3}
              data-testid="input-bio"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Contact Email</label>
              <Input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="mt-1"
                data-testid="input-contact-email"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Contact Phone</label>
              <Input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                placeholder="(555) 123-4567"
                className="mt-1"
                data-testid="input-contact-phone"
              />
            </div>
          </div>

          {/* NMLS ID and licence number render on the public /partner/:id page —
              these identify the licensee to consumers, not just this account. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-foreground">Website</label>
              <Input
                value={formData.websiteUrl}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                placeholder="https://yoursite.com"
                className="mt-1"
                data-testid="input-website"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">NMLS ID</label>
              <Input
                value={formData.nmlsId}
                onChange={(e) => setFormData({ ...formData, nmlsId: e.target.value })}
                placeholder="123456"
                className="mt-1"
                data-testid="input-nmls"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">License Number</label>
              <Input
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                className="mt-1"
                data-testid="input-license"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-foreground">Primary Color</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border"
                  data-testid="input-primary-color"
                />
                <span className="text-xs text-muted-foreground">{formData.primaryColor}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Accent Color</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={formData.accentColor}
                  onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border"
                  data-testid="input-accent-color"
                />
                <span className="text-xs text-muted-foreground">{formData.accentColor}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Legal Disclaimer</label>
            <Textarea
              value={formData.disclaimerText}
              onChange={(e) => setFormData({ ...formData, disclaimerText: e.target.value })}
              placeholder="Optional legal disclaimer for your landing pages..."
              className="mt-1"
              rows={2}
              data-testid="input-disclaimer"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={!formData.brandName || saveMutation.isPending} data-testid="button-save-branding">
              {saveMutation.isPending ? "Saving..." : profile ? "Update Branding" : "Create Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {profile && <LandingPagePreview profile={profile} />}
    </div>
  );
}

function LandingPagePreview({ profile }: { profile: CoBrandProfile }) {
  const landingUrl = `${window.location.origin}/partner/${profile.id}`;
  return (
    <Card data-testid="card-preview">
      <CardHeader>
        <CardTitle className="text-base">Landing Page Preview</CardTitle>
        <CardDescription>This is how your co-branded page will appear to clients.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          {/* Inline style, not a token: these are the partner's own brand
              colours, stored per profile — not part of the app's palette. */}
          <div className="p-6 text-white" style={{ background: `linear-gradient(135deg, ${profile.primaryColor}, ${profile.primaryColor}dd)` }}>
            <h3 className="text-lg font-bold">{profile.brandName}</h3>
            {profile.tagline && <p className="mt-1 text-sm opacity-90">{profile.tagline}</p>}
          </div>
          <div className="bg-card p-4">
            {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {profile.contactEmail && (
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{profile.contactEmail}</span>
              )}
              {profile.contactPhone && (
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{profile.contactPhone}</span>
              )}
              {profile.nmlsId && (
                <span className="flex items-center gap-1"><Shield className="h-3 w-3" />NMLS #{profile.nmlsId}</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Input
            readOnly
            value={landingUrl}
            className="text-xs"
            data-testid="input-landing-url"
          />
          <Button
            size="icon" aria-label="Copy"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(landingUrl);
            }}
            data-testid="button-copy-landing-url"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
