import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  TrendingUp,
  MapPin,
  Percent,
  Shield,
} from "lucide-react";


interface MortgageRateProgram {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  termYears: number | null;
  isAdjustable: boolean | null;
  adjustmentPeriod: string | null;
  loanType: string | null;
  displayOrder: number | null;
  isActive: boolean | null;
}

interface MortgageRate {
  id: string;
  state: string | null;
  zipcode: string | null;
  programId: string;
  rate: string;
  apr: string;
  points: string | null;
  pointsCost: string | null;
  loanAmount: string | null;
  downPaymentPercent: number | null;
  creditScoreMin: number | null;
  isActive: boolean | null;
  effectiveDate: string | null;
  program: MortgageRateProgram;
}

interface RateFormData {
  programId: string;
  state: string | null;
  zipcode: string | null;
  rate: string;
  apr: string;
  points: string;
  pointsCost: string;
  loanAmount: string;
  downPaymentPercent: number | string;
  creditScoreMin: number | string;
  isActive: boolean;
}

interface ProgramFormData {
  name: string;
  slug: string;
  description: string | null;
  termYears: number | null | string;
  isAdjustable: boolean;
  adjustmentPeriod: string | null;
  loanType: string;
  displayOrder: number | string;
  isActive: boolean;
}

export default function AdminRates() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
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

  const createRateMutation = useMutation({
    mutationFn: async (data: RateFormData) => {
      const res = await apiRequest("POST", "/api/admin/mortgage-rates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mortgage-rates"] });
      setRateDialogOpen(false);
      setEditingRate(null);
      toast({ title: "Rate created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create rate", variant: "destructive" });
    },
  });

  const updateRateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RateFormData }) => {
      const res = await apiRequest("PATCH", `/api/admin/mortgage-rates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mortgage-rates"] });
      setRateDialogOpen(false);
      setEditingRate(null);
      toast({ title: "Rate updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update rate", variant: "destructive" });
    },
  });

  const deleteRateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/mortgage-rates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mortgage-rates"] });
      toast({ title: "Rate deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete rate", variant: "destructive" });
    },
  });

  const createProgramMutation = useMutation({
    mutationFn: async (data: ProgramFormData) => {
      const res = await apiRequest("POST", "/api/admin/mortgage-rate-programs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mortgage-rate-programs"] });
      setProgramDialogOpen(false);
      setEditingProgram(null);
      toast({ title: "Program created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create program", variant: "destructive" });
    },
  });

  const updateProgramMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProgramFormData }) => {
      const res = await apiRequest("PATCH", `/api/admin/mortgage-rate-programs/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mortgage-rate-programs"] });
      setProgramDialogOpen(false);
      setEditingProgram(null);
      toast({ title: "Program updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update program", variant: "destructive" });
    },
  });

  const deleteProgramMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/mortgage-rate-programs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mortgage-rate-programs"] });
      toast({ title: "Program deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete program", variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Skeleton className="h-10 w-48 mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
          <p className="text-muted-foreground mb-6">
            You need admin privileges to access this page.
          </p>
          <Button asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
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
                        updateRateMutation.mutate({ id: editingRate.id, data });
                      } else {
                        createRateMutation.mutate(data);
                      }
                    }}
                    isPending={createRateMutation.isPending || updateRateMutation.isPending}
                  />
                </Dialog>
              </CardHeader>
              <CardContent>
                {ratesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
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
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingRate(rate);
                                  setRateDialogOpen(true);
                                }}
                                data-testid={`button-edit-rate-${rate.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteRateMutation.mutate(rate.id)}
                                disabled={deleteRateMutation.isPending}
                                data-testid={`button-delete-rate-${rate.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-4">No rates configured yet</p>
                    <Button
                      onClick={() => {
                        setEditingRate(null);
                        setRateDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Rate
                    </Button>
                  </div>
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
                        updateProgramMutation.mutate({ id: editingProgram.id, data });
                      } else {
                        createProgramMutation.mutate(data);
                      }
                    }}
                    isPending={createProgramMutation.isPending || updateProgramMutation.isPending}
                  />
                </Dialog>
              </CardHeader>
              <CardContent>
                {programsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
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
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingProgram(program);
                                  setProgramDialogOpen(true);
                                }}
                                data-testid={`button-edit-program-${program.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteProgramMutation.mutate(program.id)}
                                disabled={deleteProgramMutation.isPending}
                                data-testid={`button-delete-program-${program.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Percent className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-4">No programs configured yet</p>
                    <Button
                      onClick={() => {
                        setEditingProgram(null);
                        setProgramDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Program
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function RateDialog({
  rate,
  programs,
  onSave,
  isPending,
}: {
  rate: MortgageRate | null;
  programs: MortgageRateProgram[];
  onSave: (data: RateFormData) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    programId: rate?.programId || "",
    state: rate?.state || "",
    zipcode: rate?.zipcode || "",
    rate: rate?.rate || "",
    apr: rate?.apr || "",
    points: rate?.points || "0",
    pointsCost: rate?.pointsCost || "0",
    loanAmount: rate?.loanAmount || "160000",
    downPaymentPercent: rate?.downPaymentPercent?.toString() || "20",
    creditScoreMin: rate?.creditScoreMin?.toString() || "760",
    isActive: rate?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      state: formData.state || null,
      zipcode: formData.zipcode || null,
      downPaymentPercent: parseInt(formData.downPaymentPercent),
      creditScoreMin: parseInt(formData.creditScoreMin),
    });
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{rate ? "Edit Rate" : "Add New Rate"}</DialogTitle>
        <DialogDescription>
          {rate ? "Update the mortgage rate details" : "Create a new mortgage rate entry"}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="programId">Program</Label>
          <Select
            value={formData.programId}
            onValueChange={(value) => setFormData({ ...formData, programId: value })}
          >
            <SelectTrigger data-testid="select-program">
              <SelectValue placeholder="Select program" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((program) => (
                <SelectItem key={program.id} value={program.id}>
                  {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="state">State (optional)</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase().slice(0, 2) })}
              placeholder="CA"
              maxLength={2}
              data-testid="input-state"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zipcode">Zipcode (optional)</Label>
            <Input
              id="zipcode"
              value={formData.zipcode}
              onChange={(e) => setFormData({ ...formData, zipcode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
              placeholder="95833"
              maxLength={5}
              data-testid="input-zipcode"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rate">Rate (%)</Label>
            <Input
              id="rate"
              type="number"
              step="0.001"
              value={formData.rate}
              onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
              placeholder="5.750"
              required
              data-testid="input-rate"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apr">APR (%)</Label>
            <Input
              id="apr"
              type="number"
              step="0.001"
              value={formData.apr}
              onChange={(e) => setFormData({ ...formData, apr: e.target.value })}
              placeholder="5.957"
              required
              data-testid="input-apr"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="points">Points</Label>
            <Input
              id="points"
              type="number"
              step="0.01"
              value={formData.points}
              onChange={(e) => setFormData({ ...formData, points: e.target.value })}
              placeholder="2.21"
              data-testid="input-points"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pointsCost">Points Cost ($)</Label>
            <Input
              id="pointsCost"
              type="number"
              step="1"
              value={formData.pointsCost}
              onChange={(e) => setFormData({ ...formData, pointsCost: e.target.value })}
              placeholder="3542"
              data-testid="input-points-cost"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="isActive">Active</Label>
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            data-testid="switch-active"
          />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isPending || !formData.programId} data-testid="button-save-rate">
            {isPending ? "Saving..." : rate ? "Update Rate" : "Create Rate"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ProgramDialog({
  program,
  onSave,
  isPending,
}: {
  program: MortgageRateProgram | null;
  onSave: (data: ProgramFormData) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    name: program?.name || "",
    slug: program?.slug || "",
    description: program?.description || "",
    termYears: program?.termYears?.toString() || "",
    isAdjustable: program?.isAdjustable || false,
    adjustmentPeriod: program?.adjustmentPeriod || "",
    loanType: program?.loanType || "conventional",
    displayOrder: program?.displayOrder?.toString() || "0",
    isActive: program?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      termYears: formData.termYears ? parseInt(formData.termYears) : null,
      displayOrder: parseInt(formData.displayOrder),
      adjustmentPeriod: formData.adjustmentPeriod || null,
      description: formData.description || null,
    });
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{program ? "Edit Program" : "Add New Program"}</DialogTitle>
        <DialogDescription>
          {program ? "Update the program details" : "Create a new rate program type"}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="30-yr fixed"
            required
            data-testid="input-program-name"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="termYears">Term (years)</Label>
            <Input
              id="termYears"
              type="number"
              value={formData.termYears}
              onChange={(e) => setFormData({ ...formData, termYears: e.target.value })}
              placeholder="30"
              data-testid="input-term-years"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loanType">Loan Type</Label>
            <Select
              value={formData.loanType}
              onValueChange={(value) => setFormData({ ...formData, loanType: value })}
            >
              <SelectTrigger data-testid="select-loan-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conventional">Conventional</SelectItem>
                <SelectItem value="fha">FHA</SelectItem>
                <SelectItem value="va">VA</SelectItem>
                <SelectItem value="usda">USDA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="isAdjustable">Adjustable Rate (ARM)</Label>
          <Switch
            id="isAdjustable"
            checked={formData.isAdjustable}
            onCheckedChange={(checked) => setFormData({ ...formData, isAdjustable: checked })}
            data-testid="switch-adjustable"
          />
        </div>

        {formData.isAdjustable && (
          <div className="space-y-2">
            <Label htmlFor="adjustmentPeriod">Adjustment Period</Label>
            <Input
              id="adjustmentPeriod"
              value={formData.adjustmentPeriod}
              onChange={(e) => setFormData({ ...formData, adjustmentPeriod: e.target.value })}
              placeholder="6m"
              data-testid="input-adjustment-period"
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="programIsActive">Active</Label>
          <Switch
            id="programIsActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            data-testid="switch-program-active"
          />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isPending || !formData.name} data-testid="button-save-program">
            {isPending ? "Saving..." : program ? "Update Program" : "Create Program"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
