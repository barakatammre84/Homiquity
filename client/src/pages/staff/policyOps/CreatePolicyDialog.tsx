import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  INITIAL_POLICY_VERSION,
  POLICY_AUTHORITIES,
  POLICY_PRODUCT_TYPES,
  buildProfileId,
} from "@shared/policyProfileIdentity";

/**
 * Create a new policy draft.
 *
 * POST /api/policy-profiles requires five fields — profileId, authority,
 * productType, version and effectiveDate — so this dialog exists to collect
 * them; the "Create Policy Draft" button previously had no handler at all.
 *
 * The profile id is DERIVED, not typed. Authority, product and effective
 * quarter are exactly what distinguish one policy from another, so
 * {AUTHORITY}_{PRODUCT}_{YYYY}_Q{n} follows from fields the operator has
 * already filled in. It is shown read-only so the operator can see the
 * identifier they are about to create without being able to drift from the
 * convention by hand.
 */
export function CreatePolicyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [authority, setAuthority] = useState<string>("FANNIE");
  const [productType, setProductType] = useState<string>("CONVENTIONAL");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [description, setDescription] = useState("");
  const [bulletinReference, setBulletinReference] = useState("");

  const profileId = effectiveDate ? buildProfileId({ authority, productType, effectiveDate }) : "";

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/policy-profiles", {
        profileId,
        authority,
        productType,
        version: INITIAL_POLICY_VERSION,
        effectiveDate,
        description: description || undefined,
        bulletinReference: bulletinReference || undefined,
      });
      return res.json();
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-profiles"] });
      onOpenChange(false);
      setEffectiveDate("");
      setDescription("");
      setBulletinReference("");
      toast({
        title: "Draft Created",
        description: `${created.profileId} v${created.version} is ready to configure.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Draft Not Created",
        description: error.message || "The policy draft could not be created.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Policy Draft</DialogTitle>
          <DialogDescription>
            A new policy starts at version {INITIAL_POLICY_VERSION} in DRAFT. Add its
            thresholds on the Rules tab, then submit it for approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Authority</Label>
              <Select value={authority} onValueChange={setAuthority}>
                <SelectTrigger data-testid="select-policy-authority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_AUTHORITIES.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product Type</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger data-testid="select-policy-product">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_PRODUCT_TYPES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="effectiveDate">Effective Date</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              data-testid="input-policy-effective-date"
            />
            <p className="text-xs text-muted-foreground">
              Sets the quarter in the profile id.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Profile ID</Label>
            <Input
              value={profileId}
              readOnly
              placeholder="Choose an effective date"
              data-testid="text-policy-profile-id"
            />
            <p className="text-xs text-muted-foreground">
              Derived from authority, product and effective quarter.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulletinReference">Bulletin Reference (optional)</Label>
            <Input
              id="bulletinReference"
              value={bulletinReference}
              onChange={(e) => setBulletinReference(e.target.value)}
              placeholder="e.g. SEL-2026-01"
              data-testid="input-policy-bulletin"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="policyDescription">Description (optional)</Label>
            <Textarea
              id="policyDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              data-testid="input-policy-description"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-policy">
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!effectiveDate || createMutation.isPending}
            data-testid="button-submit-policy"
          >
            {createMutation.isPending ? "Creating…" : "Create Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
