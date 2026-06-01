import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { SEOHead } from "@/components/SEOHead";

import { Footer } from "@/components/Footer";
import { PropertyMap } from "@/components/PropertyMap";
import { StreetView } from "@/components/StreetView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";
import { AffordabilityBadge, AffordabilityDetail } from "@/components/AffordabilityBadge";
import {
  MapPin,
  Bed,
  Bath,
  Square,
  Calendar,
  Home,
  DollarSign,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Heart,
  Share2,
  ExternalLink,
  Building,
  GraduationCap,
  History,
  Star,
  Car,
  Layers,
  TreePine,
  BarChart3,
  Bot,
} from "lucide-react";

interface SimilarHome {
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

interface LivePropertyDetail {
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

function PersonalizedAffordabilityCard({ price, address }: { price: number; address: string }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <Card data-testid="card-personalized-affordability-anon">
        <CardContent className="p-5 text-center">
          <TrendingUp className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Can you afford this home?</p>
          <p className="mt-1 text-xs text-muted-foreground">Sign in to see a personalized affordability check</p>
          <Link href="/login">
            <Button variant="outline" className="mt-3 w-full gap-2" size="sm" data-testid="button-signin-affordability">
              Sign In to Check
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-personalized-affordability">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5" />
          Your Affordability
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AffordabilityDetail price={price} />
        <Separator className="my-3" />
        <Link href={`/ai-coach?propertyPrice=${price}&propertyAddress=${encodeURIComponent(address)}`}>
          <Button variant="outline" className="w-full gap-2" data-testid="button-check-with-coach">
            <Bot className="h-4 w-4" />
            Discuss with AI Coach
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function LivePropertyDetailPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const propertyId = params.get("propertyId") || "";
  const listingId = params.get("listingId") || "";

  const detailUrl = propertyId
    ? `/api/properties/detail-live?propertyId=${encodeURIComponent(propertyId)}${listingId ? `&listingId=${encodeURIComponent(listingId)}` : ""}`
    : null;

  const { data: property, isLoading, error } = useQuery<LivePropertyDetail>({
    queryKey: [detailUrl],
    enabled: !!detailUrl,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Skeleton className="mb-4 h-10 w-40" />
          <Skeleton className="mb-6 h-96 w-full rounded-xl" />
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-6 w-96" />
              <Skeleton className="h-40 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <Home className="mx-auto h-16 w-16 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">Property Not Found</h1>
          <p className="mt-2 text-muted-foreground">We couldn't load the details for this listing.</p>
          <Link href="/properties">
            <Button className="mt-4" data-testid="button-back-browse">Browse Properties</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusLabel = property.flags.isPending ? "Pending" : property.flags.isContingent ? "Contingent" : property.flags.isNewConstruction ? "New Construction" : property.flags.isForeclosure ? "Foreclosure" : property.flags.isComingSoon ? "Coming Soon" : "For Sale";
  const fullAddress = `${property.address}, ${property.city}, ${property.stateCode} ${property.zipcode}`;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Property Details" description="View detailed property information including photos, price history, mortgage estimates, schools, and neighborhood data." />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/properties">
          <Button variant="ghost" className="mb-4 gap-2" data-testid="button-back-search">
            <ChevronLeft className="h-4 w-4" />
            Back to Search
          </Button>
        </Link>

        <PhotoGallery photos={property.photos} address={property.address} />

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
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

            <Separator className="my-6" />

            {property.description && (
              <div className="mb-8">
                <h2 className="mb-3 text-xl font-semibold">About This Property</h2>
                <p className="leading-relaxed text-muted-foreground">{property.description}</p>
              </div>
            )}

            {property.details.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">Property Details</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {property.details.map((section, i) => (
                    <Card key={i}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{section.category}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1">
                          {section.items.map((item, j) => (
                            <li key={j} className="text-sm text-muted-foreground">{item}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {property.schools.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                  <GraduationCap className="h-5 w-5" />
                  Nearby Schools
                </h2>
                <div className="space-y-3">
                  {property.schools.map((school, i) => (
                    <Card key={i}>
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{school.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="secondary" className="capitalize">{school.levels.join(", ")}</Badge>
                            {school.fundingType && <span className="capitalize">{school.fundingType}</span>}
                            {school.distance && <span>{school.distance.toFixed(1)} mi</span>}
                            {school.studentCount && <span>{school.studentCount.toLocaleString()} students</span>}
                          </div>
                        </div>
                        {school.rating !== null && (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-amber-500" />
                            <span className="font-bold">{school.rating}/10</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {property.propertyHistory.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                  <History className="h-5 w-5" />
                  Property History
                </h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {property.propertyHistory.map((entry, i) => (
                        <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                            <Badge variant="secondary">{entry.event}</Badge>
                          </div>
                          <div className="text-right">
                            {entry.price ? (
                              <span className="font-medium">{formatCurrency(entry.price)}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">--</span>
                            )}
                            {entry.source && (
                              <p className="text-xs text-muted-foreground">{entry.source}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {property.taxHistory.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                  <BarChart3 className="h-5 w-5" />
                  Tax History
                </h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Year</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Tax</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Assessment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {property.taxHistory.map((t, i) => (
                            <tr key={i}>
                              <td className="px-4 py-3">{t.year}</td>
                              <td className="px-4 py-3 text-right">{formatCurrency(t.tax)}</td>
                              <td className="px-4 py-3 text-right">{t.assessmentTotal ? formatCurrency(t.assessmentTotal) : "--"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {property.mortgage && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Estimated Monthly Payment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 text-center">
                    <p className="text-4xl font-bold text-primary" data-testid="text-mortgage-payment">
                      {formatCurrency(property.mortgage.monthlyPayment)}
                    </p>
                    <p className="text-sm text-muted-foreground">per month</p>
                  </div>

                  <div className="space-y-3">
                    {property.mortgage.breakdown.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span>{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Down Payment (20%)</span>
                      <span className="font-medium">{formatCurrency(property.mortgage.downPayment)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Loan Amount</span>
                      <span className="font-medium">{formatCurrency(property.mortgage.loanAmount)}</span>
                    </div>
                    {property.mortgage.rate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Interest Rate</span>
                        <span className="font-medium">{(property.mortgage.rate * 100).toFixed(3)}%</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Loan Term</span>
                      <span className="font-medium">{property.mortgage.term} years</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {property.neighborhoods.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building className="h-5 w-5" />
                    Neighborhood
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {property.neighborhoods.map((n, i) => (
                    <div key={i}>
                      <p className="mb-2 font-medium">{n.name}</p>
                      <div className="space-y-2 text-sm">
                        {n.medianPrice && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Median Sold Price</span>
                            <span className="font-medium">{formatCurrency(n.medianPrice)}</span>
                          </div>
                        )}
                        {n.medianListingPrice && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Median Listing Price</span>
                            <span className="font-medium">{formatCurrency(n.medianListingPrice)}</span>
                          </div>
                        )}
                        {n.medianPricePerSqft && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Price per Sqft</span>
                            <span className="font-medium">{formatCurrency(n.medianPricePerSqft)}</span>
                          </div>
                        )}
                        {n.medianDaysOnMarket && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Days on Market</span>
                            <span className="font-medium">{n.medianDaysOnMarket}</span>
                          </div>
                        )}
                      </div>
                      {i < property.neighborhoods.length - 1 && <Separator className="mt-3" />}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {property.branding.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Listed By</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {property.branding.map((b, i) => (
                    <div key={i} className="text-sm">
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.type}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {property.coordinate && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-0 pb-4">
                  <div className="overflow-hidden rounded-md mx-4">
                    <PropertyMap
                      lat={property.coordinate.lat}
                      lng={property.coordinate.lon}
                      address={fullAddress}
                    />
                  </div>
                  <div className="overflow-hidden rounded-md mx-4">
                    <StreetView lat={property.coordinate.lat} lng={property.coordinate.lon} />
                  </div>
                </CardContent>
              </Card>
            )}

            <PersonalizedAffordabilityCard price={property.price} address={fullAddress} />

            <Card className="bg-primary text-primary-foreground">
              <CardContent className="p-6 text-center">
                <TrendingUp className="mx-auto h-8 w-8" />
                <h3 className="mt-2 text-lg font-semibold">Interested in This Home?</h3>
                <p className="mt-1 text-sm opacity-90">
                  Get pre-approved and see personalized loan options
                </p>
                <Link href={`/pre-approval?price=${property.price}&address=${encodeURIComponent(fullAddress)}`}>
                  <Button variant="secondary" className="mt-4 w-full" data-testid="button-get-preapproved">
                    Get Pre-Approved
                  </Button>
                </Link>
                {property.href && (
                  <a href={property.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
                    <Button variant="outline" className="w-full gap-2 border-primary-foreground/30 text-primary-foreground" data-testid="button-view-external">
                      <ExternalLink className="h-4 w-4" />
                      View Full Listing
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>

            {property.listDate && (
              <div className="text-center text-xs text-muted-foreground">
                Listed {new Date(property.listDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
            )}
          </div>
        </div>
      </div>

      <SimilarHomes propertyId={propertyId} />

      <Footer />
    </div>
  );
}

function SimilarHomes({ propertyId }: { propertyId: string }) {
  const similarUrl = propertyId
    ? `/api/properties/similar-homes?propertyId=${encodeURIComponent(propertyId)}`
    : null;

  const { data: homes, isLoading } = useQuery<SimilarHome[]>({
    queryKey: [similarUrl],
    enabled: !!similarUrl,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-bold">Similar Homes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-44 w-full rounded-t-md" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!homes || homes.length === 0) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8" data-testid="section-similar-homes">
      <h2 className="mb-6 text-2xl font-bold">Similar Homes</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {homes.map((home) => (
          <Link key={home.property_id} href={`/properties/live?propertyId=${home.property_id}`}>
            <Card className="overflow-visible hover-elevate cursor-pointer" data-testid={`card-similar-${home.property_id}`}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-t-md">
                {home.photo ? (
                  <img
                    src={home.photo}
                    alt={home.address}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted">
                    <Home className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <p className="text-lg font-bold" data-testid={`text-similar-price-${home.property_id}`}>
                  {formatCurrency(home.price)}
                </p>
                {home.pricePerSqft && (
                  <p className="text-xs text-muted-foreground">{formatCurrency(home.pricePerSqft)}/sqft</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {home.beds && (
                    <span className="flex items-center gap-1">
                      <Bed className="h-3.5 w-3.5" /> {home.beds}
                    </span>
                  )}
                  {home.baths && (
                    <span className="flex items-center gap-1">
                      <Bath className="h-3.5 w-3.5" /> {home.baths}
                    </span>
                  )}
                  {home.sqft && (
                    <span className="flex items-center gap-1">
                      <Square className="h-3.5 w-3.5" /> {home.sqft.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="mt-2 truncate text-sm font-medium">{home.address}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {home.city}, {home.stateCode} {home.zipcode}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PhotoGallery({ photos, address }: { photos: string[]; address: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);

  if (photos.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl bg-muted lg:h-96">
        <Home className="h-24 w-24 text-muted-foreground/30" />
      </div>
    );
  }

  if (showAll) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{photos.length} Photos</h2>
          <Button variant="outline" size="sm" onClick={() => setShowAll(false)} data-testid="button-close-gallery">
            Close Gallery
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, i) => (
            <div key={i} className="aspect-[4/3] overflow-hidden rounded-lg">
              <img src={photo} alt={`${address} photo ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handlePrev = () => setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  const handleNext = () => setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));

  return (
    <div className="relative">
      <div className="grid gap-2 lg:grid-cols-4 lg:grid-rows-2" style={{ height: "420px" }}>
        <div className="relative col-span-2 row-span-2 overflow-hidden rounded-l-xl lg:col-span-2">
          <img
            src={photos[currentIndex]}
            alt={`${address} main`}
            className="h-full w-full object-cover"
            data-testid="img-main-photo"
          />
          <div className="absolute bottom-4 left-4 flex gap-2">
            <Button variant="secondary" size="icon" onClick={handlePrev} data-testid="button-photo-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" onClick={handleNext} data-testid="button-photo-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="absolute bottom-4 right-4 flex gap-2">
            <Button variant="secondary" size="icon">
              <Heart className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {photos.slice(1, 5).map((photo, i) => (
          <div key={i} className={`hidden overflow-hidden lg:block ${i === 1 ? "rounded-tr-xl" : ""} ${i === 3 ? "rounded-br-xl" : ""}`}>
            <img src={photo} alt={`${address} photo ${i + 2}`} className="h-full w-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>

      {photos.length > 5 && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-4 right-4 gap-1 lg:right-4"
          onClick={() => setShowAll(true)}
          data-testid="button-show-all-photos"
        >
          Show all {photos.length} photos
        </Button>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white lg:hidden">
        {currentIndex + 1} / {photos.length}
      </div>
    </div>
  );
}
