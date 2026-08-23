// ---------------------------------------------------------------------------
// Which channel is Homiquity in?
//
// This file exists because the codebase could not answer that question, and
// two incompatible answers were both being built toward:
//
//   BROKER        We originate and hand the file to a wholesale lender, who
//                 funds it, owns it, and delivers it to the GSE. We never hold
//                 a note. No warehouse line, no loans held for sale, no
//                 duration risk on assets. This is what L1_VISION_AND_SCOPE §2
//                 says the product is.
//
//   CORRESPONDENT We close loans in our own name with borrowed funds and sell
//                 them on. We become the seller/servicer: ULDD delivery, UCD,
//                 EarlyCheck edits, Special Feature Codes and MERS
//                 registration all become OUR obligations.
//
// The tell was the Fannie Mae delivery stack — ~2,360 lines implementing
// seller/servicer delivery readiness, plus a MERS org ID being pursued. A
// broker performs none of that: the wholesale lender is the seller/servicer
// and does it again itself. Either that work is overhead, or the real plan is
// correspondent and nothing in the knowledge base said so.
//
// ---------------------------------------------------------------------------
// WHY A CONSTANT RATHER THAN A DELETION
// ---------------------------------------------------------------------------
// Deleting the delivery stack would be right under one reading and destroy
// months of correct work under the other. So the channel is DECLARED here, the
// stack is kept, and flipping the answer is one edit in this file. (The CI
// growth-freeze on the stack was lifted 2026-08-23 by founder directive —
// CHARTER §1a: business decisions gate operations, never what may be built.)
//
// The decision itself, its consequences and its cost are in
// knowledge-base/governance/CHANNEL_DECISION.md. Read that before changing the
// constant — moving to "correspondent" invalidates the platform's entire
// capital picture, not just this line.
// ---------------------------------------------------------------------------

export const BUSINESS_CHANNELS = ["broker", "correspondent"] as const;
export type BusinessChannel = (typeof BUSINESS_CHANNELS)[number];

/**
 * The channel Homiquity operates in TODAY.
 *
 * Founder-owned. Changing it is a capital-structure decision, not a
 * refactor — see CHANNEL_DECISION.md §3 for everything that must be true
 * before "correspondent" is honest.
 */
export const BUSINESS_CHANNEL: BusinessChannel = "broker";

/**
 * True when Homiquity is the seller/servicer of record — i.e. when GSE loan
 * delivery, UCD, Special Feature Codes and MERS registration are OUR
 * obligations rather than the wholesale lender's.
 */
export function isSellerServicerChannel(channel: BusinessChannel = BUSINESS_CHANNEL): boolean {
  return channel === "correspondent";
}

/**
 * True when the company takes funding risk on its own balance sheet — the
 * warehouse line, loans held for sale, and the duration mismatch that comes
 * with them. Drives whether the contingent-liability register
 * (shared/contingentLiabilities.ts) is complete.
 */
export function holdsFundingRisk(channel: BusinessChannel = BUSINESS_CHANNEL): boolean {
  return channel === "correspondent";
}

export interface ChannelApplicability {
  channel: BusinessChannel;
  /** True when the surface is a function this channel actually performs. */
  applicable: boolean;
  /** Plain statement for staff reading a report they should not act on. */
  message: string;
}

/**
 * Applicability of the Fannie Mae loan-delivery stack to the current channel.
 *
 * Attached to the delivery-readiness report rather than used to disable it:
 * the report stays available (it is a useful pre-flight on data quality), but
 * it must never read as an obligation Homiquity owes when it does not.
 */
export function deliveryStackApplicability(
  channel: BusinessChannel = BUSINESS_CHANNEL,
): ChannelApplicability {
  if (isSellerServicerChannel(channel)) {
    return {
      channel,
      applicable: true,
      message:
        "Homiquity is the seller/servicer in this channel — these Loan Delivery, UCD and Special " +
        "Feature Code results are binding obligations before delivery to the GSE.",
    };
  }
  return {
    channel,
    applicable: false,
    message:
      "INFORMATIONAL ONLY — Homiquity is a broker. The wholesale lender is the seller/servicer " +
      "and owns GSE delivery, the UCD, the Loan Delivery edits, Special Feature Codes and MERS " +
      "registration. These results are a data-quality pre-flight on our own file, not a " +
      "delivery obligation we owe. Nothing here gates a broker submission.",
  };
}

/**
 * Is a MERS organisation id meaningful in this channel?
 *
 * MERS registers the notes an entity HOLDS. A broker holds none, so pursuing
 * an org id is an annual membership fee for a registry with nothing to
 * register. Kept as a function so the answer moves with the channel rather
 * than sitting as a stale "PENDING" that implies it is merely late.
 */
export function mersOrgIdApplicable(channel: BusinessChannel = BUSINESS_CHANNEL): boolean {
  return isSellerServicerChannel(channel);
}
