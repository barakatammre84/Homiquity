import { Copy } from "lucide-react";
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
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleSelectOptions } from "./RoleSelectOptions";

export function CreateInviteDialog({
  open,
  onOpenChange,
  invitableRoles,
  role,
  onRoleChange,
  email,
  onEmailChange,
  /** Set once the server has minted a code — the dialog then shows the code
   * instead of the form, so the admin cannot generate a second one by
   * mistake while the first is still on screen. */
  generatedCode,
  onCopyCode,
  onGenerate,
  isGenerating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invitableRoles: readonly string[];
  role: string;
  onRoleChange: (role: string) => void;
  email: string;
  onEmailChange: (email: string) => void;
  generatedCode: string;
  onCopyCode: (code: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
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
        {generatedCode ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">Share this invite code:</p>
            <div className="flex items-center justify-center gap-2">
              <code className="px-4 py-2 rounded-lg bg-muted text-lg font-mono font-bold tracking-widest" data-testid="text-new-invite-code">
                {generatedCode}
              </code>
              <Button variant="ghost" size="icon" aria-label="Copy" onClick={() => onCopyCode(generatedCode)} data-testid="button-copy-new-code">
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
              <Select value={role} onValueChange={onRoleChange}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <RoleSelectOptions roles={invitableRoles} />
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email (optional)</label>
              <Input
                placeholder="Restrict to specific email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                data-testid="input-invite-email"
              />
              <p className="text-xs text-muted-foreground">Leave blank to allow anyone with the code to redeem it</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-invite">
            {generatedCode ? "Done" : "Cancel"}
          </Button>
          {!generatedCode && (
            <Button onClick={onGenerate} disabled={!role || isGenerating} data-testid="button-generate-invite">
              {isGenerating ? "Creating..." : "Generate Code"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
