import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { SEOHead } from "@/components/SEOHead";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Home } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import type { LivePropertyDetail } from "./livePropertyDetail/types";
import { PhotoGallery } from "./livePropertyDetail/PhotoGallery";
import { SimilarHomes } from "./livePropertyDetail/SimilarHomes";
import { PropertyHeader } from "./livePropertyDetail/PropertyHeader";
import { PropertyFacts } from "./livePropertyDetail/PropertyFacts";
import { PersonalizedAffordabilityCard } from "./livePropertyDetail/PersonalizedAffordabilityCard";
import {
  MortgageEstimateCard,
  NeighborhoodCard,
  ListedByCard,
  LocationCard,
  InterestedCtaCard,
} from "./livePropertyDetail/SidebarCards";

export default function LivePropertyDetailPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const propertyId = params.get("propertyId") || "";
  const listingId = params.get("listingId") || "";

  const detailUrl = propertyId
    ? `/api/properties/detail-live?propertyId=${encodeURIComponent(propertyId)}${listingId ? `&listingId=${encodeURIComponent(listingId)}` : ""}`
    : null;

  const { data: property, isLoading, error } = useQuery<LivePropertyDetail>({
    queryKey: [detailUrl],
    enabled: !!detailUrl,
  });

  if (isLoading) {
    return (
      <PageShell width="wide">
          <Skeleton className="mb-4 h-10 w-40" />
          <Skeleton className="mb-6 h-96 w-full rounded-xl" />
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-6 w-96" />
              <Skeleton className="h-40 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
      </PageShell>
    );
  }

  if (error || !property) {
    return (
      <PageShell width="wide" className="py-16 text-center">
        <div>
          <Home className="mx-auto h-16 w-16 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">Property Not Found</h1>
          <p className="mt-2 text-muted-foreground">We couldn't load the details for this listing.</p>
          <Link href="/properties">
            <Button className="mt-4" data-testid="button-back-browse">Browse Properties</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  const statusLabel = property.flags.isPending ? "Pending" : property.flags.isContingent ? "Contingent" : property.flags.isNewConstruction ? "New Construction" : property.flags.isForeclosure ? "Foreclosure" : property.flags.isComingSoon ? "Coming Soon" : "For Sale";
  const fullAddress = `${property.address}, ${property.city}, ${property.stateCode} ${property.zipcode}`;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Property Details" description="View detailed property information including photos, price history, mortgage estimates, schools, and neighborhood data." />

      <PageShell width="wide">
        <Link href="/properties">
          <Button variant="ghost" className="mb-4 gap-2" data-testid="button-back-search">
            <ChevronLeft className="h-4 w-4" />
            Back to Search
          </Button>
        </Link>

        <PhotoGallery photos={property.photos} address={property.address} />

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PropertyHeader property={property} statusLabel={statusLabel} />

            <Separator className="my-6" />

            <PropertyFacts property={property} />
          </div>

          <div className="space-y-6">
            {property.mortgage && <MortgageEstimateCard mortgage={property.mortgage} />}

            {property.neighborhoods.length > 0 && (
              <NeighborhoodCard neighborhoods={property.neighborhoods} />
            )}

            {property.branding.length > 0 && <ListedByCard branding={property.branding} />}

            {property.coordinate && (
              <LocationCard coordinate={property.coordinate} fullAddress={fullAddress} />
            )}

            <PersonalizedAffordabilityCard price={property.price} address={fullAddress} />

            <InterestedCtaCard price={property.price} fullAddress={fullAddress} href={property.href} />

            {property.listDate && (
              <div className="text-center text-xs text-muted-foreground">
                Listed {new Date(property.listDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
            )}
          </div>
        </div>
      </PageShell>

      <SimilarHomes propertyId={propertyId} />
    </div>
  );
}
