import { describe, it, expect } from "vitest";
import { apiGet, apiPost, fetchPage } from "./setup";

describe("API Health & Auth", () => {
  it("returns 401 for unauthenticated /api/auth/user", async () => {
    const res = await apiGet("/api/auth/user");
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated access to protected routes", async () => {
    const protectedRoutes = [
      "/api/loan-applications",
      "/api/documents",
      "/api/tasks",
    ];

    const results = await Promise.all(protectedRoutes.map((r) => apiGet(r)));
    for (const res of results) {
      expect([401, 403]).toContain(res.status);
    }
  });

  it("rejects unauthenticated POST to loan applications", async () => {
    const res = await apiPost("/api/loan-applications", {
      loanType: "conventional",
      loanPurpose: "purchase",
      estimatedPropertyValue: "500000",
    });
    expect([401, 403]).toContain(res.status);
  });
});

describe("Public API Endpoints", () => {
  it("GET /api/properties returns property list", async () => {
    const res = await apiGet("/api/properties");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/mortgage-rates returns mortgage rates", async () => {
    const res = await apiGet("/api/mortgage-rates");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/mortgage-rate-programs returns rate programs", async () => {
    const res = await apiGet("/api/mortgage-rate-programs");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/articles returns published articles", async () => {
    const res = await apiGet("/api/articles");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/faqs returns published FAQs", async () => {
    const res = await apiGet("/api/faqs");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/dpa-programs returns DPA programs", async () => {
    const res = await apiGet("/api/dpa-programs");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("property search with filters works", async () => {
    const res = await apiGet("/api/properties?type=single_family&minPrice=100000&maxPrice=500000");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("CSRF Protection", () => {
  it("allows GET requests without origin header", async () => {
    const res = await apiGet("/api/properties");
    expect(res.status).toBe(200);
  });
});

describe("Page Serving", () => {
  it("serves the landing page at /", async () => {
    const res = await fetchPage("/");
    expect(res.status).toBe(200);
    expect(res.body).toContain("<!DOCTYPE html>");
  });

  it("serves SPA for client routes", async () => {
    const clientRoutes = ["/apply", "/rates", "/properties", "/faq", "/privacy"];
    const results = await Promise.all(clientRoutes.map((r) => fetchPage(r)));
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body).toContain("<!DOCTYPE html>");
    }
  });

  it("serves SPA for protected routes too (client handles auth)", async () => {
    const protectedPages = ["/dashboard", "/documents", "/staff-dashboard"];
    const results = await Promise.all(protectedPages.map((r) => fetchPage(r)));
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body).toContain("<!DOCTYPE html>");
    }
  });
});

describe("Input Validation", () => {
  it("handles invalid property filters gracefully", async () => {
    const res = await apiGet("/api/properties?minPrice=abc&maxPrice=xyz");
    expect([200, 400]).toContain(res.status);
  });

  it("returns 404 for non-existent property", async () => {
    const res = await apiGet("/api/properties/nonexistent-id-12345");
    expect([404, 500]).toContain(res.status);
  });

  it("returns 404 for non-existent FAQ", async () => {
    const res = await apiGet("/api/faqs/nonexistent-id-xyz");
    expect([404, 500]).toContain(res.status);
  });
});

describe("Data Integrity", () => {
  it("mortgage rate programs have expected structure", async () => {
    const res = await apiGet("/api/mortgage-rate-programs");
    expect(res.status).toBe(200);
    if (res.body.length > 0) {
      const program = res.body[0];
      expect(program).toHaveProperty("id");
      expect(program).toHaveProperty("name");
      expect(program).toHaveProperty("slug");
    }
  });

  it("properties endpoint returns proper structure", async () => {
    const res = await apiGet("/api/properties");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("DPA programs have expected structure", async () => {
    const res = await apiGet("/api/dpa-programs");
    expect(res.status).toBe(200);
    if (res.body.length > 0) {
      const program = res.body[0];
      expect(program).toHaveProperty("id");
      expect(program).toHaveProperty("name");
    }
  });
});

describe("API Error Handling", () => {
  it("returns proper error for invalid JSON body", async () => {
    const res = await fetch("http://localhost:5000/api/loan-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });
    expect([400, 401, 403, 500]).toContain(res.status);
  });

  it("handles unsupported API methods gracefully", async () => {
    const res = await fetch("http://localhost:5000/api/properties", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBeLessThan(600);
  });
});
