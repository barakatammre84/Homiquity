import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated } from "../auth";
import { checkPropertyEligibility } from "../underwriting";

export function registerPropertyRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get("/api/properties/auto-complete", async (req, res) => {
    try {
      const { input } = req.query;
      if (!input || typeof input !== "string" || input.trim().length < 2) {
        return res.json([]);
      }

      const apiKey = process.env.RAPIDAPI_KEY;
      if (!apiKey) {
        return res.json([]);
      }

      const response = await fetch(
        `https://realty-us.p.rapidapi.com/properties/auto-complete?input=${encodeURIComponent(input.trim())}`,
        {
          headers: {
            "x-rapidapi-host": "realty-us.p.rapidapi.com",
            "x-rapidapi-key": apiKey,
          },
        }
      );

      if (!response.ok) {
        console.error("Auto-complete API error:", response.status);
        return res.json([]);
      }

      const data = await response.json();
      const suggestions = (data?.data?.autocomplete || [])
        .filter((item: any) => item.area_type === "city" || item.area_type === "state" || item.area_type === "address" || item.area_type === "postal_code" || item.area_type === "neighborhood")
        .slice(0, 8)
        .map((item: any) => ({
          id: item._id,
          type: item.area_type,
          label: item.full_address || item.city || item.state || "",
          city: item.city || null,
          stateCode: item.state_code || null,
          slug: item.slug_id || null,
        }));

      res.json(suggestions);
    } catch (error) {
      console.error("Auto-complete error:", error);
      res.json([]);
    }
  });

  app.get("/api/properties/search-live", async (req, res) => {
    try {
      const { location, sortBy, minPrice, maxPrice, type, page } = req.query;
      if (!location || typeof location !== "string") {
        return res.json({ properties: [], total: 0, source: "empty" });
      }

      const apiKey = process.env.RAPIDAPI_KEY;
      if (!apiKey) {
        return res.json({ properties: [], total: 0, source: "no_key" });
      }

      const params = new URLSearchParams();
      params.set("location", location);
      params.set("sortBy", (sortBy as string) || "relevance");
      if (minPrice) params.set("priceMin", minPrice as string);
      if (maxPrice) params.set("priceMax", maxPrice as string);
      if (type && type !== "all") {
        const typeMap: Record<string, string> = {
          single_family: "single_family",
          condo: "condo",
          townhouse: "townhomes",
          multi_family: "multi_family",
        };
        if (typeMap[type as string]) params.set("home_type", typeMap[type as string]);
      }
      if (page) params.set("offset", String((parseInt(page as string) - 1) * 20));

      const response = await fetch(
        `https://realty-us.p.rapidapi.com/properties/search-buy?${params.toString()}`,
        {
          headers: {
            "x-rapidapi-host": "realty-us.p.rapidapi.com",
            "x-rapidapi-key": apiKey,
          },
        }
      );

      if (!response.ok) {
        console.error("Search-buy API error:", response.status);
        return res.json({ properties: [], total: 0, source: "api_error" });
      }

      const data = await response.json();
      const results = data?.data?.results || [];
      const total = data?.data?.total || results.length;

      const properties = results.map((item: any) => {
        const addr = item.location?.address || {};
        const desc = item.description || {};
        const baths = desc.baths ?? desc.baths_full_calc ?? null;
        return {
          property_id: item.property_id,
          status: item.status || "for_sale",
          price: item.list_price || item.list_price_min || 0,
          address: addr.line || "",
          city: addr.city || "",
          state: addr.state || "",
          stateCode: addr.state_code || "",
          zipcode: addr.postal_code || "",
          beds: desc.beds ?? desc.beds_min ?? null,
          baths: baths,
          sqft: desc.sqft ?? desc.sqft_min ?? null,
          lotSqft: desc.lot_sqft || null,
          propertyType: desc.type || "single_family",
          photo: item.primary_photo?.href || null,
          photos: (item.photos || []).slice(0, 6).map((p: any) => p.href),
          listDate: item.list_date || null,
          priceReduced: item.price_reduced_amount || null,
          isNewConstruction: item.flags?.is_new_construction || false,
          isForeclosure: item.flags?.is_foreclosure || false,
          isPending: item.flags?.is_pending || false,
          href: item.href || null,
        };
      });

      res.json({ properties, total, source: "live" });
    } catch (error) {
      console.error("Search-buy error:", error);
      res.json({ properties: [], total: 0, source: "error" });
    }
  });

  app.get("/api/properties/detail-live", async (req, res) => {
    try {
      const { propertyId, listingId } = req.query;
      if (!propertyId || typeof propertyId !== "string") {
        return res.status(400).json({ error: "propertyId is required" });
      }

      const apiKey = process.env.RAPIDAPI_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: "Property detail service unavailable" });
      }

      const params = new URLSearchParams();
      params.set("propertyId", propertyId);
      if (listingId && typeof listingId === "string") {
        params.set("listingId", listingId);
      }

      const response = await fetch(
        `https://realty-us.p.rapidapi.com/properties/detail?${params.toString()}`,
        {
          headers: {
            "x-rapidapi-host": "realty-us.p.rapidapi.com",
            "x-rapidapi-key": apiKey,
          },
        }
      );

      if (!response.ok) {
        console.error("Property detail API error:", response.status);
        return res.status(502).json({ error: "Failed to fetch property details" });
      }

      const raw = await response.json();
      const p = raw?.data;
      if (!p) {
        return res.status(404).json({ error: "Property not found" });
      }

      const addr = p.location?.address || {};
      const desc = p.description || {};
      const mortgage = p.mortgage?.estimate || null;

      const detail = {
        property_id: p.property_id,
        listing_id: p.listing_id || null,
        status: p.status || "for_sale",
        href: p.href || null,
        listDate: p.list_date || null,
        lastSoldPrice: p.last_sold_price || null,
        lastSoldDate: p.last_sold_date || null,
        price: p.list_price || p.list_price_min || 0,
        pricePerSqft: p.price_per_sqft || null,

        address: addr.line || "",
        city: addr.city || "",
        state: addr.state || "",
        stateCode: addr.state_code || "",
        zipcode: addr.postal_code || "",
        coordinate: addr.coordinate || null,
        streetViewUrl: p.location?.street_view_url || null,
        neighborhoods: (p.location?.neighborhoods || []).map((n: any) => ({
          name: n.name,
          medianPrice: n.geo_statistics?.housing_market?.median_sold_price || null,
          medianPricePerSqft: n.geo_statistics?.housing_market?.median_price_per_sqft || null,
          medianListingPrice: n.geo_statistics?.housing_market?.median_listing_price || null,
          medianDaysOnMarket: n.geo_statistics?.housing_market?.median_days_on_market || null,
        })),

        beds: desc.beds ?? null,
        baths: desc.baths ?? null,
        sqft: desc.sqft ?? null,
        lotSqft: desc.lot_sqft || null,
        stories: desc.stories || null,
        garage: desc.garage || null,
        yearBuilt: desc.year_built || null,
        propertyType: desc.type || "single_family",
        description: desc.text || null,
        styles: desc.styles || null,
        pool: desc.pool || null,

        photos: (p.photos || []).map((photo: any) => photo.href),

        flags: {
          isNewConstruction: p.flags?.is_new_construction || false,
          isForeclosure: p.flags?.is_foreclosure || false,
          isPending: p.flags?.is_pending || false,
          isContingent: p.flags?.is_contingent || false,
          isPriceReduced: p.flags?.is_price_reduced || false,
          isNewListing: p.flags?.is_new_listing || false,
          isComingSoon: p.flags?.is_coming_soon || false,
        },

        mortgage: mortgage ? {
          loanAmount: mortgage.loan_amount,
          monthlyPayment: mortgage.monthly_payment,
          downPayment: mortgage.down_payment,
          rate: mortgage.average_rate?.rate || null,
          term: mortgage.average_rate?.loan_type?.term || 30,
          breakdown: (mortgage.monthly_payment_details || []).map((d: any) => ({
            type: d.type,
            amount: d.amount,
            label: d.display_name,
          })),
        } : null,

        hoa: p.hoa ? { fee: p.hoa.fee, frequency: p.hoa.frequency } : null,

        details: (p.details || []).map((d: any) => ({
          category: d.category,
          items: d.text || [],
        })),

        taxHistory: (p.tax_history || []).slice(0, 5).map((t: any) => ({
          year: t.year,
          tax: t.tax,
          assessmentTotal: t.assessment?.total || null,
          assessmentLand: t.assessment?.land || null,
          assessmentBuilding: t.assessment?.building || null,
        })),

        propertyHistory: (p.property_history || []).slice(0, 10).map((h: any) => ({
          date: h.date,
          event: h.event_name,
          price: h.price || null,
          source: h.source_name || null,
        })),

        schools: (p.schools?.schools || []).slice(0, 6).map((s: any) => ({
          name: s.name,
          rating: s.rating || null,
          distance: s.distance_in_miles || null,
          levels: s.education_levels || [],
          grades: s.grades || [],
          fundingType: s.funding_type || null,
          studentCount: s.student_count || null,
        })),

        estimates: p.estimates || null,
        branding: (p.branding || []).map((b: any) => ({
          type: b.type,
          name: b.name,
          phone: b.phone,
        })),
      };

      res.json(detail);
    } catch (error) {
      console.error("Property detail error:", error);
      res.status(500).json({ error: "Failed to fetch property details" });
    }
  });

  app.get("/api/properties/similar-homes", async (req, res) => {
    try {
      const { propertyId } = req.query;
      if (!propertyId || typeof propertyId !== "string") {
        return res.status(400).json({ error: "propertyId is required" });
      }

      const apiKey = process.env.RAPIDAPI_KEY;
      if (!apiKey) {
        return res.json([]);
      }

      const response = await fetch(
        `https://realty-us.p.rapidapi.com/properties/similar-homes?propertyId=${encodeURIComponent(propertyId)}`,
        {
          headers: {
            "x-rapidapi-host": "realty-us.p.rapidapi.com",
            "x-rapidapi-key": apiKey,
          },
        }
      );

      if (!response.ok) {
        console.error("Similar homes API error:", response.status);
        return res.json([]);
      }

      const data = await response.json();
      const results = data?.data || [];

      const homes = results.slice(0, 8).map((p: any) => {
        const loc = p.location?.address || {};
        const desc = p.description || {};
        const photo = p.primary_photo?.href || p.photos?.[0]?.href || null;

        return {
          property_id: p.property_id,
          listing_id: p.listing_id || null,
          price: p.list_price || 0,
          address: loc.line || "",
          city: loc.city || "",
          stateCode: loc.state_code || "",
          zipcode: loc.postal_code || "",
          beds: desc.beds || null,
          baths: desc.baths || null,
          sqft: desc.sqft || null,
          lotSqft: desc.lot_sqft || null,
          yearBuilt: desc.year_built || null,
          propertyType: desc.type || "unknown",
          photo,
          status: p.status || "for_sale",
          pricePerSqft: p.price_per_sqft || null,
          href: p.href || null,
        };
      });

      res.json(homes);
    } catch (error) {
      console.error("Similar homes error:", error);
      res.json([]);
    }
  });

  app.get("/api/properties/search-sold", async (req, res) => {
    try {
      const { location, sortBy, minPrice, maxPrice, type, page } = req.query;
      if (!location || typeof location !== "string") {
        return res.json({ properties: [], total: 0, source: "empty" });
      }

      const apiKey = process.env.RAPIDAPI_KEY;
      if (!apiKey) {
        return res.json({ properties: [], total: 0, source: "no_key" });
      }

      const params = new URLSearchParams();
      params.set("location", location);
      params.set("sortBy", (sortBy as string) || "sold_date");
      if (minPrice) params.set("priceMin", minPrice as string);
      if (maxPrice) params.set("priceMax", maxPrice as string);
      if (type && type !== "all") {
        const typeMap: Record<string, string> = {
          single_family: "single_family",
          condo: "condo",
          townhouse: "townhomes",
          multi_family: "multi_family",
        };
        if (typeMap[type as string]) params.set("home_type", typeMap[type as string]);
      }
      if (page) params.set("offset", String((parseInt(page as string) - 1) * 20));

      const response = await fetch(
        `https://realty-us.p.rapidapi.com/properties/search-sold?${params.toString()}`,
        {
          headers: {
            "x-rapidapi-host": "realty-us.p.rapidapi.com",
            "x-rapidapi-key": apiKey,
          },
        }
      );

      if (!response.ok) {
        console.error("Search-sold API error:", response.status);
        return res.json({ properties: [], total: 0, source: "api_error" });
      }

      const data = await response.json();
      const results = data?.data?.results || [];
      const total = data?.data?.total || results.length;

      const properties = results.map((item: any) => {
        const addr = item.location?.address || {};
        const desc = item.description || {};
        const baths = desc.baths ?? desc.baths_full_calc ?? null;
        return {
          property_id: item.property_id,
          status: item.status || "sold",
          price: item.list_price || item.last_sold_price || 0,
          soldPrice: item.last_sold_price || null,
          soldDate: item.last_sold_date || null,
          address: addr.line || "",
          city: addr.city || "",
          state: addr.state || "",
          stateCode: addr.state_code || "",
          zipcode: addr.postal_code || "",
          beds: desc.beds ?? desc.beds_min ?? null,
          baths: baths,
          sqft: desc.sqft ?? desc.sqft_min ?? null,
          lotSqft: desc.lot_sqft || null,
          propertyType: desc.type || "single_family",
          photo: item.primary_photo?.href || null,
          photos: (item.photos || []).slice(0, 6).map((p: any) => p.href),
          listDate: item.list_date || null,
          priceReduced: item.price_reduced_amount || null,
          isNewConstruction: item.flags?.is_new_construction || false,
          isForeclosure: item.flags?.is_foreclosure || false,
          isPending: item.flags?.is_pending || false,
          href: item.href || null,
        };
      });

      res.json({ properties, total, source: "live" });
    } catch (error) {
      console.error("Search-sold error:", error);
      res.json({ properties: [], total: 0, source: "error" });
    }
  });

  app.get("/api/properties", async (req, res) => {
    try {
      const { search, type, minPrice, maxPrice } = req.query;
      
      const properties = await storage.getAllProperties({
        search: search as string,
        type: type as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      });
      
      res.json(properties);
    } catch (error) {
      console.error("Get properties error:", error);
      res.status(500).json({ error: "Failed to get properties" });
    }
  });

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Get property error:", error);
      res.status(500).json({ error: "Failed to get property" });
    }
  });

  // Property DTI computation API - Uses underwriting engine to compute DTI with property
  app.post("/api/properties/:id/affordability", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const property = await storage.getProperty(req.params.id);
      
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Get user's latest pre-approved loan application
      const applications = await storage.getLoanApplicationsByUser(userId);
      const preApproval = applications.find(
        app => app.status === "pre_approved" || app.status === "approved"
      ) || applications[0];

      if (!preApproval) {
        return res.status(400).json({ 
          error: "No loan application found",
          message: "Please complete a pre-approval application first"
        });
      }

      // Validate required financial data exists
      const annualIncome = preApproval.annualIncome ? parseFloat(String(preApproval.annualIncome)) : 0;
      if (annualIncome <= 0) {
        return res.status(400).json({ 
          error: "Incomplete application",
          message: "Your loan application is missing income information"
        });
      }

      const preApprovalAmount = preApproval.preApprovalAmount 
        ? parseFloat(String(preApproval.preApprovalAmount))
        : 0;
      const monthlyIncome = annualIncome / 12;
      const monthlyDebts = preApproval.monthlyDebts 
        ? parseFloat(String(preApproval.monthlyDebts))
        : 0;
      const creditScore = preApproval.creditScore;
      if (!creditScore) {
        return res.status(400).json({ 
          error: "Incomplete application",
          message: "Your loan application is missing credit score information"
        });
      }

      const price = parseFloat(property.price);
      const downPaymentPercent = req.body.downPaymentPercent || 5;
      
      // Use underwriting engine to check property eligibility
      const eligibility = checkPropertyEligibility(
        preApprovalAmount * 0.2, // Estimate assets as 20% of pre-approval for down payment capacity
        monthlyIncome,
        monthlyDebts,
        price,
        property.propertyType || "single_family",
        undefined, // property tax - will use default estimate
        undefined, // HOA
        Math.max(100, price * 0.003 / 12), // insurance estimate based on property value
        100 - downPaymentPercent // max LTV
      );

      let status: "within_guidelines" | "exceeds_standard" | "exceeds_maximum" = "within_guidelines";
      
      if (price > preApprovalAmount) {
        status = "exceeds_maximum";
      }
      
      if (!eligibility.canBuyProperty || eligibility.finalDTI > 50) {
        status = "exceeds_maximum";
      } else if (eligibility.finalDTI > 43) {
        if (status !== "exceeds_maximum") status = "exceeds_standard";
      }

      res.json({
        withinGuidelines: status !== "exceeds_maximum",
        status,
        estimatedPayment: eligibility.estimatedPITI,
        dtiWithProperty: eligibility.finalDTI,
        requiredDownPayment: eligibility.requiredDownPayment,
        loanAmount: eligibility.maxLoanAmount,
        ltvRatio: eligibility.ltvRatio,
        reasons: eligibility.reasons,
        preApprovalAmount,
        monthlyIncome,
        creditScore,
      });
    } catch (error) {
      console.error("Affordability check error:", error);
      res.status(500).json({ error: "Failed to check affordability" });
    }
  });

  app.post("/api/properties", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user?.role || "";
      const agentProfile = await storage.getAgentProfileByUserId(userId);
      
      if (!agentProfile && userRole !== "admin") {
        return res.status(403).json({ error: "Agent profile required to create listings" });
      }

      const propertyData = {
        ...req.body,
        agentId: agentProfile?.id || null,
        listedAt: new Date(),
      };

      const property = await storage.createProperty(propertyData);
      
      if (agentProfile) {
        await storage.updateAgentProfile(agentProfile.id, {
          activeListings: (agentProfile.activeListings || 0) + 1,
        });
      }

      res.status(201).json(property);
    } catch (error) {
      console.error("Create property error:", error);
      res.status(500).json({ error: "Failed to create property" });
    }
  });

  app.patch("/api/properties/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user?.role || "";
      const property = await storage.getProperty(req.params.id);
      
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      if (userRole !== "admin") {
        const agentProfile = await storage.getAgentProfileByUserId(userId);
        if (!agentProfile || property.agentId !== agentProfile.id) {
          return res.status(403).json({ error: "Not authorized to update this property" });
        }
      }

      const updated = await storage.updateProperty(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Update property error:", error);
      res.status(500).json({ error: "Failed to update property" });
    }
  });

  app.delete("/api/properties/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user?.role || "";
      const property = await storage.getProperty(req.params.id);
      
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      const agentProfile = await storage.getAgentProfileByUserId(userId);
      if (userRole !== "admin" && (!agentProfile || property.agentId !== agentProfile.id)) {
        return res.status(403).json({ error: "Not authorized to delete this property" });
      }

      await storage.deleteProperty(req.params.id);
      
      if (property.status === "active" && agentProfile) {
        await storage.updateAgentProfile(agentProfile.id, {
          activeListings: Math.max((agentProfile.activeListings || 1) - 1, 0),
        });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Delete property error:", error);
      res.status(500).json({ error: "Failed to delete property" });
    }
  });

  app.post("/api/properties/lookup", async (req, res) => {
    try {
      let { query } = req.body;
      if (!query || typeof query !== "string" || query.trim().length < 3) {
        return res.status(400).json({ error: "Please provide an address or listing URL" });
      }

      query = query.trim();

      let address = query;
      try {
        const url = new URL(query);
        const pathParts = url.pathname.split("/").filter(Boolean);
        if (pathParts.length >= 1) {
          const addressPart = pathParts.find((p) =>
            /^\d+/.test(p) || p.includes("-")
          );
          if (addressPart) {
            address = addressPart.replace(/-/g, " ");
          } else {
            address = pathParts.slice(-3).join(" ").replace(/-/g, " ");
          }
        }
      } catch {
        // Not a URL — treat as raw address
      }

      const apiKey = process.env.RAPIDAPI_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: "Property lookup service unavailable" });
      }

      const acResponse = await fetch(
        `https://realty-us.p.rapidapi.com/properties/auto-complete?input=${encodeURIComponent(address)}`,
        {
          headers: {
            "x-rapidapi-host": "realty-us.p.rapidapi.com",
            "x-rapidapi-key": apiKey,
          },
        }
      );

      if (!acResponse.ok) {
        return res.status(502).json({ error: "Failed to look up address" });
      }

      const acData = await acResponse.json();
      const suggestions = acData?.data?.autocomplete || [];
      const addressMatch = suggestions.find((s: any) => s.area_type === "address");
      if (!addressMatch) {
        return res.json({
          found: false,
          message: "No property found at that address. Try entering the full street address with city and state.",
          suggestions: suggestions
            .filter((s: any) => s.area_type === "address")
            .slice(0, 5)
            .map((s: any) => ({
              label: s.full_address || s.line || "",
              city: s.city || "",
              stateCode: s.state_code || "",
            })),
        });
      }

      const fullAddress = addressMatch.full_address || addressMatch.line || address;

      const searchParams = new URLSearchParams({ location: fullAddress });
      const searchResponse = await fetch(
        `https://realty-us.p.rapidapi.com/properties/search-buy?${searchParams.toString()}`,
        {
          headers: {
            "x-rapidapi-host": "realty-us.p.rapidapi.com",
            "x-rapidapi-key": apiKey,
          },
        }
      );

      if (!searchResponse.ok) {
        console.error("Property lookup search error:", searchResponse.status);
        return res.status(502).json({ error: "Failed to look up property" });
      }

      const searchData = await searchResponse.json();
      const searchResults = searchData?.data?.results || [];

      const normalize = (s: any) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const inputNorm = normalize(fullAddress);
      const bestMatch = searchResults.find((r: any) => {
        const rAddr = r?.location?.address;
        if (!rAddr) return false;
        const rLine = normalize(rAddr.line || "");
        const rCity = normalize(rAddr.city || "");
        return inputNorm.includes(rLine) && rLine.length > 3 && inputNorm.includes(rCity);
      }) || searchResults[0];

      const firstResult = bestMatch;
      const propertyId = firstResult?.property_id;

      if (!propertyId) {
        return res.json({
          found: false,
          message: "Property found but no details available. The property may not be currently listed.",
        });
      }

      const detailParams = new URLSearchParams({ propertyId });
      const detailResponse = await fetch(
        `https://realty-us.p.rapidapi.com/properties/detail?${detailParams.toString()}`,
        {
          headers: {
            "x-rapidapi-host": "realty-us.p.rapidapi.com",
            "x-rapidapi-key": apiKey,
          },
        }
      );

      if (!detailResponse.ok) {
        const errBody = await detailResponse.text().catch(() => "");
        console.error("Property lookup detail error:", detailResponse.status, errBody.slice(0, 300));

        const addr2 = firstResult?.location?.address || {};
        const desc2 = firstResult?.description || {};
        return res.json({
          found: true,
          property: {
            propertyId,
            price: firstResult.list_price || firstResult.list_price_min || 0,
            address: addr2.line || "",
            city: addr2.city || "",
            state: addr2.state || "",
            stateCode: addr2.state_code || "",
            zipcode: addr2.postal_code || "",
            beds: desc2.beds ?? null,
            baths: desc2.baths ?? null,
            sqft: desc2.sqft ?? null,
            lotSqft: desc2.lot_sqft || null,
            yearBuilt: desc2.year_built || null,
            propertyType: desc2.type || "single_family",
            description: null,
            photo: firstResult.primary_photo?.href || null,
            photos: (firstResult.photos || []).slice(0, 8).map((ph: any) => ph.href),
            status: firstResult.status || "unknown",
            coordinate: addr2.coordinate || null,
            propertyTaxRate: 1.2,
            hoaMonthly: 0,
            mortgage: null,
            neighborhoods: [],
          },
        });
      }

      const raw = await detailResponse.json();
      const p = raw?.data;
      if (!p) {
        return res.json({ found: false, message: "Property details not available" });
      }

      const addr = p.location?.address || {};
      const desc = p.description || {};
      const mortgage = p.mortgage?.estimate || null;
      const hoa = p.hoa || null;
      const taxHistory = p.tax_history || [];
      const latestTax = taxHistory.length > 0 ? taxHistory[0] : null;
      const propertyTaxRate = latestTax && p.list_price
        ? ((latestTax.tax / p.list_price) * 100)
        : 1.2;

      res.json({
        found: true,
        property: {
          propertyId: p.property_id,
          price: p.list_price || p.list_price_min || p.last_sold_price || 0,
          address: addr.line || "",
          city: addr.city || "",
          state: addr.state || "",
          stateCode: addr.state_code || "",
          zipcode: addr.postal_code || "",
          beds: desc.beds ?? null,
          baths: desc.baths ?? null,
          sqft: desc.sqft ?? null,
          lotSqft: desc.lot_sqft || null,
          yearBuilt: desc.year_built || null,
          propertyType: desc.type || "single_family",
          description: desc.text || null,
          photo: p.primary_photo?.href || (p.photos?.[0]?.href) || null,
          photos: (p.photos || []).slice(0, 8).map((ph: any) => ph.href),
          status: p.status || "unknown",
          coordinate: addr.coordinate || null,
          propertyTaxRate: Math.round(propertyTaxRate * 100) / 100,
          hoaMonthly: hoa?.fee && hoa?.frequency === "monthly" ? hoa.fee : (hoa?.fee ? Math.round(hoa.fee / 12) : 0),
          mortgage: mortgage ? {
            monthlyPayment: mortgage.monthly_payment,
            rate: mortgage.average_rate?.rate || null,
          } : null,
          neighborhoods: (p.location?.neighborhoods || []).slice(0, 2).map((n: any) => ({
            name: n.name,
            medianPrice: n.geo_statistics?.housing_market?.median_sold_price || null,
          })),
        },
      });
    } catch (error) {
      console.error("Property lookup error:", error);
      res.status(500).json({ error: "Failed to look up property" });
    }
  });
}
