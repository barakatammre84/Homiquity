import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import type { HomeownerProfile } from "./homeownerDashboard/types";
import { SetupForm } from "./homeownerDashboard/SetupForm";
import { DashboardView } from "./homeownerDashboard/DashboardView";

export default function HomeownerDashboard() {
  const { data: profile, isLoading } = useQuery<HomeownerProfile | null>({
    queryKey: ["/api/homeowner/profile"],
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!profile) {
    return <SetupForm />;
  }

  return <DashboardView profile={profile} />;
}
