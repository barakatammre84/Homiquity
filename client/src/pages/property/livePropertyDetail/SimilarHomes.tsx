import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bath, Bed, Home, Square } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import type { SimilarHome } from "./types";

export function SimilarHomes({ propertyId }: { propertyId: string }) {
  const similarUrl = propertyId
    ? `/api/properties/similar-homes?propertyId=${encodeURIComponent(propertyId)}`
    : null;

  const { data: homes, isLoading } = useQuery<SimilarHome[]>({
    queryKey: [similarUrl],
    enabled: !!similarUrl,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-bold">Similar Homes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-44 w-full rounded-t-md" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!homes || homes.length === 0) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8" data-testid="section-similar-homes">
      <h2 className="mb-6 text-2xl font-bold">Similar Homes</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {homes.map((home) => (
          <Link key={home.property_id} href={`/properties/live?propertyId=${home.property_id}`}>
            <Card className="overflow-visible hover-elevate cursor-pointer" data-testid={`card-similar-${home.property_id}`}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-t-md">
                {home.photo ? (
                  <img
                    src={home.photo}
                    alt={home.address}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted">
                    <Home className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <p className="text-lg font-bold" data-testid={`text-similar-price-${home.property_id}`}>
                  {formatCurrency(home.price)}
                </p>
                {home.pricePerSqft && (
                  <p className="text-xs text-muted-foreground">{formatCurrency(home.pricePerSqft)}/sqft</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {home.beds && (
                    <span className="flex items-center gap-1">
                      <Bed className="h-3.5 w-3.5" /> {home.beds}
                    </span>
                  )}
                  {home.baths && (
                    <span className="flex items-center gap-1">
                      <Bath className="h-3.5 w-3.5" /> {home.baths}
                    </span>
                  )}
                  {home.sqft && (
                    <span className="flex items-center gap-1">
                      <Square className="h-3.5 w-3.5" /> {home.sqft.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="mt-2 truncate text-sm font-medium">{home.address}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {home.city}, {home.stateCode} {home.zipcode}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
