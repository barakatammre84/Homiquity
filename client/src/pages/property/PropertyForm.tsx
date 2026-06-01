import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";

import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressInput } from "@/components/AddressInput";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Property } from "@shared/schema";
import { ChevronLeft } from "lucide-react";

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
];

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export default function PropertyForm() {
  const params = useParams();
  const [, navigate] = useLocation();
  const propertyId = params?.propertyId as string | undefined;
  const { toast } = useToast();

  const { data: property, isLoading } = useQuery<Property>({
    queryKey: propertyId ? [`/api/properties/${propertyId}`] : [],
    enabled: !!propertyId,
  });

  const [formData, setFormData] = useState({
    address: property?.address || "",
    city: property?.city || "",
    state: property?.state || "",
    zipCode: property?.zipCode || "",
    price: property?.price ? parseFloat(String(property.price)) : 0,
    propertyType: property?.propertyType || "",
    bedrooms: property?.bedrooms || 0,
    bathrooms: property?.bathrooms ? parseFloat(String(property.bathrooms)) : 0,
    squareFeet: property?.squareFeet || 0,
    lotSize: property?.lotSize ? parseFloat(String(property.lotSize)) : 0,
    yearBuilt: property?.yearBuilt || new Date().getFullYear(),
    description: property?.description || "",
    status: property?.status || "active",
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest(
        propertyId ? "PATCH" : "POST",
        propertyId ? `/api/properties/${propertyId}` : "/api/properties",
        data
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: propertyId ? "Property updated successfully" : "Property created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/me/listings"] });
      navigate("/agent/dashboard");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save property",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-12">Loading...</div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/agent/dashboard")}
          className="mb-6 gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{propertyId ? "Edit Property" : "Create New Listing"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Address Section */}
              <div className="space-y-4">
                <h3 className="font-semibold">Address</h3>
                <div>
                  <label className="text-sm font-medium">Search Address *</label>
                  <AddressInput
                    placeholder="Start typing an address..."
                    className="mt-1"
                    defaultValue={formData.address ? `${formData.address}, ${formData.city}, ${formData.state} ${formData.zipCode}` : ""}
                    onSelect={(result) => {
                      setFormData({
                        ...formData,
                        address: result.streetAddress || result.formattedAddress,
                        city: result.city,
                        state: result.state,
                        zipCode: result.zip,
                      });
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">City *</label>
                    <Input
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="New York"
                      className="mt-1"
                      data-testid="input-city"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">State *</label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) =>
                        setFormData({ ...formData, state: value })
                      }
                    >
                      <SelectTrigger data-testid="select-state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">ZIP Code *</label>
                  <Input
                    required
                    value={formData.zipCode}
                    onChange={(e) =>
                      setFormData({ ...formData, zipCode: e.target.value })
                    }
                    placeholder="10001"
                    className="mt-1"
                    data-testid="input-zip"
                  />
                </div>
              </div>

              {/* Property Details Section */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold">Property Details</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Property Type *</label>
                    <Select
                      value={formData.propertyType}
                      onValueChange={(value) =>
                        setFormData({ ...formData, propertyType: value })
                      }
                    >
                      <SelectTrigger data-testid="select-property-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROPERTY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Price *</label>
                    <Input
                      required
                      type="number"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="500000"
                      className="mt-1"
                      data-testid="input-price"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Bedrooms</label>
                    <Input
                      type="number"
                      value={formData.bedrooms}
                      onChange={(e) =>
                        setFormData({ ...formData, bedrooms: parseInt(e.target.value) || 0 })
                      }
                      placeholder="3"
                      className="mt-1"
                      data-testid="input-bedrooms"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Bathrooms</label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.bathrooms}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bathrooms: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="2"
                      className="mt-1"
                      data-testid="input-bathrooms"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Square Feet</label>
                    <Input
                      type="number"
                      value={formData.squareFeet}
                      onChange={(e) =>
                        setFormData({ ...formData, squareFeet: parseInt(e.target.value) || 0 })
                      }
                      placeholder="2000"
                      className="mt-1"
                      data-testid="input-square-feet"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Lot Size (sq ft)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.lotSize}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lotSize: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="5000"
                      className="mt-1"
                      data-testid="input-lot-size"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Year Built</label>
                    <Input
                      type="number"
                      value={formData.yearBuilt}
                      onChange={(e) =>
                        setFormData({ ...formData, yearBuilt: parseInt(e.target.value) || 0 })
                      }
                      placeholder={new Date().getFullYear().toString()}
                      className="mt-1"
                      data-testid="input-year-built"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold">Description</h3>
                <div>
                  <label className="text-sm font-medium">Property Description</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Describe the property, amenities, and special features..."
                    className="mt-1"
                    rows={4}
                    data-testid="textarea-description"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4 border-t pt-6">
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex-1"
                  data-testid="button-submit"
                >
                  {saveMutation.isPending
                    ? "Saving..."
                    : propertyId
                      ? "Update Property"
                      : "Create Property"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/agent/dashboard")}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
