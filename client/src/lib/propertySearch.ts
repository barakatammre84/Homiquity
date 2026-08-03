import type { Property } from "@shared/schema";

export type PropertySearchMode = "buy" | "sold";

export const SAVED_PROPERTY_FILTERS_KEY = "homiquity_property_filters";
const SAVED_FILTERS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SavedPropertyFilters {
  locationId: string | null;
  locationLabel: string;
  searchMode: PropertySearchMode;
  propertyType: string;
  priceRange: [number, number];
  savedAt: number;
}

export function loadSavedPropertyFilters(): SavedPropertyFilters | null {
  try {
    const raw = localStorage.getItem(SAVED_PROPERTY_FILTERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPropertyFilters;
    if (Date.now() - parsed.savedAt > SAVED_FILTERS_TTL_MS) {
      localStorage.removeItem(SAVED_PROPERTY_FILTERS_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePropertyFilters(filters: Omit<SavedPropertyFilters, "savedAt">): void {
  try {
    const toStore: SavedPropertyFilters = { ...filters, savedAt: Date.now() };
    localStorage.setItem(SAVED_PROPERTY_FILTERS_KEY, JSON.stringify(toStore));
  } catch {}
}

export function clearSavedPropertyFilters(): void {
  try {
    localStorage.removeItem(SAVED_PROPERTY_FILTERS_KEY);
  } catch {}
}

interface LiveSearchUrlParams {
  selectedLocation: string | null;
  propertyType: string;
  priceRange: [number, number];
  searchMode: PropertySearchMode;
}

export function buildLiveSearchUrl({
  selectedLocation,
  propertyType,
  priceRange,
  searchMode,
}: LiveSearchUrlParams): string | null {
  if (!selectedLocation) return null;
  const params = new URLSearchParams();
  params.set("location", selectedLocation);
  if (propertyType && propertyType !== "all") params.set("type", propertyType);
  if (priceRange[0] > 0) params.set("minPrice", priceRange[0].toString());
  if (priceRange[1] < 2000000) params.set("maxPrice", priceRange[1].toString());
  const endpoint = searchMode === "sold" ? "/api/properties/search-sold" : "/api/properties/search-live";
  return `${endpoint}?${params.toString()}`;
}

interface PropertyQueryParams {
  searchQuery: string;
  propertyType: string;
  priceRange: [number, number];
}

export function buildPropertyQueryUrl({ searchQuery, propertyType, priceRange }: PropertyQueryParams): string {
  const params = new URLSearchParams();
  if (searchQuery) params.set("search", searchQuery);
  if (propertyType && propertyType !== "all") params.set("type", propertyType);
  if (priceRange[0] > 0) params.set("minPrice", priceRange[0].toString());
  if (priceRange[1] < 2000000) params.set("maxPrice", priceRange[1].toString());
  const qs = params.toString();
  return qs ? `/api/properties?${qs}` : "/api/properties";
}

interface PropertyFilterCriteria {
  propertyType: string;
  priceRange: [number, number];
  searchQuery: string;
}

export function filterProperties(properties: Property[], { propertyType, priceRange, searchQuery }: PropertyFilterCriteria): Property[] {
  const query = searchQuery.toLowerCase();
  return properties.filter((property) => {
    const matchesType = propertyType === "all" || property.propertyType === propertyType;
    const matchesPrice =
      parseFloat(property.price) >= priceRange[0] &&
      parseFloat(property.price) <= priceRange[1];
    const matchesSearch =
      !searchQuery ||
      property.address.toLowerCase().includes(query) ||
      property.city.toLowerCase().includes(query) ||
      property.state?.toLowerCase().includes(query);
    return matchesType && matchesPrice && matchesSearch;
  });
}
