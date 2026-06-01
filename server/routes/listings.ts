// Uses Redfin unofficial API. No API key required. Monitor for breaking changes.

import type { Express, Request, Response } from "express";

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 60 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function stripRedfinPrefix(text: string): any {
  const cleaned = text.replace(/^\)\]\}'/, "").trim();
  return JSON.parse(cleaned);
}

function slugify(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface ListingResult {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  lotSize: number | null;
  yearBuilt: number | null;
  photos: string[];
  status: string;
  daysOnMarket: number | null;
  description: string;
  lat: number;
  lng: number;
  redfinUrl: string;
  listedBy: string | null;
}

function parseRedfinHome(home: any): ListingResult {
  const h = home.homeData || home;
  const addr = h.addressInfo || {};
  const price = h.priceInfo || {};
  const beds = h.beds ?? h.bedrooms ?? 0;
  const baths = h.baths ?? h.bathrooms ?? 0;
  const sqft = h.sqFt?.value ?? h.sqftInfo?.amount ?? h.livingArea ?? 0;
  const photos: string[] = [];
  if (h.photos && Array.isArray(h.photos)) {
    for (const p of h.photos.slice(0, 5)) {
      if (p.photoUrls?.fullScreenPhotoUrl) photos.push(p.photoUrls.fullScreenPhotoUrl);
      else if (p.photoUrls?.nonFullScreenPhotoUrl) photos.push(p.photoUrls.nonFullScreenPhotoUrl);
      else if (typeof p === "string") photos.push(p);
    }
  }
  if (photos.length === 0 && h.staticMapUrl) {
    photos.push(h.staticMapUrl);
  }

  return {
    id: String(h.propertyId || h.listingId || h.mlsId || ""),
    address: addr.formattedStreetLine || h.streetAddress || "",
    city: addr.city || "",
    state: addr.state || "",
    zip: addr.zip || addr.zipcode || "",
    price: price.amount ?? h.price?.value ?? h.listPrice ?? 0,
    beds,
    baths,
    sqft,
    lotSize: h.lotSize?.value ?? null,
    yearBuilt: h.yearBuilt?.yearBuilt ?? h.yearBuilt ?? null,
    photos,
    status: h.listingType || h.status || "unknown",
    daysOnMarket: h.daysOnMarket?.daysOnMarket ?? h.dom ?? null,
    description: h.listingRemarks || h.description || "",
    lat: addr.centroid?.centroid?.latitude ?? addr.latitude ?? h.latitude ?? 0,
    lng: addr.centroid?.centroid?.longitude ?? addr.longitude ?? h.longitude ?? 0,
    redfinUrl: h.url ? `https://www.redfin.com${h.url}` : "",
    listedBy: h.listingAgent?.name ?? h.brokerName ?? null,
  };
}

async function getRegionId(city: string, stateCode: string): Promise<{ regionId: string; regionType: string; marketSlug: string } | null> {
  const query = `${city}, ${stateCode}`;
  const url = `https://www.redfin.com/stingray/do/location-autocomplete?location=${encodeURIComponent(query)}&v=2`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/javascript, */*",
      Referer: "https://www.redfin.com/",
      Origin: "https://www.redfin.com",
    },
  });

  if (!res.ok) {
    console.error(`[listings] Redfin autocomplete returned ${res.status} for "${query}"`);
    return null;
  }

  const text = await res.text();
  let data: any;
  try {
    data = stripRedfinPrefix(text);
  } catch {
    console.error("[listings] Failed to parse Redfin autocomplete response");
    return null;
  }

  if (!data?.payload?.sections) return null;

  for (const section of data.payload.sections) {
    if (!section.rows) continue;
    for (const row of section.rows) {
      if (row.type === 2 || row.type === 6) {
        const rawId = String(row.id || row.tableId || "");
        const numericId = rawId.replace(/^[^0-9]*/, "");
        if (!numericId) continue;
        const slug = row.url || `/${slugify(city)}-${stateCode.toUpperCase()}`;
        return { regionId: numericId, regionType: String(row.type), marketSlug: slug };
      }
    }
  }

  return null;
}

