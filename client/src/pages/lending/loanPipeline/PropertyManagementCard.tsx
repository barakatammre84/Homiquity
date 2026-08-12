import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Home,
  MapPin,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/AddressInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { apiRequest, loanApplicationKeys } from "@/lib/queryClient";
import type { ApplicationProperty, LoanApplication } from "@shared/schema";

const EMPTY_NEW_PROPERTY = {
  address: "",
  city: "",
  state: "",
  zipCode: "",
  propertyType: "single_family",
  purchasePrice: "",
  downPayment: "",
};

export interface PropertyManagementCardProps {
  applicationId: string;
  application: LoanApplication;
  properties: ApplicationProperty[];
}

export function PropertyManagementCard({ applicationId, application, properties }: PropertyManagementCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddPropertyDialog, setShowAddPropertyDialog] = useState(false);
  const [showDealFellThroughDialog, setShowDealFellThroughDialog] = useState(false);
  const [selectedPropertyForAction, setSelectedPropertyForAction] = useState<string | null>(null);
  const [dealFellThroughReason, setDealFellThroughReason] = useState("");
  const [newProperty, setNewProperty] = useState(EMPTY_NEW_PROPERTY);

  const addPropertyMutation = useMutation({
    mutationFn: async (propertyData: typeof newProperty) => {
      return await apiRequest("POST", `/api/loan-applications/${applicationId}/properties`, propertyData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.properties(applicationId) });
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.detail(applicationId) });
      setShowAddPropertyDialog(false);
      setNewProperty(EMPTY_NEW_PROPERTY);
      toast({
        title: "Property Added",
        description: "New property has been added to your application.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add property. Please try again.",
        variant: "destructive",
      });
    },
  });

  const switchPropertyMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      return await apiRequest("POST", `/api/loan-applications/${applicationId}/properties/${propertyId}/switch`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.properties(applicationId) });
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.detail(applicationId) });
      toast({
        title: "Property Switched",
        description: "Your application has been updated to the new property.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to switch property. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markDealFellThroughMutation = useMutation({
    mutationFn: async ({ propertyId, reason }: { propertyId: string; reason: string }) => {
      return await apiRequest("POST", `/api/loan-applications/${applicationId}/properties/${propertyId}/deal-fell-through`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.properties(applicationId) });
      setShowDealFellThroughDialog(false);
      setSelectedPropertyForAction(null);
      setDealFellThroughReason("");
      toast({
        title: "Deal Status Updated",
        description: "The property has been marked as deal fell through.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update deal status. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <Card data-testid="card-property-management">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Property</CardTitle>
            </div>
            <Dialog open={showAddPropertyDialog} onOpenChange={setShowAddPropertyDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-add-property">
                  <Plus className="mr-1 h-4 w-4" />
                  Add Property
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Property</DialogTitle>
                  <DialogDescription>
                    If your current deal fell through, add a new property to continue with your pre-approval.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Search Address</Label>
                    <AddressInput
                      placeholder="Start typing an address..."
                      onSelect={(result) => setNewProperty({
                        ...newProperty,
                        address: result.streetAddress || result.formattedAddress,
                        city: result.city,
                        state: result.state,
                        zipCode: result.zip,
                      })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        placeholder="City"
                        value={newProperty.city}
                        onChange={(e) => setNewProperty({ ...newProperty, city: e.target.value })}
                        data-testid="input-property-city"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        placeholder="CA"
                        value={newProperty.state}
                        onChange={(e) => setNewProperty({ ...newProperty, state: e.target.value })}
                        data-testid="input-property-state"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="zipCode">Zip Code</Label>
                      <Input
                        id="zipCode"
                        placeholder="90210"
                        value={newProperty.zipCode}
                        onChange={(e) => setNewProperty({ ...newProperty, zipCode: e.target.value })}
                        data-testid="input-property-zip"
                      />
                    </div>
                    <div>
                      <Label htmlFor="propertyType">Property Type</Label>
                      <Select
                        value={newProperty.propertyType}
                        onValueChange={(value) => setNewProperty({ ...newProperty, propertyType: value })}
                      >
                        <SelectTrigger data-testid="select-property-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single_family">Single Family</SelectItem>
                          <SelectItem value="condo">Condo</SelectItem>
                          <SelectItem value="townhouse">Townhouse</SelectItem>
                          <SelectItem value="multi_family">Multi-Family</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="purchasePrice">Purchase Price</Label>
                      <Input
                        id="purchasePrice"
                        placeholder="$500,000"
                        value={newProperty.purchasePrice}
                        onChange={(e) => setNewProperty({ ...newProperty, purchasePrice: e.target.value })}
                        data-testid="input-property-price"
                      />
                    </div>
                    <div>
                      <Label htmlFor="downPayment">Down Payment</Label>
                      <Input
                        id="downPayment"
                        placeholder="$100,000"
                        value={newProperty.downPayment}
                        onChange={(e) => setNewProperty({ ...newProperty, downPayment: e.target.value })}
                        data-testid="input-property-downpayment"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddPropertyDialog(false)}
                    data-testid="button-cancel-add-property"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => addPropertyMutation.mutate(newProperty)}
                    disabled={!newProperty.address || !newProperty.purchasePrice || addPropertyMutation.isPending}
                    data-testid="button-submit-property"
                  >
                    {addPropertyMutation.isPending ? "Adding..." : "Add Property"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>
            {properties.length > 1
              ? `You have ${properties.length} properties on this application`
              : "Manage properties for your loan application"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {properties.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
              <Home className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No properties added yet</p>
              <p className="text-xs mt-1">
                {application.propertyAddress
                  ? `Current: ${application.propertyAddress}`
                  : "Add a property to track your home purchase"}
              </p>
            </div>
          ) : (
            properties.map((property) => (
              <div
                key={property.id}
                className={`rounded-lg border p-4 ${
                  property.isCurrentProperty ? "border-primary bg-primary/5" : ""
                } ${property.status === "deal_fell_through" ? "opacity-60" : ""}`}
                data-testid={`property-card-${property.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{property.address}</p>
                      {property.isCurrentProperty && (
                        <Badge variant="default" className="text-xs" data-testid="badge-current-property">
                          Current
                        </Badge>
                      )}
                      {property.status === "deal_fell_through" && (
                        <Badge variant="secondary" className="text-xs">
                          Deal Fell Through
                        </Badge>
                      )}
                      {property.status === "offer_pending" && (
                        <Badge variant="outline" className="text-xs">
                          Offer Pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {[property.city, property.state, property.zipCode].filter(Boolean).join(", ")}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span>
                        <span className="text-muted-foreground">Price:</span>{" "}
                        <span className="font-medium">{formatCurrency(property.purchasePrice)}</span>
                      </span>
                      {property.downPayment && (
                        <span>
                          <span className="text-muted-foreground">Down:</span>{" "}
                          <span className="font-medium">{formatCurrency(property.downPayment)}</span>
                        </span>
                      )}
                    </div>
                    {property.notes && property.status === "deal_fell_through" && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        Reason: {property.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {!property.isCurrentProperty && property.status !== "deal_fell_through" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => switchPropertyMutation.mutate(property.id)}
                        disabled={switchPropertyMutation.isPending}
                        data-testid={`button-switch-property-${property.id}`}
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Switch
                      </Button>
                    )}
                    {property.isCurrentProperty && property.status !== "deal_fell_through" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setSelectedPropertyForAction(property.id);
                          setShowDealFellThroughDialog(true);
                        }}
                        data-testid={`button-deal-fell-through-${property.id}`}
                      >
                        <XCircle className="mr-1 h-3 w-3" />
                        Deal Fell Through
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={showDealFellThroughDialog} onOpenChange={setShowDealFellThroughDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deal Fell Through</DialogTitle>
            <DialogDescription>
              We're sorry to hear that. Let us know why so we can help you find a new property.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Inspection issues, seller backed out, financing issues..."
              value={dealFellThroughReason}
              onChange={(e) => setDealFellThroughReason(e.target.value)}
              className="mt-2"
              data-testid="input-deal-fell-through-reason"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDealFellThroughDialog(false);
                setSelectedPropertyForAction(null);
                setDealFellThroughReason("");
              }}
              data-testid="button-cancel-deal-fell-through"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedPropertyForAction) {
                  markDealFellThroughMutation.mutate({
                    propertyId: selectedPropertyForAction,
                    reason: dealFellThroughReason,
                  });
                }
              }}
              disabled={markDealFellThroughMutation.isPending}
              data-testid="button-confirm-deal-fell-through"
            >
              {markDealFellThroughMutation.isPending ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
