import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowRight, Info } from "lucide-react";

/**
 * Standing notice on the Policy Operations console.
 *
 * The thresholds edited here are stored and versioned correctly — that part is
 * real. What is not yet true is that they decide anything. The underwriting
 * engine resolves every threshold it uses from the lookup_matrices catalogue
 * via lookupResolver, not from policy_thresholds; searching server/ and
 * shared/ for either policy table returns only the storage layer and the
 * schema definition.
 *
 * Saying so is the same class of fix as removing the "Draft Saved" toast, one
 * level up. There the operator was told a save happened that did not; here an
 * operator could set a DTI cap, see it saved and versioned and approved, and
 * reasonably conclude it now governs underwriting. It does not. On a policy
 * console gated to underwriters and admins, that inference is the dangerous
 * one, and no amount of correct persistence prevents it.
 *
 * This comes down when the engine reads this catalogue — the guard in
 * tests/policyScalarRegistry.test.ts holds the two in step, so the notice
 * cannot be forgotten or removed early.
 */
export function GovernanceNotice() {
  return (
    <Alert data-testid="alert-policy-governance">
      <Info className="h-4 w-4" />
      <AlertTitle>These policies do not yet govern underwriting decisions</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Policies and thresholds here are stored, versioned and approved, but the
          underwriting engine does not read them yet. It resolves the thresholds it
          uses — DTI caps, the credit floor, LTV limits, asset haircuts — from the
          pricing and policy matrices instead.
        </p>
        <p>
          Until the two are consolidated, changing a value here will not change any
          loan decision. Use Pricing Matrices for thresholds that need to take
          effect now.
        </p>
        <Button variant="outline" size="sm" asChild data-testid="button-goto-pricing-matrices">
          <Link href="/pricing-matrices">
            Go to Pricing Matrices
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
