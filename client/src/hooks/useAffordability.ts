import { useQuery } from "@tanstack/react-query";
import { borrowerGraphKeys } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export interface AffordabilityResult {
  meetsGuidelines: boolean;
  estimatedDTI: number | null;
  estimatedMonthlyPayment: number | null;
  additionalSavingsNeeded: number | null;
  estimatedDownPayment: number;
  eligibleLoanTypes: string[];
  message: string;
}

export function useAffordability(price: number | null | undefined) {
  const { user } = useAuth();
  const roundedPrice = price ? Math.round(price) : null;

  // No queryFn: the key IS the request. It used to be a bare scalar segment
  // (`[..., roundedPrice]`), which `buildQueryUrl` resolves to
  // `/api/borrower-graph/affordability/450000` — a path the server does not
  // serve. Only the hand-written queryFn made this work, so the key was
  // decorative and the two could drift without anything noticing.
  return useQuery<AffordabilityResult>({
    queryKey: borrowerGraphKeys.affordability(roundedPrice),
    enabled: !!user && !!roundedPrice && roundedPrice > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
