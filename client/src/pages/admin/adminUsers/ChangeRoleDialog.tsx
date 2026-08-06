import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getInitials, getDisplayName } from "@/lib/adminUserDisplay";
import { RoleSelectOptions } from "./RoleSelectOptions";
import type { User } from "./types";

export function ChangeRoleDialog({
  open,
  onOpenChange,
  user,
  roles,
  newRole,
  onNewRoleChange,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  roles: readonly string[];
  newRole: string;
  onNewRoleChange: (role: string) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change User Role</DialogTitle>
          <DialogDescription>
            Update the role for {user ? getDisplayName(user) : "this user"}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center gap-4 mb-6 p-4 rounded-lg bg-muted">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback>{user ? getInitials(user) : "U"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user ? getDisplayName(user) : ""}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Select New Role</label>
            <Select value={newRole} onValueChange={onNewRoleChange}>
              <SelectTrigger data-testid="select-new-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <RoleSelectOptions roles={roles} />
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-role">
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving || newRole === user?.role}
            data-testid="button-save-role"
          >
            {isSaving ? "Saving..." : "Update Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
