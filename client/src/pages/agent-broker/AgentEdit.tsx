import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";

import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AgentProfile } from "@shared/schema";
import { ChevronLeft, X } from "lucide-react";

const SPECIALTIES = [
  "first_time_buyers",
  "luxury",
  "investment",
  "commercial",
  "short_sales",
  "foreclosures",
];

export default function AgentEdit() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: agent, isLoading } = useQuery<AgentProfile>({
    queryKey: ["/api/me/agent-profile"],
  });

  const [formData, setFormData] = useState({
    bio: agent?.bio || "",
    phoneNumber: agent?.phoneNumber || "",
    licenseNumber: agent?.licenseNumber || "",
    licenseExpiry: agent?.licenseExpiry || "",
    brokerage: agent?.brokerage || "",
    yearsInBusiness: agent?.yearsInBusiness || 0,
    specialties: agent?.specialties || [],
    serviceArea: agent?.serviceArea || [],
    website: agent?.website || "",
    socialLinks: agent?.socialLinks as Record<string, string> || {},
  });

  const [newSpecialty, setNewSpecialty] = useState("");
  const [newArea, setNewArea] = useState("");

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("PATCH", "/api/me/agent-profile", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/me/agent-profile"] });
      navigate("/agent/dashboard");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
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

  const addSpecialty = () => {
    if (newSpecialty && !formData.specialties.includes(newSpecialty)) {
      setFormData({
        ...formData,
        specialties: [...formData.specialties, newSpecialty],
      });
      setNewSpecialty("");
    }
  };

  const removeSpecialty = (specialty: string) => {
    setFormData({
      ...formData,
      specialties: formData.specialties.filter((s) => s !== specialty),
    });
  };

  const addArea = () => {
    if (newArea && !formData.serviceArea.includes(newArea)) {
      setFormData({
        ...formData,
        serviceArea: [...formData.serviceArea, newArea],
      });
      setNewArea("");
    }
  };

  const removeArea = (area: string) => {
    setFormData({
      ...formData,
      serviceArea: formData.serviceArea.filter((a) => a !== area),
    });
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
            <CardTitle>Edit Agent Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-semibold">Basic Information</h3>

                <div>
                  <label className="text-sm font-medium">Bio</label>
                  <Textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell buyers about yourself..."
                    className="mt-1"
                    rows={3}
                    data-testid="textarea-bio"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Phone Number</label>
                    <Input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, phoneNumber: e.target.value })
                      }
                      placeholder="(555) 123-4567"
                      className="mt-1"
                      data-testid="input-phone"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Website</label>
                    <Input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://example.com"
                      className="mt-1"
                      data-testid="input-website"
                    />
                  </div>
                </div>
              </div>

              {/* License Information */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold">License Information</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">License Number</label>
                    <Input
                      value={formData.licenseNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, licenseNumber: e.target.value })
                      }
                      placeholder="123456"
                      className="mt-1"
                      data-testid="input-license"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">License Expiry</label>
                    <Input
                      type="date"
                      value={formData.licenseExpiry}
                      onChange={(e) =>
                        setFormData({ ...formData, licenseExpiry: e.target.value })
                      }
                      className="mt-1"
                      data-testid="input-license-expiry"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Brokerage</label>
                    <Input
                      value={formData.brokerage}
                      onChange={(e) =>
                        setFormData({ ...formData, brokerage: e.target.value })
                      }
                      placeholder="ABC Realty Group"
                      className="mt-1"
                      data-testid="input-brokerage"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Years in Business</label>
                    <Input
                      type="number"
                      value={formData.yearsInBusiness}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          yearsInBusiness: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="5"
                      className="mt-1"
                      data-testid="input-years"
                    />
                  </div>
                </div>
              </div>

              {/* Specialties */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold">Specialties</h3>

                <div className="flex gap-2">
                  <select
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    className="rounded border px-2 py-1 text-sm"
                    data-testid="select-specialty"
                  >
                    <option value="">Select specialty...</option>
                    {SPECIALTIES.map((specialty) => (
                      <option key={specialty} value={specialty}>
                        {specialty.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <Button type="button" onClick={addSpecialty} size="sm" variant="outline">
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.specialties.map((specialty) => (
                    <Badge key={specialty} className="gap-1 pr-1">
                      {specialty.replace(/_/g, " ")}
                      <button
                        type="button"
                        onClick={() => removeSpecialty(specialty)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Service Areas */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold">Service Areas</h3>

                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    placeholder="e.g., California, Los Angeles County"
                    className="text-sm"
                    data-testid="input-service-area"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addArea();
                      }
                    }}
                  />
                  <Button type="button" onClick={addArea} size="sm" variant="outline">
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.serviceArea.map((area) => (
                    <Badge key={area} variant="outline" className="gap-1 pr-1">
                      {area}
                      <button
                        type="button"
                        onClick={() => removeArea(area)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Social Links */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold">Social Links</h3>

                <div className="grid grid-cols-2 gap-4">
                  {["twitter", "instagram", "facebook"].map((platform) => (
                    <div key={platform}>
                      <label className="text-sm font-medium capitalize">{platform}</label>
                      <Input
                        type="url"
                        value={formData.socialLinks[platform] || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            socialLinks: {
                              ...formData.socialLinks,
                              [platform]: e.target.value,
                            },
                          })
                        }
                        placeholder={`https://${platform}.com/...`}
                        className="mt-1 text-sm"
                        data-testid={`input-${platform}`}
                      />
                    </div>
                  ))}
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
                  {saveMutation.isPending ? "Saving..." : "Save Profile"}
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
