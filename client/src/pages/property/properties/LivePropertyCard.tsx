import { Link } from "wouter";
import { Bath, Bed, DollarSign, Home, MapPin, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { AffordabilityBadge } from "@/components/AffordabilityBadge";
import type { LiveProperty, ViewMode } from "./types";

export function LivePropertyCard({ property, viewMode }: { property: LiveProperty; viewMode: ViewMode }) {
  const mainImage = property.photo || "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800";
  const isSold = !!property.soldDate || property.status === "sold" || property.status === "recently_sold";
  const statusLabel = isSold ? "Sold" : property.isPending ? "Pending" : property.isNewConstruction ? "New Build" : property.isForeclosure ? "Foreclosure" : "For Sale";
  const displayPrice = isSold && property.soldPrice ? property.soldPrice : property.price;
  const formattedSoldDate = property.soldDate ? new Date(property.soldDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  if (viewMode === "list") {
    return (
      <Card className="overflow-hidden hover-elevate" data-testid={`card-live-property-${property.property_id}`}>
        <div className="flex flex-col sm:flex-row">
          <div className="relative h-48 w-full sm:h-auto sm:w-64">
            <img
              src={mainImage}
              alt={property.address}
              className="h-full w-full object-cover"
            />
            <Badge className="absolute left-3 top-3">
              {statusLabel}
            </Badge>
          </div>
          <CardContent className="flex flex-1 flex-col justify-between p-6">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(displayPrice)}
                  </p>
                  {isSold && formattedSoldDate && (
                    <p className="text-xs text-muted-foreground">Sold {formattedSoldDate}</p>
                  )}
                  <div className="mt-1 flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{property.address}, {property.city}, {property.stateCode} {property.zipcode}</span>
                  </div>
                  {!isSold && (
                    <div className="mt-1.5">
                      <AffordabilityBadge price={displayPrice} />
                    </div>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0 capitalize">{property.propertyType.replace("_", " ")}</Badge>
              </div>

              <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
                {property.beds !== null && (
                  <div className="flex items-center gap-1">
                    <Bed className="h-4 w-4" />
                    <span>{property.beds} beds</span>
                  </div>
                )}
                {property.baths !== null && (
                  <div className="flex items-center gap-1">
                    <Bath className="h-4 w-4" />
                    <span>{property.baths} baths</span>
                  </div>
                )}
                {property.sqft !== null && (
                  <div className="flex items-center gap-1">
                    <Square className="h-4 w-4" />
                    <span>{property.sqft.toLocaleString()} sqft</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Link href={`/properties/live?propertyId=${property.property_id}`} className="flex-1">
                <Button variant="outline" className="w-full gap-2">
                  <Home className="h-4 w-4" />
                  Details
                </Button>
              </Link>
              <Link href={`/pre-approval?price=${displayPrice}&address=${encodeURIComponent(property.address + ', ' + property.city + ', ' + property.stateCode)}`} className="flex-1">
                <Button className="w-full gap-2">
                  <DollarSign className="h-4 w-4" />
                  {isSold ? "Get Estimate" : "Pre-Approve"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover-elevate" data-testid={`card-live-property-${property.property_id}`}>
      <div className="relative aspect-[16/10]">
        <img
          src={mainImage}
          alt={property.address}
          className="h-full w-full object-cover"
        />
        <Badge className="absolute left-3 top-3">
          {statusLabel}
        </Badge>
        {property.isNewConstruction && (
          <Badge variant="secondary" className="absolute right-3 top-3">
            <Sparkles className="mr-1 h-3 w-3" />
            New
          </Badge>
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-2xl font-bold">
              {formatCurrency(displayPrice)}
            </p>
            {isSold && formattedSoldDate && (
              <p className="text-xs text-muted-foreground">Sold {formattedSoldDate}</p>
            )}
          </div>
          {!isSold && <AffordabilityBadge price={displayPrice} compact />}
        </div>
        <div className="mt-1 flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="text-sm truncate">
            {property.address}, {property.city}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          {property.beds !== null && (
            <div className="flex items-center gap-1">
              <Bed className="h-4 w-4" />
              <span>{property.beds}</span>
            </div>
          )}
          {property.baths !== null && (
            <div className="flex items-center gap-1">
              <Bath className="h-4 w-4" />
              <span>{property.baths}</span>
            </div>
          )}
          {property.sqft !== null && (
            <div className="flex items-center gap-1">
              <Square className="h-4 w-4" />
              <span>{property.sqft.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Link href={`/properties/live?propertyId=${property.property_id}`} className="flex-1">
            <Button variant="outline" className="w-full gap-2">
              <Home className="h-4 w-4" />
              Details
            </Button>
          </Link>
          <Link href={`/pre-approval?price=${displayPrice}&address=${encodeURIComponent(property.address + ', ' + property.city + ', ' + property.stateCode)}`} className="flex-1">
            <Button className="w-full gap-2">
              <DollarSign className="h-4 w-4" />
              {isSold ? "Get Estimate" : "Pre-Approve"}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
