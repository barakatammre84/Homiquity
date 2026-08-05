import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import type { AcceleratorEnrollment } from "./acceleratorProgram/types";
import { EnrollmentView } from "./acceleratorProgram/EnrollmentView";
import { DashboardView } from "./acceleratorProgram/DashboardView";

export default function AcceleratorProgram() {
  const { data: enrollment, isLoading } = useQuery<AcceleratorEnrollment | null>({
    queryKey: ["/api/accelerator/enrollment"],
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (!enrollment) {
    return <EnrollmentView />;
  }

  return <DashboardView enrollment={enrollment} />;
}
