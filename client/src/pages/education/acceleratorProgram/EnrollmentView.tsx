import { useMutation } from "@tanstack/react-query";
import { GraduationCap, Rocket, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PROGRAM_TYPES } from "./types";

/** Pre-enrollment state: pick a program track. */
export function EnrollmentView() {
  const { toast } = useToast();

  const enrollMutation = useMutation({
    mutationFn: (programType: string) =>
      apiRequest("POST", "/api/accelerator/enrollment", { programType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accelerator/enrollment"] });
      toast({ title: "Enrolled", description: "Welcome to the Homebuyer Accelerator Program!" });
    },
    onError: () => toast({ title: "Error", description: "Failed to enroll. Please try again.", variant: "destructive" }),
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="accelerator-enrollment">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-accelerator-title">
              Homebuyer Accelerator Program
            </h1>
            <p className="text-sm text-muted-foreground">
              A structured coaching program that takes you from aspiring homeowner to confident buyer in 6 phases.
            </p>
          </div>
        </div>
      </div>

      <Card className="mb-6 border-primary/20" data-testid="card-program-intro">
        <CardContent className="py-5">
          <div className="flex items-start gap-3">
            <Rocket className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Your personalized path to homeownership</p>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a program track below to get started. Each track includes milestone tracking,
                coaching sessions, and financial goal monitoring tailored to your situation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        Choose Your Program Track
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="program-type-grid">
        {PROGRAM_TYPES.map((program) => {
          const Icon = program.icon;
          return (
            <Card key={program.key} className="hover-elevate" data-testid={`card-program-${program.key}`}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground" data-testid={`text-program-title-${program.key}`}>
                    {program.title}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4" data-testid={`text-program-desc-${program.key}`}>
                  {program.description}
                </p>
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => enrollMutation.mutate(program.key)}
                  disabled={enrollMutation.isPending}
                  data-testid={`button-enroll-${program.key}`}
                >
                  {enrollMutation.isPending ? "Enrolling..." : "Enroll"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