async function searchListingsFromRedfin(
  city: string,
  stateCode: string,
  limit: number,
  homeType?: string,
): Promise<any[]> {
  const region = await getRegionId(city, stateCode);
  if (!region) return [];

  const uipt = homeType && HOME_TYPE_MAP[homeType.toLowerCase()]
    ? HOME_TYPE_MAP[homeType.toLowerCase()].join(",")
    : "1,2,3,4";

  const params = new URLSearchParams({
    al: "1",
    market: slugify(city),
    num_homes: String(Math.min(limit * 3, 100)),
    ord: "redfin-recommended-asc",
    page_number: "1",
    region_id: region.regionId,
    region_type: region.regionType,
    sf: "1,2,3,4,5,6,7",
    status: "9",
    uipt,
    v: "8",
  });

  const url = `https://www.redfin.com/stingray/api/gis?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/javascript, */*",
      Referer: "https://www.redfin.com/",
      Origin: "https://www.redfin.com",
    },
  });

  if (!res.ok) {
    console.error(`[listings] Redfin GIS search returned ${res.status}`);
    return [];
  }

  const text = await res.text();
  let data: any;
  try {
    data = stripRedfinPrefix(text);
  } catch {
    console.error("[listings] Failed to parse Redfin GIS response");
    return [];
  }

  return data?.payload?.homes || [];
}

async function getListingDetail(propertyId: string): Promise<any | null> {
  const url = `https://www.redfin.com/stingray/api/home/details/belowTheFold?propertyId=${propertyId}&accessLevel=1`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/javascript, */*",
      Referer: "https://www.redfin.com/",
      Origin: "https://www.redfin.com",
    },
  });

  if (!res.ok) {
    console.error(`[listings] Redfin detail returned ${res.status} for propertyId ${propertyId}`);
    return null;
  }

  const text = await res.text();
  try {
    return stripRedfinPrefix(text);
  } catch {
    console.error("[listings] Failed to parse Redfin detail response");
    return null;
  }
}

