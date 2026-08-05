import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useAdminCrudMutations } from "@/hooks/useAdminCrudMutations";
import { Plus, ArrowLeft, TrendingUp, Percent, Shield } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import type {
  MortgageRate,
  MortgageRateProgram,
  ProgramFormData,
  RateFormData,
} from "./adminRates/types";
import { RatesTable } from "./adminRates/RatesTable";
import { ProgramsTable } from "./adminRates/ProgramsTable";
import { RateDialog } from "./adminRates/RateDialog";
import { ProgramDialog } from "./adminRates/ProgramDialog";

export default function AdminRates() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("rates");
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<MortgageRate | null>(null);
  const [editingProgram, setEditingProgram] = useState<MortgageRateProgram | null>(null);

  const { data: rates, isLoading: ratesLoading } = useQuery<MortgageRate[]>({
    queryKey: ["/api/admin/mortgage-rates"],
    enabled: !!user && user.role === "admin",
  });

  const { data: programs, isLoading: programsLoading } = useQuery<MortgageRateProgram[]>({
    queryKey: ["/api/admin/mortgage-rate-programs"],
    enabled: !!user && user.role === "admin",
  });

  // Both entities follow the admin REST convention, so create/update/delete come
  // from the shared hook. Note these dialogs do NOT reset their form on save
  // (unlike AdminContent's) - onSaved only closes and clears the edit target,
  // preserving the existing behavior.
  const rateMutations = useAdminCrudMutations<RateFormData>({
    endpoint: "/api/admin/mortgage-rates",
    successLabel: "Rate",
    errorLabel: "rate",
    onSaved: () => {
      setRateDialogOpen(false);
      setEditingRate(null);
    },
  });

  const programMutations = useAdminCrudMutations<ProgramFormData>({
    endpoint: "/api/admin/mortgage-rate-programs",
    successLabel: "Program",
    errorLabel: "program",
    onSaved: () => {
      setProgramDialogOpen(false);
      setEditingProgram(null);
    },
  });

  if (authLoading) {
    return (
      <PageShell width="wide">
        <Skeleton className="h-10 w-48 mb-8" />
        <Skeleton className="h-96 w-full" />
      </PageShell>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <PageShell width="wide" className="py-16 text-center">
        <div>
          <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
          <p className="text-muted-foreground mb-6">
            You need admin privileges to access this page.
          </p>
          <Button asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" aria-label="Back" asChild>
              <Link href="/admin" data-testid="button-back-admin">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Mortgage Rates Management</h1>
              <p className="text-muted-foreground">
                Manage mortgage rate programs and rates by location
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="rates" data-testid="tab-rates">
              <TrendingUp className="h-4 w-4 mr-2" />
              Rates
            </TabsTrigger>
            <TabsTrigger value="programs" data-testid="tab-programs">
              <Percent className="h-4 w-4 mr-2" />
              Programs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rates">
            <RatesTable
              rates={rates}
              isLoading={ratesLoading}
              onEdit={(rate) => {
                setEditingRate(rate);
                setRateDialogOpen(true);
              }}
              onDelete={(id) => rateMutations.remove.mutate(id)}
              deletePending={rateMutations.remove.isPending}
              onAddFirst={() => {
                setEditingRate(null);
                setRateDialogOpen(true);
              }}
              headerAction={
                <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingRate(null)} data-testid="button-add-rate">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Rate
                    </Button>
                  </DialogTrigger>
                  <RateDialog
                    rate={editingRate}
                    programs={programs || []}
                    onSave={(data) => {
                      if (editingRate) {
                        rateMutations.update.mutate({ id: editingRate.id, data });
                      } else {
                        rateMutations.create.mutate(data);
                      }
                    }}
                    isPending={rateMutations.isSaving}
                  />
                </Dialog>
              }
            />
          </TabsContent>

          <TabsContent value="programs">
            <ProgramsTable
              programs={programs}
              isLoading={programsLoading}
              onEdit={(program) => {
                setEditingProgram(program);
                setProgramDialogOpen(true);
              }}
              onDelete={(id) => programMutations.remove.mutate(id)}
              deletePending={programMutations.remove.isPending}
              onAddFirst={() => {
                setEditingProgram(null);
                setProgramDialogOpen(true);
              }}
              headerAction={
                <Dialog open={programDialogOpen} onOpenChange={setProgramDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingProgram(null)} data-testid="button-add-program">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Program
                    </Button>
                  </DialogTrigger>
                  <ProgramDialog
                    program={editingProgram}
                    onSave={(data) => {
                      if (editingProgram) {
                        programMutations.update.mutate({ id: editingProgram.id, data });
                      } else {
                        programMutations.create.mutate(data);
                      }
                    }}
                    isPending={programMutations.isSaving}
                  />
                </Dialog>
              }
            />
          </TabsContent>
        </Tabs>
    </PageShell>
  );
}
