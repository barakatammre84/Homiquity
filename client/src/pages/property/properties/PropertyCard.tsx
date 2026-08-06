import { Link } from "wouter";
import { SavePropertyButton, SharePropertyButton } from "@/components/property/SavePropertyButton";
import { Bath, Bed, DollarSign, Home, MapPin, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import type { Property } from "@shared/schema";
import type { ViewMode } from "./types";

export function PropertyCard({ property, viewMode }: { property: Property; viewMode: ViewMode }) {
  const mainImage = property.images?.[0] || "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800";

  if (viewMode === "list") {
    return (
      <Card className="overflow-hidden hover-elevate" data-testid={`card-property-${property.id}`}>
        <div className="flex flex-col sm:flex-row">
          <div className="relative h-48 w-full sm:h-auto sm:w-64">
            <img
              src={mainImage}
              alt={property.address}
              className="h-full w-full object-cover"
            />
            <Badge className="absolute left-3 top-3 capitalize">
              {property.status}
            </Badge>
          </div>
          <CardContent className="flex flex-1 flex-col justify-between p-6">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(property.price)}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{property.address}, {property.city}, {property.state}</span>
                  </div>
                </div>
                <SavePropertyButton propertyId={property.id} />
              </div>

              <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Bed className="h-4 w-4" />
                  <span>{property.bedrooms} beds</span>
                </div>
                <div className="flex items-center gap-1">
                  <Bath className="h-4 w-4" />
                  <span>{property.bathrooms} baths</span>
                </div>
                <div className="flex items-center gap-1">
                  <Square className="h-4 w-4" />
                  <span>{property.squareFeet?.toLocaleString()} sqft</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Link href={`/properties/${property.id}`} className="flex-1" data-testid={`link-detail-${property.id}`}>
                <Button variant="outline" className="w-full gap-2">
                  <Home className="h-4 w-4" />
                  View Details
                </Button>
              </Link>
              <Link href={`/apply?propertyId=${property.id}&price=${property.price}&state=${property.state || ""}&propertyType=${property.propertyType || "single_family"}`} className="flex-1">
                <Button className="w-full gap-2">
                  <DollarSign className="h-4 w-4" />
                  See Loan Options
                </Button>
              </Link>
            </div>
          </CardContent>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover-elevate" data-testid={`card-property-${property.id}`}>
      <div className="relative aspect-[16/10]">
        <img
          src={mainImage}
          alt={property.address}
          className="h-full w-full object-cover"
        />
        <Badge className="absolute left-3 top-3 capitalize">
          {property.status}
        </Badge>
        <SavePropertyButton
          propertyId={property.id}
          className="absolute right-3 top-3 bg-white/80"
        />
      </div>
      <CardContent className="p-4">
        <p className="text-2xl font-bold">
          {formatCurrency(property.price)}
        </p>
        <div className="mt-1 flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="text-sm truncate">
            {property.address}, {property.city}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Bed className="h-4 w-4" />
            <span>{property.bedrooms}</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="h-4 w-4" />
            <span>{property.bathrooms}</span>
          </div>
          <div className="flex items-center gap-1">
            <Square className="h-4 w-4" />
            <span>{property.squareFeet?.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Link href={`/properties/${property.id}`} className="flex-1" data-testid={`link-detail-grid-${property.id}`}>
            <Button variant="outline" className="w-full gap-2">
              <Home className="h-4 w-4" />
              Details
            </Button>
          </Link>
          <Link href={`/apply?propertyId=${property.id}&price=${property.price}&state=${property.state || ""}&propertyType=${property.propertyType || "single_family"}`} className="flex-1">
            <Button className="w-full gap-2">
              <DollarSign className="h-4 w-4" />
              Loan Options
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
