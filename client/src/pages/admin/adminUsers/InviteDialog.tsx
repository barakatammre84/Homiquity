import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy } from "lucide-react";
import { STAFF_ROLES } from "@shared/schema";
import { getRoleConfig } from "@/lib/adminUserDisplay";

// Extracted verbatim from AdminUsers.tsx.
export function InviteDialog({
  open,
  onOpenChange,
  inviteRole,
  onInviteRoleChange,
  inviteEmail,
  onInviteEmailChange,
  copiedCode,
  onCopy,
  onGenerate,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inviteRole: string;
  onInviteRoleChange: (role: string) => void;
  inviteEmail: string;
  onInviteEmailChange: (email: string) => void;
  copiedCode: string;
  onCopy: (code: string) => void;
  onGenerate: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Staff Invite</DialogTitle>
          <DialogDescription>
            Generate an invite code that a user can redeem to get a staff role
          </DialogDescription>
        </DialogHeader>
        {copiedCode ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">Share this invite code:</p>
            <div className="flex items-center justify-center gap-2">
              <code className="px-4 py-2 rounded-lg bg-muted text-lg font-mono font-bold tracking-widest" data-testid="text-new-invite-code">
                {copiedCode}
              </code>
              <Button variant="ghost" size="icon" aria-label="Copy" onClick={() => onCopy(copiedCode)} data-testid="button-copy-new-code">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              The recipient can enter this code in their account settings to activate their staff role.
            </p>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Staff Role</label>
              <Select value={inviteRole} onValueChange={onInviteRoleChange}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.filter(r => r !== "admin").map((role) => {
                    const config = getRoleConfig(role);
                    const Icon = config.icon;
                    return (
                      <SelectItem key={role} value={role}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email (optional)</label>
              <Input
                placeholder="Restrict to specific email"
                value={inviteEmail}
                onChange={(e) => onInviteEmailChange(e.target.value)}
                data-testid="input-invite-email"
              />
              <p className="text-xs text-muted-foreground">Leave blank to allow anyone with the code to redeem it</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-invite">
            {copiedCode ? "Done" : "Cancel"}
          </Button>
          {!copiedCode && (
            <Button onClick={onGenerate} disabled={!inviteRole || isPending} data-testid="button-generate-invite">
              {isPending ? "Creating..." : "Generate Code"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
