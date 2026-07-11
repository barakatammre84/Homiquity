// Central manifest for marketing lifestyle photography. One place to swap a
// photo or edit its alt text. Files live in attached_assets/lifestyle/ (see the
// CREDITS.md there for sources + Unsplash license) and are bundled by Vite via
// the @assets alias, so they are served same-origin (satisfies CSP img-src 'self').
//
// The set is curated for diverse representation (race, age, gender, family
// composition) per Fair Housing Act §804(c) / HUD human-models guidance — swap
// like-for-like to keep it representative.
import landingHero from "@assets/lifestyle/landing-hero.jpg";
import firstTimeBuyerHero from "@assets/lifestyle/first-time-buyer-hero.jpg";
import vaLoansHero from "@assets/lifestyle/va-loans-hero.jpg";
import selfEmployedHero from "@assets/lifestyle/self-employed-hero.jpg";
import refinanceHero from "@assets/lifestyle/refinance-hero.jpg";
import founderNote from "@assets/lifestyle/founder-note.jpg";
import learningPlanning from "@assets/lifestyle/learning-planning.jpg";

export interface LifestyleImageAsset {
  /** Bundled, same-origin asset URL. */
  src: string;
  /** Descriptive alt text (used when rendered as a foreground image; hero
   *  backdrops render decoratively with empty alt). */
  alt: string;
}

export const lifestyleImages = {
  landingHero: {
    src: landingHero,
    alt: "A family relaxing together in the living room of their home",
  },
  firstTimeBuyer: {
    src: firstTimeBuyerHero,
    alt: "A young couple holding the keys to their first home on moving day",
  },
  vaLoans: {
    src: vaLoansHero,
    alt: "A veteran and his wife smiling together",
  },
  selfEmployed: {
    src: selfEmployedHero,
    alt: "A self-employed woman working at a desk in her home office",
  },
  refinance: {
    src: refinanceHero,
    alt: "A family cooking together in the kitchen of their home",
  },
  founderNote: {
    src: founderNote,
    alt: "A parent holding their two children in front of their home",
  },
  learning: {
    src: learningPlanning,
    alt: "A person reviewing home-buying information on a laptop at home",
  },
} satisfies Record<string, LifestyleImageAsset>;
