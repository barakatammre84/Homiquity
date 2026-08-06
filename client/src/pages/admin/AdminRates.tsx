import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminCrudMutations } from "@/hooks/useAdminCrudMutations";
import { Plus, ArrowLeft, TrendingUp, MapPin, Percent } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { RateDialog } from "./adminRates/RateDialog";
import { ProgramDialog } from "./adminRates/ProgramDialog";
import { TableLoadingRows, TableEmptyState, RowActions } from "./adminRates/TableStates";
import type {
  MortgageRate,
  MortgageRateProgram,
  RateFormData,
  ProgramFormData,
} from "./adminRates/types";


export default function AdminRates() {
  const { user } = useAuth();
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

  // No role check here on purpose — /admin/rates routes through <AdminPage>.
  // See the note in AdminUsers.tsx; enforced by tests/routeGateDrift.test.ts.
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Mortgage Rates</CardTitle>
                  <CardDescription>
                    Set rates by state, zipcode, or national default
                  </CardDescription>
                </div>
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
              </CardHeader>
              <CardContent>
                {ratesLoading ? (
                  <TableLoadingRows />
                ) : rates && rates.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Program</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>APR</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rates.map((rate) => (
                        <TableRow key={rate.id} data-testid={`row-rate-${rate.id}`}>
                          <TableCell className="font-medium">
                            {rate.program.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {rate.zipcode ? (
                                <span>{rate.zipcode}</span>
                              ) : rate.state ? (
                                <span>{rate.state}</span>
                              ) : (
                                <span className="text-muted-foreground">National</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {parseFloat(rate.rate).toFixed(3)}%
                          </TableCell>
                          <TableCell>
                            {parseFloat(rate.apr).toFixed(3)}%
                          </TableCell>
                          <TableCell>
                            {rate.points ? parseFloat(rate.points).toFixed(2) : "0.00"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={rate.isActive ? "default" : "secondary"}>
                              {rate.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <RowActions
                              entity="rate"
                              id={rate.id}
                              onEdit={() => {
                                setEditingRate(rate);
                                setRateDialogOpen(true);
                              }}
                              onDelete={() => rateMutations.remove.mutate(rate.id)}
                              isDeleting={rateMutations.remove.isPending}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <TableEmptyState
                    icon={TrendingUp}
                    message="No rates configured yet"
                    actionLabel="Add Your First Rate"
                    onAction={() => {
                      setEditingRate(null);
                      setRateDialogOpen(true);
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="programs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Rate Programs</CardTitle>
                  <CardDescription>
                    Define loan program types (e.g., 30-yr fixed, 5/6m ARM)
                  </CardDescription>
                </div>
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
              </CardHeader>
              <CardContent>
                {programsLoading ? (
                  <TableLoadingRows />
                ) : programs && programs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Term</TableHead>
                        <TableHead>Loan Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {programs.map((program) => (
                        <TableRow key={program.id} data-testid={`row-program-${program.id}`}>
                          <TableCell className="font-medium">
                            {program.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant={program.isAdjustable ? "secondary" : "outline"}>
                              {program.isAdjustable ? "Adjustable" : "Fixed"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {program.termYears ? `${program.termYears} years` : "-"}
                            {program.adjustmentPeriod && ` (${program.adjustmentPeriod})`}
                          </TableCell>
                          <TableCell className="capitalize">
                            {program.loanType || "Conventional"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={program.isActive ? "default" : "secondary"}>
                              {program.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <RowActions
                              entity="program"
                              id={program.id}
                              onEdit={() => {
                                setEditingProgram(program);
                                setProgramDialogOpen(true);
                              }}
                              onDelete={() => programMutations.remove.mutate(program.id)}
                              isDeleting={programMutations.remove.isPending}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <TableEmptyState
                    icon={Percent}
                    message="No programs configured yet"
                    actionLabel="Add Your First Program"
                    onAction={() => {
                      setEditingProgram(null);
                      setProgramDialogOpen(true);
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </PageShell>
  );
}
