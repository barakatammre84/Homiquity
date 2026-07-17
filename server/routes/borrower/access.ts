// Application-access helpers shared by the borrower route groups (and, via
// the index re-export, by cockpit.ts / scenarios.ts).
import { type IStorage } from "../../storage";
import { isInternalStaffRole } from "@shared/schema";

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).

export async function verifyInternalStaffApplicationAccess(
  storage: IStorage,
  applicationId: string,
  userId: string,
  userRole: string,
): Promise<boolean> {
  if (userRole === "admin") return true;

  const application = await storage.getLoanApplication(applicationId);
  if (!application) return false;

  // Internal staff (lo/loa/processor/underwriter/closer): access if they are the
  // assigned loan officer (denormalized pointer) OR an active deal-team member.
  // This matches the deal-team scoping used by getLoanApplicationWithAccess and
  // the pipeline queue, so any file surfaced in an LO's queue is actually
  // openable in the cockpit/scenarios/task views (previously lo/loa were gated on
  // loanOfficerId alone and could 403 on a file that was in their own queue).
  if (isInternalStaffRole(userRole)) {
    if (application.loanOfficerId === userId) return true;
    const teamMembers = await storage.getDealTeamMembers(applicationId);
    return teamMembers.some(m => m.userId === userId);
  }

  return false;
}

// Mask a URLA personal-info record for external partners: SSN reduced to its
// last 4 digits (e.g. "123-45-6789" -> "•••-••-6789") and DOB dropped entirely.
// Preserves the input type so it maps cleanly over the allPersonalInfo[]
// co-borrower array; callers guard the optional single personalInfo field.
export function maskUrlaPersonalInfo<
  T extends { ssn?: string | null; dateOfBirth?: string | null },
>(pi: T): T {
  const digits = (pi.ssn ?? "").replace(/\D/g, "");
  const last4 = digits.length >= 4 ? digits.slice(-4) : "";
  return {
    ...pi,
    ssn: last4 ? `•••-••-${last4}` : null,
    dateOfBirth: null,
  } as T;
}

