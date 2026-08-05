import { Bath, BedDouble, Calendar, Home, MapPin, Maximize } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StreetView } from "@/components/StreetView";
import { formatCurrency } from "@/lib/formatters";
import { getBasisPrice } from "./affordability";
import { StatusBadge } from "./StatusBadge";
import { PROPERTY_TYPE_LABELS, type AffordabilityStatus, type PropertyData } from "./types";

export function PropertySummaryCard({
  property,
  status,
}: {
  property: PropertyData;
  status: AffordabilityStatus;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {property.photo ? (
            <div className="md:w-80 h-56 md:h-auto flex-shrink-0">
              <img
                src={property.photo}
                alt={property.address}
                className="w-full h-full object-cover rounded-t-lg md:rounded-l-lg md:rounded-tr-none"
                data-testid="img-property-photo"
              />
            </div>
          ) : property.coordinate && (
            <div className="md:w-80 h-56 md:h-auto flex-shrink-0 rounded-t-lg md:rounded-l-lg md:rounded-tr-none overflow-hidden">
              <StreetView lat={property.coordinate.lat} lng={property.coordinate.lon ?? property.coordinate.lng ?? 0} height={224} />
            </div>
          )}
          <div className="flex-1 p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-2xl font-bold" data-testid="text-property-price">
                  {formatCurrency(getBasisPrice(property))}
                  {property.price <= 0 && property.valueEstimate && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">estimated value</span>
                  )}
                </p>
                <p className="text-muted-foreground flex items-center gap-1 mt-1" data-testid="text-property-address">
                  <MapPin className="h-3.5 w-3.5" />
                  {property.address}, {property.city}, {property.stateCode} {property.zipcode}
                </p>
              </div>
              <StatusBadge status={status} />
            </div>
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
              {property.beds !== null && (
                <span className="flex items-center gap-1" data-testid="text-beds">
                  <BedDouble className="h-4 w-4" /> {property.beds} beds
                </span>
              )}
              {property.baths !== null && (
                <span className="flex items-center gap-1" data-testid="text-baths">
                  <Bath className="h-4 w-4" /> {property.baths} baths
                </span>
              )}
              {property.sqft !== null && (
                <span className="flex items-center gap-1" data-testid="text-sqft">
                  <Maximize className="h-4 w-4" /> {property.sqft.toLocaleString()} sqft
                </span>
              )}
              {property.yearBuilt && (
                <span className="flex items-center gap-1" data-testid="text-year-built">
                  <Calendar className="h-4 w-4" /> Built {property.yearBuilt}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Home className="h-4 w-4" /> {PROPERTY_TYPE_LABELS[property.propertyType] || property.propertyType}
              </span>
            </div>
            {property.valueEstimate && (
              <div className="mt-4 rounded-md border bg-muted/50 p-3" data-testid="block-value-estimate">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Estimated Market Value
                      {property.valueEstimate.source && ` · ${property.valueEstimate.source}`}
                    </p>
                    <p className="text-lg font-semibold" data-testid="text-value-estimate">
                      {formatCurrency(property.valueEstimate.value)}
                    </p>
                    {property.valueEstimate.low !== null && property.valueEstimate.high !== null && (
                      <p className="text-xs text-muted-foreground">
                        Range {formatCurrency(property.valueEstimate.low)} – {formatCurrency(property.valueEstimate.high)}
                      </p>
                    )}
                  </div>
                  {property.price > 0 && property.valueEstimate.value !== property.price && (
                    <Badge variant="secondary" data-testid="badge-value-delta">
                      Listed {formatCurrency(Math.abs(property.price - property.valueEstimate.value))}{" "}
                      {property.price > property.valueEstimate.value ? "above" : "below"} estimate
                    </Badge>
                  )}
                </div>
                {/* Reg N §1014.3 / Reg Z: an AVM figure is not an appraisal and not an
                    offer of credit. This disclaimer travels with the number — do not
                    render the estimate block without it. */}
                <p className="text-[11px] text-muted-foreground mt-2">
                  Automated valuation estimate — not an appraisal, loan offer, or commitment to lend.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
