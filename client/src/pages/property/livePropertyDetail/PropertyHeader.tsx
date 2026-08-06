import { Bath, Bed, Calendar, Car, Layers, MapPin, Square, TreePine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { AffordabilityBadge } from "@/components/AffordabilityBadge";
import type { LivePropertyDetail } from "./types";

export function PropertyHeader({
  property,
  statusLabel,
}: {
  property: LivePropertyDetail;
  statusLabel: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold" data-testid="text-live-detail-price">
              {formatCurrency(property.price)}
            </h1>
            <AffordabilityBadge price={property.price} />
          </div>
          {property.pricePerSqft && (
            <p className="text-sm text-muted-foreground">
              {formatCurrency(property.pricePerSqft)}/sqft
            </p>
          )}
          <p className="mt-1 text-lg font-medium" data-testid="text-live-detail-address">{property.address}</p>
          <p className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {property.city}, {property.stateCode} {property.zipcode}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge data-testid="badge-live-detail-status">{statusLabel}</Badge>
          {property.flags.isPriceReduced && <Badge variant="destructive">Price Reduced</Badge>}
          {property.flags.isNewListing && <Badge variant="secondary">New Listing</Badge>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-6">
        {property.beds !== null && (
          <div className="flex items-center gap-2">
            <Bed className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{property.beds}</span>
            <span className="text-muted-foreground">beds</span>
          </div>
        )}
        {property.baths !== null && (
          <div className="flex items-center gap-2">
            <Bath className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{property.baths}</span>
            <span className="text-muted-foreground">baths</span>
          </div>
        )}
        {property.sqft !== null && (
          <div className="flex items-center gap-2">
            <Square className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{property.sqft.toLocaleString()}</span>
            <span className="text-muted-foreground">sqft</span>
          </div>
        )}
        {property.lotSqft && (
          <div className="flex items-center gap-2">
            <TreePine className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{(property.lotSqft / 43560).toFixed(2)}</span>
            <span className="text-muted-foreground">acres</span>
          </div>
        )}
        {property.yearBuilt && (
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Built {property.yearBuilt}</span>
          </div>
        )}
        {property.garage && (
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{property.garage}</span>
            <span className="text-muted-foreground">garage</span>
          </div>
        )}
        {property.stories && (
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{property.stories}</span>
            <span className="text-muted-foreground">stories</span>
          </div>
        )}
      </div>
    </div>
  );
}
