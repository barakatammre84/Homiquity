import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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

  return useQuery<AffordabilityResult>({
    queryKey: ['/api/borrower-graph/affordability', roundedPrice],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/borrower-graph/affordability?price=${roundedPrice}`);
      return res.json();
    },
    enabled: !!user && !!roundedPrice && roundedPrice > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
