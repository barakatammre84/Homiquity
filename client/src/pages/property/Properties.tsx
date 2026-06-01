import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";
import { usePageView, useTrackActivity } from "@/hooks/useActivityTracker";
import type { Property } from "@shared/schema";
import {
  Search,
  MapPin,
  Bed,
  Bath,
  Square,
  Heart,
  DollarSign,
  Grid,
  List,
  Home,
  Sparkles,
  ArrowRight,
  Shield,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { AffordabilityBadge } from "@/components/AffordabilityBadge";
import familyImage from "@assets/stock_images/happy_family_new_hom_d488bf67.jpg";

const PROPERTY_TYPES = [
  { value: "all", label: "All Types" },
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
];

interface AutoCompleteSuggestion {
  id: string;
  type: string;
  label: string;
  city: string | null;
  stateCode: string | null;
  slug: string | null;
}

type SearchMode = "buy" | "sold";

interface LiveProperty {
  property_id: string;
  status: string;
  price: number;
  soldPrice?: number | null;
  soldDate?: string | null;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  zipcode: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  propertyType: string;
  photo: string | null;
  photos: string[];
  listDate: string | null;
  priceReduced: number | null;
  isNewConstruction: boolean;
  isForeclosure: boolean;
  isPending: boolean;
  href: string | null;
}

interface LiveSearchResponse {
  properties: LiveProperty[];
  total: number;
  source: string;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const SEARCH_FILTERS_KEY = "homiquity_property_filters";

interface SavedFilters {
  locationId: string | null;
  locationLabel: string;
  searchMode: SearchMode;
  propertyType: string;
  priceRange: [number, number];
  savedAt: number;
}

function loadSavedFilters(): SavedFilters | null {
  try {
    const raw = localStorage.getItem(SEARCH_FILTERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedFilters;
    if (Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SEARCH_FILTERS_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

export default function Properties() {
  const { isAuthenticated } = useAuth();
  usePageView("/properties");
  const trackActivity = useTrackActivity();

  const saved = useRef(loadSavedFilters());
  const [searchQuery, setSearchQuery] = useState(saved.current?.locationLabel || "");
  const [inputValue, setInputValue] = useState(saved.current?.locationLabel || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(saved.current?.locationId || null);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState(saved.current?.locationLabel || "");
  const [searchMode, setSearchMode] = useState<SearchMode>(saved.current?.searchMode || "buy");
  const [propertyType, setPropertyType] = useState(saved.current?.propertyType || "all");
  const [priceRange, setPriceRange] = useState(saved.current?.priceRange || [0, 2000000]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showSavedBanner, setShowSavedBanner] = useState(!!saved.current?.locationId);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { localStorage.setItem("homiquity_browsed_properties", "true"); } catch {}
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      try {
        const filters: SavedFilters = {
          locationId: selectedLocation,
          locationLabel: selectedLocationLabel,
          searchMode,
          propertyType,
          priceRange: priceRange as [number, number],
          savedAt: Date.now(),
        };
        localStorage.setItem(SEARCH_FILTERS_KEY, JSON.stringify(filters));
      } catch {}
    }
  }, [selectedLocation, selectedLocationLabel, searchMode, propertyType, priceRange]);

  const debouncedInput = useDebounce(inputValue, 300);

  const autoCompleteUrl = debouncedInput.length >= 2
    ? `/api/properties/auto-complete?input=${encodeURIComponent(debouncedInput)}`
    : null;

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery<AutoCompleteSuggestion[]>({
    queryKey: [autoCompleteUrl],
    enabled: !!autoCompleteUrl,
  });

  const buildLiveSearchUrl = () => {
    if (!selectedLocation) return null;
    const params = new URLSearchParams();
    params.set("location", selectedLocation);
    if (propertyType && propertyType !== "all") params.set("type", propertyType);
    if (priceRange[0] > 0) params.set("minPrice", priceRange[0].toString());
    if (priceRange[1] < 2000000) params.set("maxPrice", priceRange[1].toString());
    const endpoint = searchMode === "sold" ? "/api/properties/search-sold" : "/api/properties/search-live";
    return `${endpoint}?${params.toString()}`;
  };

  const liveSearchUrl = buildLiveSearchUrl();

  const { data: liveResults, isLoading: liveLoading } = useQuery<LiveSearchResponse>({
    queryKey: [liveSearchUrl],
    enabled: !!liveSearchUrl,
  });

  useEffect(() => {
    if (suggestions && suggestions.length > 0 && debouncedInput.length >= 2) {
      setShowSuggestions(true);
    }
  }, [suggestions, debouncedInput]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = useCallback((suggestion: AutoCompleteSuggestion) => {
    setInputValue(suggestion.label);
    setSearchQuery(suggestion.label);
    setSelectedLocation(suggestion.id);
    setSelectedLocationLabel(suggestion.label);
    setShowSuggestions(false);
    trackActivity("property_search", "/properties", { location: suggestion.label, type: suggestion.type });
  }, [trackActivity]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    if (!value) {
      setSearchQuery("");
      setSelectedLocation(null);
      setSelectedLocationLabel("");
      setShowSuggestions(false);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setSearchQuery(inputValue);
      setShowSuggestions(false);
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }, [inputValue]);

  const handleClearSearch = useCallback(() => {
    setInputValue("");
    setSearchQuery("");
    setSelectedLocation(null);
    setSelectedLocationLabel("");
    setShowSavedBanner(false);
    try { localStorage.removeItem(SEARCH_FILTERS_KEY); } catch {}
  }, []);

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (propertyType && propertyType !== "all") params.set("type", propertyType);
    if (priceRange[0] > 0) params.set("minPrice", priceRange[0].toString());
    if (priceRange[1] < 2000000) params.set("maxPrice", priceRange[1].toString());
    const qs = params.toString();
    return qs ? `/api/properties?${qs}` : "/api/properties";
  };

  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: [buildQueryString()],
    enabled: !selectedLocation,
  });

  const filteredProperties = properties?.filter((property) => {
    const matchesType = propertyType === "all" || property.propertyType === propertyType;
    const matchesPrice = 
      parseFloat(property.price) >= priceRange[0] && 
      parseFloat(property.price) <= priceRange[1];
    const matchesSearch = 
      !searchQuery || 
      property.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.state?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesPrice && matchesSearch;
  }) || [];

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
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="relative flex-1">
                <label className="mb-2 block text-sm font-medium">Search Location</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    placeholder="City, address, or ZIP code"
                    className="pl-10"
                    value={inputValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (suggestions && suggestions.length > 0 && inputValue.length >= 2) {
                        setShowSuggestions(true);
                      }
                    }}
                    data-testid="input-property-search"
                  />
                </div>
                {showSuggestions && inputValue.length >= 2 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md"
                    data-testid="autocomplete-dropdown"
                  >
                    {suggestionsLoading ? (
                      <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
                        <Search className="h-4 w-4 animate-pulse" />
                        <span>Searching locations...</span>
                      </div>
                    ) : suggestions && suggestions.length > 0 ? (
                      suggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover-elevate"
                          onClick={() => handleSelectSuggestion(suggestion)}
                          data-testid={`autocomplete-item-${suggestion.id}`}
                        >
                          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{suggestion.label}</p>
                            <p className="text-xs capitalize text-muted-foreground">{suggestion.type.replace("_", " ")}</p>
                          </div>
                          {suggestion.stateCode && (
                            <Badge variant="secondary" className="shrink-0">{suggestion.stateCode}</Badge>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-muted-foreground">
                        No locations found
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="w-full lg:w-auto">
                <label className="mb-2 block text-sm font-medium">Search Mode</label>
                <div className="flex gap-1 rounded-md border p-1">
                  <Button
                    variant={searchMode === "buy" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSearchMode("buy")}
                    className="toggle-elevate"
                    data-testid="button-mode-buy"
                  >
                    For Sale
                  </Button>
                  <Button
                    variant={searchMode === "sold" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSearchMode("sold")}
                    className="toggle-elevate"
                    data-testid="button-mode-sold"
                  >
                    Recently Sold
                  </Button>
                </div>
              </div>

              <div className="w-full lg:w-48">
                <label className="mb-2 block text-sm font-medium">Property Type</label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger data-testid="select-property-type">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full lg:w-64">
                <label className="mb-2 block text-sm font-medium">
                  Price Range: {formatCurrency(priceRange[0])} - {formatCurrency(priceRange[1])}
                </label>
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  min={0}
                  max={2000000}
                  step={50000}
                  className="py-2"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
              onClick={() => {
                setShowSavedBanner(false);
                handleClearSearch();
                try { localStorage.removeItem(SEARCH_FILTERS_KEY); } catch {}
              }}
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

        {!isAuthenticated && (
          <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent" data-testid="card-engagement-cta">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium" data-testid="text-cta-title">Know what you can afford before you shop</p>
                  <p className="text-sm text-muted-foreground">Get pre-approved in as little as 3 minutes</p>
                </div>
              </div>
              <Link href="/apply">
                <Button className="gap-2" data-testid="button-cta-preapproval">
                  Get Pre-Approved
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

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
        <>
        <div className="h-16" />
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg" data-testid="banner-sticky-preapproval">
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 px-4">
            <p className="text-sm font-medium hidden sm:block">
              Get pre-approved to make stronger offers on these homes
            </p>
            <p className="text-sm font-medium sm:hidden">
              Get pre-approved in 3 min
            </p>
            <Link href="/apply">
              <Button size="sm" className="gap-1.5 shrink-0" data-testid="button-sticky-preapproval">
                <Sparkles className="h-3.5 w-3.5" />
                Get Pre-Approved
              </Button>
            </Link>
          </div>
        </div>
        </>
      )}

      <Footer />
    </>
  );
}

function PropertyCard({ property, viewMode }: { property: Property; viewMode: "grid" | "list" }) {
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
                <Button variant="ghost" size="icon">
                  <Heart className="h-5 w-5" />
                </Button>
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
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 bg-white/80"
        >
          <Heart className="h-5 w-5" />
        </Button>
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

function LivePropertyCard({ property, viewMode }: { property: LiveProperty; viewMode: "grid" | "list" }) {
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
