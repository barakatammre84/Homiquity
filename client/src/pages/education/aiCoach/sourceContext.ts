/**
 * Maps inbound URL parameters to a banner label and an opening message.
 *
 * This is not cosmetic routing: when it returns non-null on a fresh visit the
 * page AUTO-SENDS `autoMessage` to the coach without the visitor typing
 * anything, and that message becomes the first turn of a saved conversation.
 * So the mapping decides what a borrower is recorded as having asked.
 *
 * Extracted from AICoach.tsx unchanged except for taking the query string as
 * an argument — reading window.location directly made it untestable.
 */

export interface SourceContext {
  /** Short label shown as a badge next to the conversation title. */
  banner: string;
  /** Sent on the visitor's behalf when they arrive with no history. */
  autoMessage: string;
}

export function getSourceContext(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): SourceContext | null {
  const params = new URLSearchParams(search);
  const source = params.get("source");
  const context = params.get("context");
  const type = params.get("type");

  if (source === "va" || type === "va" || context === "va") {
    return {
      banner: "VA Loan Guidance",
      autoMessage: "I'm a veteran and I'd like to explore VA loan options. Can you help me understand my eligibility and benefits?",
    };
  }
  if (source === "first-time" || context === "first-time") {
    return {
      banner: "First-Time Buyer",
      autoMessage: "I'm a first-time homebuyer and I want to understand what I need to get started. Can you assess my readiness?",
    };
  }
  if (source === "refinance" || type === "refinance") {
    return {
      banner: "Refinance Guidance",
      autoMessage: "I'm interested in refinancing my current mortgage. Can you help me understand my options?",
    };
  }
  if (source === "investor" || context === "investor") {
    return {
      banner: "Investment Property",
      autoMessage: "I'm looking at investment properties. Can you help me understand mortgage requirements for rental properties?",
    };
  }
  const propertyPrice = params.get("propertyPrice");
  const propertyAddress = params.get("propertyAddress");
  if (propertyPrice && propertyAddress) {
    const formattedPrice = parseFloat(propertyPrice).toLocaleString();
    return {
      banner: "Property Analysis",
      autoMessage: `I'm looking at a property at ${decodeURIComponent(propertyAddress)} listed at $${formattedPrice}. Can you help me understand if this home fits my budget and what my monthly payments would look like?`,
    };
  }
  if (propertyPrice) {
    const formattedPrice = parseFloat(propertyPrice).toLocaleString();
    return {
      banner: "Property Analysis",
      autoMessage: `I'm considering a home priced at $${formattedPrice}. Can you help me understand if I can afford it and what loan options might work?`,
    };
  }
  return null;
}
