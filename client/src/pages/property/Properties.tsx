import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { usePageView } from "@/hooks/useActivityTracker";
import {
  loadSavedPropertyFilters,
  savePropertyFilters,
  buildLiveSearchUrl,
  buildPropertyQueryUrl,
  filterProperties,
} from "@/lib/propertySearch";
import type { Property } from "@shared/schema";
import { Home, MapPin } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import familyImage from "@assets/stock_images/happy_family_new_hom_d488bf67.jpg";
import { useLocationAutocomplete } from "./properties/useLocationAutocomplete";
import { SearchFilters } from "./properties/SearchFilters";
import { PropertyCard } from "./properties/PropertyCard";
import { LivePropertyCard } from "./properties/LivePropertyCard";
import { PreApprovalCtaCard, StickyPreApprovalBanner } from "./properties/PreApprovalCta";
import type { LiveSearchResponse, SearchMode, ViewMode } from "./properties/types";
import { markBrowsedProperties } from "@/lib/pendingAttribution";

export default function Properties() {
  const { isAuthenticated } = useAuth();
  usePageView("/properties");

  const saved = useRef(loadSavedPropertyFilters());
  const autocomplete = useLocationAutocomplete({
    locationId: saved.current?.locationId || null,
    locationLabel: saved.current?.locationLabel || "",
  });
  const { searchQuery, selectedLocation, selectedLocationLabel } = autocomplete;

  const [searchMode, setSearchMode] = useState<SearchMode>(saved.current?.searchMode || "buy");
  const [propertyType, setPropertyType] = useState(saved.current?.propertyType || "all");
  const [priceRange, setPriceRange] = useState(saved.current?.priceRange || [0, 2000000]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showSavedBanner, setShowSavedBanner] = useState(!!saved.current?.locationId);

  useEffect(() => {
    markBrowsedProperties();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      savePropertyFilters({
        locationId: selectedLocation,
        locationLabel: selectedLocationLabel,
        searchMode,
        propertyType,
        priceRange: priceRange as [number, number],
      });
    }
  }, [selectedLocation, selectedLocationLabel, searchMode, propertyType, priceRange]);

  const liveSearchUrl = buildLiveSearchUrl({
    selectedLocation,
    propertyType,
    priceRange: priceRange as [number, number],
    searchMode,
  });

  const { data: liveResults, isLoading: liveLoading } = useQuery<LiveSearchResponse>({
    queryKey: [liveSearchUrl],
    enabled: !!liveSearchUrl,
  });

  const handleClearSearch = useCallback(() => {
    autocomplete.clearSearch();
    setShowSavedBanner(false);
  }, [autocomplete]);

  const propertyQueryUrl = buildPropertyQueryUrl({
    searchQuery,
    propertyType,
    priceRange: priceRange as [number, number],
  });

  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: [propertyQueryUrl],
    enabled: !selectedLocation,
  });

  const filteredProperties = useMemo(
    () => (properties ? filterProperties(properties, { propertyType, priceRange: priceRange as [number, number], searchQuery }) : []),
    [properties, propertyType, priceRange, searchQuery],
  );

  const isLiveMode = !!selectedLocation;
  const liveProperties = liveResults?.properties || [];
  const liveTotal = liveResults?.total || 0;
  const currentLoading = isLiveMode ? liveLoading : isLoading;

  return (
    <>
      <SEOHead title="Browse Properties - Find Your Dream Home" description="Search homes for sale with live MLS listings. Get instant mortgage estimates and pre-approval for properties across the US." />

      <div className="relative h-64 bg-gradient-to-r from-primary/90 to-primary">
        <img
          src={familyImage}
          alt="Happy family in new home"
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
        <div className="relative mx-auto flex h-full max-w-7xl flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Find Your Dream Home
          </h1>
          <p className="mt-4 text-lg text-white/80">
            Browse properties and see instant loan options for each listing
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <SearchFilters
          autocomplete={autocomplete}
          searchMode={searchMode}
          onSearchModeChange={setSearchMode}
          propertyType={propertyType}
          onPropertyTypeChange={setPropertyType}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {showSavedBanner && selectedLocation && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border bg-primary/5 px-4 py-2.5" data-testid="banner-saved-search">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm text-foreground flex-1">
              Showing your last search: <span className="font-medium">{selectedLocationLabel}</span>
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs"
              onClick={handleClearSearch}
              data-testid="button-clear-saved-search"
            >
              Clear
            </Button>
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground" data-testid="text-results-count">
              {isLiveMode
                ? `${liveProperties.length} of ${liveTotal.toLocaleString()} listings`
                : `${filteredProperties.length} properties found`
              }
            </p>
            {isLiveMode && (
              <Badge variant="secondary" data-testid="badge-live-results">
                {searchMode === "sold" ? "Recently Sold" : "Live MLS Data"}
              </Badge>
            )}
          </div>
          {isLiveMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearSearch}
              data-testid="button-clear-search"
            >
              Clear Search
            </Button>
          )}
        </div>

        {!isAuthenticated && <PreApprovalCtaCard />}

        {currentLoading ? (
          <div className={`grid gap-6 ${viewMode === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        ) : isLiveMode ? (
          liveProperties.length === 0 ? (
            <div className="py-16 text-center">
              <Home className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No listings found in {selectedLocationLabel}</h3>
              <p className="mt-2 text-muted-foreground">
                Try adjusting your filters or searching a different location
              </p>
            </div>
          ) : (
            <div className={`grid gap-6 ${viewMode === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}>
              {liveProperties.map((property) => (
                <LivePropertyCard key={property.property_id} property={property} viewMode={viewMode} />
              ))}
            </div>
          )
        ) : filteredProperties.length === 0 ? (
          <div className="py-16 text-center">
            <Home className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No properties found</h3>
            <p className="mt-2 text-muted-foreground">
              Try adjusting your filters or search query
            </p>
          </div>
        ) : (
          <div className={`grid gap-6 ${viewMode === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}>
            {filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} viewMode={viewMode} />
            ))}
          </div>
        )}
      </div>

      {!isAuthenticated && (selectedLocation || filteredProperties.length > 0) && (
        <StickyPreApprovalBanner />
      )}
    </>
  );
}
