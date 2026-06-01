import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";

import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AgentProfile, Property } from "@shared/schema";
import {
  Home,
  Plus,
  Edit,
  Trash2,
  Eye,
  DollarSign,
  TrendingUp,
  Calendar,
  MapPin,
} from "lucide-react";

interface AgentWithData extends AgentProfile {
  user?: { email: string; firstName: string; lastName: string };
}

export default function AgentDashboard() {
  const { toast } = useToast();
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);

  const { data: agent, isLoading: agentLoading } = useQuery<AgentWithData>({
    queryKey: ["/api/me/agent-profile"],
  });

  const { data: listings, isLoading: listingsLoading } = useQuery<Property[]>({
    queryKey: ["/api/me/listings"],
  });

  const deleteListingMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      await apiRequest("DELETE", `/api/properties/${propertyId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Property deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/me/listings"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete property",
        variant: "destructive",
      });
    },
  });

  const isLoading = agentLoading || listingsLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Agent Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary-foreground/80 mb-2">
                <Home className="h-4 w-4" />
                <span className="text-sm font-medium">Real Estate Partner</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Agent Dashboard
              </h1>
              <p className="mt-1 text-primary-foreground/80">
                Manage your listings and track performance
              </p>
            </div>
            <Link href="/agent/edit">
              <Button className="bg-white text-primary shadow-lg gap-2">
                <Edit className="h-4 w-4" />
                Edit Profile
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards with overlap effect */}
      <div className="mx-auto max-w-6xl px-4 -mt-6 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Listings</p>
                      <div className="mt-2 text-3xl font-bold">{agent?.activeListings || 0}</div>
                    </div>
                    <Home className="h-8 w-8 text-primary opacity-30" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Properties Sold</p>
                      <div className="mt-2 text-3xl font-bold">{agent?.propertiesSold || 0}</div>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500 opacity-30" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Average Rating</p>
                      <div className="mt-2 text-3xl font-bold">
                        {agent?.averageRating ? parseFloat(String(agent.averageRating)).toFixed(1) : "N/A"}
                      </div>
                    </div>
                    <DollarSign className="h-8 w-8 text-blue-500 opacity-30" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Reviews</p>
                      <div className="mt-2 text-3xl font-bold">{agent?.totalReviews || 0}</div>
                    </div>
                    <Calendar className="h-8 w-8 text-purple-500 opacity-30" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Agent Info Card */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Agent Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Brokerage</label>
                    <p className="mt-1 font-medium">{agent?.brokerage || "Not set"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">License Number</label>
                    <p className="mt-1 font-medium">{agent?.licenseNumber || "Not set"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Years in Business</label>
                    <p className="mt-1 font-medium">{agent?.yearsInBusiness || "Not set"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">License Expiry</label>
                    <p className="mt-1 font-medium">{agent?.licenseExpiry || "Not set"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Listings Management */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>My Listings</CardTitle>
                <Link href="/property/new">
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Listing
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {!listings || listings.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-muted-foreground">No listings yet</p>
                    <Link href="/property/new">
                      <Button variant="outline" className="mt-4">
                        Create Your First Listing
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {listings.map((property) => (
                      <div
                        key={property.id}
                        className="flex flex-col items-start gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">{property.address}</h3>
                          <p className="text-sm text-muted-foreground">
                            <MapPin className="mr-1 inline h-4 w-4" />
                            {property.city}, {property.state} {property.zipCode}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline">
                              ${parseFloat(property.price).toLocaleString()}
                            </Badge>
                            <Badge
                              variant={
                                property.status === "active"
                                  ? "default"
                                  : property.status === "pending"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {property.status}
                            </Badge>
                            <Badge variant="outline">
                              {property.bedrooms} bd • {property.bathrooms} ba
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/property/${property.id}`}>
                            <Button variant="outline" size="sm" className="gap-1">
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                          </Link>
                          <Link href={`/property/${property.id}/edit`}>
                            <Button variant="outline" size="sm" className="gap-1">
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-destructive"
                            onClick={() => deleteListingMutation.mutate(property.id)}
                            disabled={deleteListingMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
