import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicQueryFn } from "@/lib/queryClient";
import { averageHomePrice, stateFromZip } from "@/lib/zipGeography";
import type { RateLoanType } from "@shared/rateLoanTypes";
import type { MortgageRateWithProgram } from "@/types/rates";

/**
 * THE rate request for the public /rates/* surface.
 *
 * Every product page used to hold its own copy of this: a `zipcode` state, a
 * `searchZipcode` state, a private ten-state `getStateFromZip`, an inline
 * `useQuery`, and a `handleSearch` — five copies that had already drifted (the
 * ZIP→state stubs disagreed with the table the page header rendered from; see
 * lib/zipGeography.ts). Stating the request once means the six pages differ in
 * the only way they should: their loan type and their copy.
 *
 * WHAT IS IN THE KEY, AND WHY THE ASSUMPTIONS ARE NOT
 * ---------------------------------------------------
 * `loanType`, `zipcode` and `state` are the three inputs `GET
 * /api/mortgage-rates` actually reads (server/routes/admin.ts →
 * storage.getMortgageRatesForLocation). They are in the key, so
 * `buildQueryUrl` derives the request from it and the cache cannot describe a
 * request that was not made — the property this whole client rests on.
 *
 * `assumptions` is deliberately NOT in the key. The rates come from a table of
 * advertised programs, not from a pricing engine: the server has no parameter
 * for a property value and would ignore one. Putting it in the key would
 * fragment the cache per keystroke, refetch identical data, and — worse — make
 * the URL claim the quote was personalised to a figure the server never saw.
 * These values exist to let a visitor see the shape of a deal in their price
 * range; each rate row still discloses the assumptions IT was quoted under
 * (`loanAmount` / `downPaymentPercent` / `creditScoreMin`).
 *
 * Do not "fix" this by adding them to the key.
 */

/** How long a typed ZIP settles before it becomes a request. */
const SEARCH_DEBOUNCE_MS = 300;

const ZIP_LENGTH = 5;

/**
 * The display-only figures the rate header lets a visitor adjust. Seeded from
 * the ZIP's state average, then owned by the visitor.
 */
export interface RateAssumptions {
  propertyValue: string;
  mortgageBalance: string;
  cashOutAmount: string;
}

/** Seed assumptions from a ZIP. Same ratios the header has always used. */
export function assumptionsForZip(zip: string): RateAssumptions {
  const avg = averageHomePrice(zip);
  return {
    propertyValue: String(avg),
    mortgageBalance: String(Math.round(avg * 0.6)),
    cashOutAmount: String(Math.round(avg * 0.1)),
  };
}

export interface UseRateSearchResult {
  /** What the visitor has typed. Bind the ZIP input to this. */
  zipcode: string;
  setZipcode: (zip: string) => void;
  /** The ZIP the current results are FOR (empty until one settles). */
  searchedZipcode: string;
  /** Commit the typed ZIP immediately (Enter key, explicit search button). */
  search: () => void;
  assumptions: RateAssumptions;
  setAssumptions: (next: Partial<RateAssumptions>) => void;
  rates: MortgageRateWithProgram[] | undefined;
  /** First load — nothing to render yet. */
  isLoading: boolean;
  /** Any fetch in flight, including a background refetch (drives the spinner). */
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * @param loanType The product to advertise, or `undefined` for the /rates hub,
 *   which lists every product and therefore sends no `loanType` at all.
 */
export function useRateSearch(loanType?: RateLoanType): UseRateSearchResult {
  const [zipcode, setZipcodeState] = useState("");
  const [searchedZipcode, setSearchedZipcode] = useState("");
  const [assumptions, setAssumptionsState] = useState<RateAssumptions>(() =>
    assumptionsForZip(""),
  );

  // The ZIP whose assumptions we have already seeded. Re-seeding on every
  // render of the same ZIP would stamp over a value the visitor just typed.
  const seededZipRef = useRef("");

  const query = useQuery<MortgageRateWithProgram[]>({
    queryKey: [
      "/api/mortgage-rates",
      {
        // Omitted entirely for the hub. `buildQueryUrl` drops undefined, so the
        // request is `?zipcode=…` with no loanType — which is what the server
        // treats as "every product".
        loanType,
        zipcode: searchedZipcode,
        state: stateFromZip(searchedZipcode),
      },
    ],
    queryFn: getPublicQueryFn<MortgageRateWithProgram[]>(),
  });

  const search = useCallback(() => {
    if (zipcode.length === ZIP_LENGTH) setSearchedZipcode(zipcode);
  }, [zipcode]);

  // Seed the assumptions from the ZIP's state average, once per ZIP.
  useEffect(() => {
    if (zipcode.length !== ZIP_LENGTH || zipcode === seededZipRef.current) return;
    seededZipRef.current = zipcode;
    setAssumptionsState(assumptionsForZip(zipcode));
  }, [zipcode]);

  // Auto-search on a settled ZIP. This lived in RatePageHeader, which made a
  // presentational component the thing that decided when to fetch — and left
  // the timer depending on every caller remembering to memoise its `onSearch`
  // (an unmemoised one re-armed the timer on every render). Here `search` is
  // memoised by construction and the header no longer knows the request exists.
  useEffect(() => {
    if (zipcode.length !== ZIP_LENGTH) return;
    const timer = setTimeout(search, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [zipcode, search]);

  const setAssumptions = useCallback((next: Partial<RateAssumptions>) => {
    setAssumptionsState((prev) => ({ ...prev, ...next }));
  }, []);

  const setZipcode = useCallback((zip: string) => {
    // One place that normalises the input, so a page cannot accept a ZIP shape
    // the request would then fail on.
    setZipcodeState(zip.replace(/\D/g, "").slice(0, ZIP_LENGTH));
  }, []);

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    zipcode,
    setZipcode,
    searchedZipcode,
    search,
    assumptions,
    setAssumptions,
    rates: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}
