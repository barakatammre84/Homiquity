// Seed DATA for the wholesale lender counterparties (no IO — see
// ../seedWholesaleLenders.ts for the seeder that writes these rows).
//
// This is the initial contents of the `wholesale_lenders` table, not a runtime
// catalog: nothing reads this at request time. The table is the single source
// of truth once seeded, and these rows are edited from the admin lender screen
// thereafter. Kept free of the `db` import so tests can assert the shortlist
// without a database.

export interface TargetLenderSeed {
  lenderId: string;
  lenderName: string;
  lenderCode: string;
  specialty: string;
  ausSupport: string[];
  nonQm: boolean;
}

export const TARGET_LENDERS: TargetLenderSeed[] = [
  {
    lenderId: "uwm",
    lenderName: "United Wholesale Mortgage",
    lenderCode: "UWM",
    specialty: "Conventional/FHA/VA volume leader, fast turn times",
    ausSupport: ["DU", "LPA"],
    nonQm: false,
  },
  {
    lenderId: "rocket-pro-tpo",
    lenderName: "Rocket Pro TPO",
    lenderCode: "RKTPO",
    specialty: "Conventional/FHA/VA, strong tech + pricing tools",
    ausSupport: ["DU", "LPA"],
    nonQm: false,
  },
  {
    lenderId: "plaza",
    lenderName: "Plaza Home Mortgage",
    lenderCode: "PLAZA",
    specialty: "Broad product menu incl. renovation + manufactured",
    ausSupport: ["DU", "LPA"],
    nonQm: false,
  },
  {
    lenderId: "angel-oak",
    lenderName: "Angel Oak Mortgage Solutions",
    lenderCode: "ANGOAK",
    specialty: "Non-QM / bank statement / investor DSCR",
    ausSupport: ["DU"],
    nonQm: true,
  },
  {
    lenderId: "newrez",
    lenderName: "Newrez Wholesale",
    lenderCode: "NEWREZ",
    specialty: "Conventional/government + non-QM overlay programs",
    ausSupport: ["DU", "LPA"],
    nonQm: true,
  },
];

