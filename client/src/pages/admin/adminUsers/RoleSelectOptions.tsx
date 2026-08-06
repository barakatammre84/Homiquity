import { SelectItem } from "@/components/ui/select";
import { getRoleConfig } from "@/lib/adminUserDisplay";

/**
 * Icon + label options for a role picker. Both role dialogs rendered this same
 * map — one over every role, one over the invitable staff roles — so the two
 * pickers stay visually identical by construction rather than by review.
 */
export function RoleSelectOptions({ roles }: { roles: readonly string[] }) {
  return (
    <>
      {roles.map((role) => {
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
    </>
  );
}