async function searchNearbyListings(
  lat: number,
  lng: number,
  radiusMiles: number,
  limit: number,
): Promise<any[]> {
  const degreeOffset = radiusMiles / 69;
  const params = new URLSearchParams({
    al: "1",
    num_homes: String(Math.min(limit * 2, 100)),
    ord: "redfin-recommended-asc",
    page_number: "1",
    poly: [
      `${lng - degreeOffset} ${lat - degreeOffset}`,
      `${lng + degreeOffset} ${lat - degreeOffset}`,
      `${lng + degreeOffset} ${lat + degreeOffset}`,
      `${lng - degreeOffset} ${lat + degreeOffset}`,
      `${lng - degreeOffset} ${lat - degreeOffset}`,
    ].join(","),
    sf: "1,2,3,4,5,6,7",
    status: "9",
    uipt: "1,2,3,4",
    v: "8",
  });

  const url = `https://www.redfin.com/stingray/api/gis?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/javascript, */*",
      Referer: "https://www.redfin.com/",
      Origin: "https://www.redfin.com",
    },
  });

  if (!res.ok) {
    console.error(`[listings] Redfin nearby GIS returned ${res.status}`);
    return [];
  }

  const text = await res.text();
  let data: any;
  try {
    data = stripRedfinPrefix(text);
  } catch {
    console.error("[listings] Failed to parse Redfin nearby response");
    return [];
  }

  return data?.payload?.homes || [];
}

const HOME_TYPE_MAP: Record<string, number[]> = {
  house: [1],
  condo: [2],
  townhouse: [3],
};

export function registerListingsRoutes(app: Express) {
  app.get("/api/listings/search", async (req: Request, res: Response) => {
    try {
      const {
        city,
        stateCode,
        minPrice,
        maxPrice,
        beds,
        baths,
        homeType,
        limit: limitParam,
      } = req.query;

      if (!city || !stateCode) {
        return res.status(400).json({
          error: true,
          message: "city and stateCode query params are required",
          listings: [],
        });
      }

      if (minPrice && isNaN(Number(minPrice))) {
        return res.status(400).json({ error: true, message: "minPrice must be a number", listings: [] });
      }
      if (maxPrice && isNaN(Number(maxPrice))) {
        return res.status(400).json({ error: true, message: "maxPrice must be a number", listings: [] });
      }
      if (beds && isNaN(Number(beds))) {
        return res.status(400).json({ error: true, message: "beds must be a number", listings: [] });
      }
      if (baths && isNaN(Number(baths))) {
        return res.status(400).json({ error: true, message: "baths must be a number", listings: [] });
      }
      if (homeType && !["house", "condo", "townhouse"].includes(String(homeType).toLowerCase())) {
        return res.status(400).json({ error: true, message: "homeType must be house, condo, or townhouse", listings: [] });
      }

      const limit = Math.min(parseInt(String(limitParam || "20"), 10) || 20, 100);
      const htStr = homeType ? String(homeType).toLowerCase() : undefined;
      const cacheKey = `search:${city}:${stateCode}:${minPrice}:${maxPrice}:${beds}:${baths}:${htStr}:${limit}`;

      const cached = getCached<ListingResult[]>(cacheKey);
      if (cached) return res.json({ error: false, listings: cached });

      const rawHomes = await searchListingsFromRedfin(
        String(city),
        String(stateCode),
        limit,
        htStr,
      );

      let listings = rawHomes.map(parseRedfinHome);

      if (minPrice) {
        const min = parseFloat(String(minPrice));
        listings = listings.filter((l) => l.price >= min);
      }
      if (maxPrice) {
        const max = parseFloat(String(maxPrice));
        listings = listings.filter((l) => l.price <= max);
      }
      if (beds) {
        const minBeds = parseInt(String(beds), 10);
        listings = listings.filter((l) => l.beds >= minBeds);
      }
      if (baths) {
        const minBaths = parseFloat(String(baths));
        listings = listings.filter((l) => l.baths >= minBaths);
      }

      listings = listings.slice(0, limit);

      setCache(cacheKey, listings);
      res.json({ error: false, listings });
    } catch (error: any) {
      console.error("[listings/search] Error:", error.message);
      res.json({
        error: true,
        message: error.message || "Failed to fetch listings",
        listings: [],
      });
    }
  });

  app.get("/api/listings/nearby", async (req: Request, res: Response) => {
    try {
      const { lat, lng, radiusMiles: radiusParam, limit: limitParam } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({
          error: true,
          message: "lat and lng query params are required",
          listings: [],
        });
      }

      const latNum = parseFloat(String(lat));
      const lngNum = parseFloat(String(lng));

      if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
        return res.status(400).json({
          error: true,
          message: "lat must be between -90 and 90, lng between -180 and 180",
          listings: [],
        });
      }
      const radiusMiles = parseFloat(String(radiusParam || "5")) || 5;
      const limit = Math.min(parseInt(String(limitParam || "20"), 10) || 20, 100);
      const cacheKey = `nearby:${latNum}:${lngNum}:${radiusMiles}:${limit}`;

      const cached = getCached<ListingResult[]>(cacheKey);
      if (cached) return res.json({ error: false, listings: cached });

      const rawHomes = await searchNearbyListings(latNum, lngNum, radiusMiles, limit);
      let listings = rawHomes.map(parseRedfinHome).slice(0, limit);

      setCache(cacheKey, listings);
      res.json({ error: false, listings });
    } catch (error: any) {
      console.error("[listings/nearby] Error:", error.message);
      res.json({
        error: true,
        message: error.message || "Failed to fetch nearby listings",
        listings: [],
      });
    }
  });

  app.get("/api/listings/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const cacheKey = `detail:${id}`;

      const cached = getCached<any>(cacheKey);
      if (cached) return res.json({ error: false, listing: cached });

      const detail = await getListingDetail(id);
      if (!detail) {
        return res.status(404).json({
          error: true,
          message: "Listing not found",
          listing: null,
        });
      }

      const payload = detail.payload || detail;
      const mainInfo = payload.publicRecordsInfo || payload.propertyInfo || {};
      const listingInfo = payload.listingInfo || {};
      const amenities = payload.amenitiesInfo || {};

      const photos: string[] = [];
      if (payload.mediaBrowserInfo?.photos) {
        for (const p of payload.mediaBrowserInfo.photos) {
          if (p.photoUrls?.fullScreenPhotoUrl) photos.push(p.photoUrls.fullScreenPhotoUrl);
          else if (p.photoUrls?.nonFullScreenPhotoUrl) photos.push(p.photoUrls.nonFullScreenPhotoUrl);
        }
      }

      const listing = {
        id,
        address: mainInfo.displayableAddress || mainInfo.streetAddress || "",
        city: mainInfo.city || "",
        state: mainInfo.state || "",
        zip: mainInfo.zip || "",
        price: mainInfo.listPrice ?? listingInfo.price ?? 0,
        beds: mainInfo.beds ?? 0,
        baths: mainInfo.baths ?? 0,
        sqft: mainInfo.sqFt ?? 0,
        lotSize: mainInfo.lotSize ?? null,
        yearBuilt: mainInfo.yearBuilt ?? null,
        photos,
        status: listingInfo.status || "unknown",
        daysOnMarket: listingInfo.daysOnMarket ?? null,
        description: listingInfo.remarks || payload.listingRemarks || "",
        lat: mainInfo.latitude ?? 0,
        lng: mainInfo.longitude ?? 0,
        redfinUrl: payload.url ? `https://www.redfin.com${payload.url}` : "",
        listedBy: listingInfo.agentName ?? null,
        amenities: amenities.superGroups || [],
        taxHistory: payload.taxHistory || [],
        priceHistory: payload.propertyHistory || [],
      };

      setCache(cacheKey, listing);
      res.json({ error: false, listing });
    } catch (error: any) {
      console.error("[listings/:id] Error:", error.message);
      res.json({
        error: true,
        message: error.message || "Failed to fetch listing detail",
        listing: null,
      });
    }
  });
}
