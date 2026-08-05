export interface SimilarHome {
  property_id: string;
  listing_id: string | null;
  price: number;
  address: string;
  city: string;
  stateCode: string;
  zipcode: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  propertyType: string;
  photo: string | null;
  status: string;
  pricePerSqft: number | null;
  href: string | null;
}

export interface LivePropertyDetail {
  property_id: string;
  listing_id: string | null;
  status: string;
  href: string | null;
  listDate: string | null;
  lastSoldPrice: number | null;
  lastSoldDate: string | null;
  price: number;
  pricePerSqft: number | null;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  zipcode: string;
  coordinate: { lat: number; lon: number } | null;
  streetViewUrl: string | null;
  neighborhoods: {
    name: string;
    medianPrice: number | null;
    medianPricePerSqft: number | null;
    medianListingPrice: number | null;
    medianDaysOnMarket: number | null;
  }[];
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  stories: number | null;
  garage: number | null;
  yearBuilt: number | null;
  propertyType: string;
  description: string | null;
  styles: string | null;
  pool: string | null;
  photos: string[];
  flags: {
    isNewConstruction: boolean;
    isForeclosure: boolean;
    isPending: boolean;
    isContingent: boolean;
    isPriceReduced: boolean;
    isNewListing: boolean;
    isComingSoon: boolean;
  };
  mortgage: {
    loanAmount: number;
    monthlyPayment: number;
    downPayment: number;
    rate: number | null;
    term: number;
    breakdown: { type: string; amount: number; label: string }[];
  } | null;
  hoa: { fee: number; frequency: string } | null;
  details: { category: string; items: string[] }[];
  taxHistory: {
    year: number;
    tax: number;
    assessmentTotal: number | null;
    assessmentLand: number | null;
    assessmentBuilding: number | null;
  }[];
  propertyHistory: {
    date: string;
    event: string;
    price: number | null;
    source: string | null;
  }[];
  schools: {
    name: string;
    rating: number | null;
    distance: number | null;
    levels: string[];
    grades: string[];
    fundingType: string | null;
    studentCount: number | null;
  }[];
  estimates: Record<string, unknown>;
  branding: { type: string; name: string; phone: string | null }[];
}
