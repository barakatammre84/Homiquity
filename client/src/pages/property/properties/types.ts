import type { PropertySearchMode } from "@/lib/propertySearch";

export const PROPERTY_TYPES = [
  { value: "all", label: "All Types" },
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
];

export interface AutoCompleteSuggestion {
  id: string;
  type: string;
  label: string;
  city: string | null;
  stateCode: string | null;
  slug: string | null;
}

export type SearchMode = PropertySearchMode;

export interface LiveProperty {
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

export interface LiveSearchResponse {
  properties: LiveProperty[];
  total: number;
  source: string;
}

export type ViewMode = "grid" | "list";
