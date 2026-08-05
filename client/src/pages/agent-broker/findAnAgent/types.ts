export const SPECIALTIES = [
  { value: "first_time_buyers", label: "First-Time Buyers" },
  { value: "luxury", label: "Luxury Homes" },
  { value: "investment", label: "Investment Properties" },
  { value: "commercial", label: "Commercial" },
  { value: "relocation", label: "Relocation" },
  { value: "new_construction", label: "New Construction" },
  { value: "condos", label: "Condos & Townhomes" },
  { value: "foreclosure", label: "Foreclosures & Short Sales" },
];

export const TIMELINES = [
  { value: "immediately", label: "As soon as possible" },
  { value: "1_3_months", label: "1-3 months" },
  { value: "3_6_months", label: "3-6 months" },
  { value: "6_12_months", label: "6-12 months" },
  { value: "just_exploring", label: "Just exploring" },
];

export const PRICE_RANGES = [
  { value: "under_200k", label: "Under $200K" },
  { value: "200k_400k", label: "$200K - $400K" },
  { value: "400k_600k", label: "$400K - $600K" },
  { value: "600k_800k", label: "$600K - $800K" },
  { value: "800k_1m", label: "$800K - $1M" },
  { value: "1m_2m", label: "$1M - $2M" },
  { value: "over_2m", label: "$2M+" },
];

export const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family Home" },
  { value: "condo", label: "Condo / Townhome" },
  { value: "multi_family", label: "Multi-Family (2-4 units)" },
  { value: "new_construction", label: "New Construction" },
  { value: "land", label: "Land / Lot" },
];

export type AgentResult = {
  id: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  brokerage: string | null;
  specialties: string[] | null;
  serviceArea: string[] | null;
  photoUrl: string | null;
  averageRating: string | null;
  totalReviews: number | null;
  propertiesSold: number | null;
  activeListings: number | null;
  yearsInBusiness: number | null;
  isVerified: boolean | null;
};

export function getSpecialtyLabel(value: string): string {
  return SPECIALTIES.find((s) => s.value === value)?.label || value.replace(/_/g, " ");
}
