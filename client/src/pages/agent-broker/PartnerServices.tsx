import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  CreditCard, 
  FileCheck, 
  Home, 
  Plus,
  Building,
} from "lucide-react";

interface PartnerProvider {
  id: string;
  name: string;
  code: string;
  serviceType: string;
  baseFee: string;
  expectedTurnaroundHours: number;
  isTestMode: boolean;
}

interface PartnerOrder {
  id: string;
  applicationId: string;
  providerId: string;
  serviceType: string;
  status: string;
  orderedAt: string;
  completedAt: string | null;
  fee: string;
  creditScoreExperian: number | null;
  creditScoreEquifax: number | null;
  creditScoreTransUnion: number | null;
  appraisedValue: string | null;
  titleStatus: string | null;
  errorMessage: string | null;
}

interface PartnerApplication {
  id: string;
  propertyAddress: string | null;
}

const serviceTypeIcons: Record<string, typeof CreditCard> = {
  credit_report: CreditCard,
  title_search: FileCheck,
  appraisal: Home,
  flood_cert: Building,
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  submitted: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const serviceTypeLabels: Record<string, string> = {
  credit_report: "Credit Report",
  title_search: "Title Search",
  appraisal: "Property Appraisal",
  flood_cert: "Flood Certification",
  verification_employment: "Employment Verification",
  verification_income: "Income Verification",
  verification_assets: "Asset Verification",
};

export default function PartnerServices() {
  const { toast } = useToast();
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedApplication, setSelectedApplication] = useState("");
  const [notes, setNotes] = useState("");

  const { data: providers, isLoading: providersLoading } = useQuery<PartnerProvider[]>({
    queryKey: ["/api/partner-providers"],
  });

  const { data: applications } = useQuery<PartnerApplication[]>({
    queryKey: ["/api/loan-applications"],
  });

  const filteredProviders = providers?.filter(p => p.serviceType === selectedServiceType) || [];

  const createOrderMutation = useMutation({
    mutationFn: async (data: { applicationId: string; providerId: string; serviceType: string; notes?: string }) => {
      return await apiRequest("POST", "/api/partner-orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-orders"] });
      setIsOrderDialogOpen(false);
      resetForm();
      toast({
        title: "Order Created",
        description: "Partner service order has been submitted.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create order",
      });
    },
  });

  const resetForm = () => {
    setSelectedServiceType("");
    setSelectedProvider("");
    setSelectedApplication("");
    setNotes("");
  };

  const handleCreateOrder = () => {
    if (!selectedApplication || !selectedProvider || !selectedServiceType) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select an application, service type, and provider.",
      });
      return;
    }

    createOrderMutation.mutate({
      applicationId: selectedApplication,
      providerId: selectedProvider,
      serviceType: selectedServiceType,
      notes: notes || undefined,
    });
  };

  const serviceTypes = Array.from(new Set(providers?.map(p => p.serviceType) || []));

  if (providersLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading partner services...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-partner-services-title">Partner Services</h1>
          <p className="text-muted-foreground">Order credit reports, appraisals, title searches, and more</p>
        </div>
        <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-order">
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Partner Service Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Loan Application</Label>
                <Select value={selectedApplication} onValueChange={setSelectedApplication}>
                  <SelectTrigger data-testid="select-application">
                    <SelectValue placeholder="Select application" />
                  </SelectTrigger>
                  <SelectContent>
                    {applications?.map((app: PartnerApplication) => (
                      <SelectItem key={app.id} value={app.id}>
                        {app.propertyAddress || `Application ${app.id.slice(0, 8)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select value={selectedServiceType} onValueChange={(v) => {
                  setSelectedServiceType(v);
                  setSelectedProvider("");
                }}>
                  <SelectTrigger data-testid="select-service-type">
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {serviceTypeLabels[type] || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider} disabled={!selectedServiceType}>
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue placeholder={selectedServiceType ? "Select provider" : "Select service type first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredProviders.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{provider.name}</span>
                          {provider.baseFee && (
                            <span className="text-muted-foreground ml-2">
                              ${parseFloat(provider.baseFee).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special instructions..."
                  data-testid="input-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOrderDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateOrder}
                disabled={createOrderMutation.isPending}
                data-testid="button-submit-order"
              >
                {createOrderMutation.isPending ? "Creating..." : "Create Order"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {serviceTypes.map((serviceType) => {
          const Icon = serviceTypeIcons[serviceType] || Building;
          const typeProviders = providers?.filter(p => p.serviceType === serviceType) || [];
          
          return (
            <Card key={serviceType} data-testid={`card-service-${serviceType}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {serviceTypeLabels[serviceType] || serviceType}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{typeProviders.length}</div>
                <p className="text-xs text-muted-foreground">Available providers</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Providers</CardTitle>
          <CardDescription>Integrated partner services for mortgage processing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {providers?.map((provider) => {
              const Icon = serviceTypeIcons[provider.serviceType] || Building;
              
              return (
                <Card key={provider.id} className="relative" data-testid={`card-provider-${provider.code}`}>
                  {provider.isTestMode && (
                    <Badge className="absolute top-2 right-2 bg-yellow-100 text-yellow-800">
                      Test Mode
                    </Badge>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                        <CardDescription>
                          {serviceTypeLabels[provider.serviceType] || provider.serviceType}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Base Fee:</span>
                      <span className="font-medium">
                        {provider.baseFee ? `$${parseFloat(provider.baseFee).toFixed(2)}` : "Contact for pricing"}
                      </span>
                    </div>
                    {provider.expectedTurnaroundHours && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Turnaround:</span>
                        <span className="font-medium">
                          {provider.expectedTurnaroundHours < 24 
                            ? `${provider.expectedTurnaroundHours} hours`
                            : `${Math.ceil(provider.expectedTurnaroundHours / 24)} days`
                          }
                        </span>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        setSelectedServiceType(provider.serviceType);
                        setSelectedProvider(provider.id);
                        setIsOrderDialogOpen(true);
                      }}
                      data-testid={`button-order-${provider.code}`}
                    >
                      Order Service
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {(!providers || providers.length === 0) && (
            <div className="text-center py-12">
              <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No Providers Configured</h3>
              <p className="text-muted-foreground">
                Partner service providers will appear here once configured by an administrator.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}