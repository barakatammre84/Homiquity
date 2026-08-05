import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FilterTab } from "./types";

export interface InviteEmptyStateProps {
  activeFilter: FilterTab;
  onCreateInvite: () => void;
}

export function InviteEmptyState({ activeFilter, onCreateInvite }: InviteEmptyStateProps) {
  return (
    <div className="text-center py-12">
      {activeFilter === "all" ? (
        <>
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No invites yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first invite link to send to a client
          </p>
          <Button onClick={onCreateInvite} data-testid="button-create-first-invite">
            <Plus className="w-4 h-4 mr-2" />
            Create Invite Link
          </Button>
        </>
      ) : (
        <>
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No {activeFilter} invites</h3>
          <p className="text-muted-foreground">
            No invites match the selected filter
          </p>
        </>
      )}
    </div>
  );
}
