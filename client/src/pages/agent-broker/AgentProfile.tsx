import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AgentProfile, Property } from "@shared/schema";
import {
  MapPin,
  Phone,
  Globe,
  Award,
  Home,
  Star,
  MessageCircle,
  Mail,
} from "lucide-react";

interface AgentWithProperties extends AgentProfile {
  properties?: Property[];
  user?: { email: string; firstName: string; lastName: string };
}

export default function AgentProfilePage() {
  const params = useParams();
  const agentId = params?.agentId as string;

  const { data: agent, isLoading } = useQuery<AgentWithProperties>({
    queryKey: ['/api/agents', agentId],
  });

  const { data: listings } = useQuery<Property[]>({
    queryKey: ['/api/agents', agentId, 'listings'],
    enabled: !!agent,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <Skeleton className="h-32 w-32 rounded-full" />
          <Skeleton className="mt-6 h-8 w-64" />
          <Skeleton className="mt-4 h-4 w-96" />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <h1 className="text-2xl font-bold">Agent not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col items-start gap-6 sm:flex-row">
          {agent.photoUrl && (
            <img
              src={agent.photoUrl}
              alt={agent.user?.firstName || "Agent"}
              className="h-48 w-48 rounded-lg object-cover shadow-lg"
            />
          )}

          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold">
                  {agent.user?.firstName} {agent.user?.lastName}
                </h1>
                {agent.brokerage && (
                  <p className="mt-1 text-lg text-muted-foreground">{agent.brokerage}</p>
                )}
              </div>
              {agent.isVerified && (
                <Badge className="ml-4" variant="default">
                  <Award className="mr-1 h-3 w-3" />
                  Verified
                </Badge>
              )}
            </div>

            {agent.bio && (
              <p className="mt-4 text-base leading-relaxed text-foreground">{agent.bio}</p>
            )}

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-card p-4">
                <div className="text-2xl font-bold text-primary">
                  {agent.propertiesSold || 0}
                </div>
                <div className="text-sm text-muted-foreground">Sold</div>
              </div>
              <div className="rounded-lg bg-card p-4">
                <div className="text-2xl font-bold text-primary">
                  {agent.activeListings || 0}
                </div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
              <div className="rounded-lg bg-card p-4">
                <div className="flex items-center">
                  <Star className="mr-1 h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <div className="text-2xl font-bold">
                    {agent.averageRating ? parseFloat(String(agent.averageRating)).toFixed(1) : "N/A"}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">Rating</div>
              </div>
              <div className="rounded-lg bg-card p-4">
                <div className="text-2xl font-bold text-primary">
                  {agent.totalReviews || 0}
                </div>
                <div className="text-sm text-muted-foreground">Reviews</div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {agent.phoneNumber && (
                <Button variant="outline" size="sm" className="gap-2">
                  <Phone className="h-4 w-4" />
                  {agent.phoneNumber}
                </Button>
              )}
              {agent.user?.email && (
                <Button variant="outline" size="sm" className="gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Button>
              )}
              {agent.website && (
                <a href={agent.website} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Globe className="h-4 w-4" />
                    Website
                  </Button>
                </a>
              )}
              <Button className="gap-2">
                <MessageCircle className="h-4 w-4" />
                Contact Agent
              </Button>
            </div>
          </div>
        </div>

        {agent.specialties && agent.specialties.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Specialties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {agent.specialties.map((specialty) => (
                  <Badge key={specialty} variant="secondary">
                    {specialty.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {agent.serviceArea && agent.serviceArea.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Service Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {agent.serviceArea.map((area) => (
                  <Badge key={area} variant="outline">
                    {area}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {listings && listings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Active Listings ({listings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((property) => (
                  <Link key={property.id} href={`/properties/${property.id}`}>
                    <Card className="cursor-pointer transition-all hover:shadow-lg">
                      <CardContent className="p-4">
                        {property.images && property.images.length > 0 && (
                          <img
                            src={property.images[0]}
                            alt={property.address}
                            className="mb-3 h-40 w-full rounded object-cover"
                          />
                        )}
                        <h3 className="font-semibold text-foreground">{property.address}</h3>
                        <p className="text-sm text-muted-foreground">
                          {property.city}, {property.state}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-lg font-bold text-primary">
                            ${parseFloat(property.price).toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {property.bedrooms} bd • {property.bathrooms} ba
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Footer />
    </div>
  );
}
