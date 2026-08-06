/**
 * Crawler / link-unfurler user-agent matcher for the SEO bot prerender.
 *
 * Ported VERBATIM from the vercel.json bot-rewrite's `has: user-agent` value —
 * the two must stay byte-identical until the Vercel cutover PR deletes that
 * file, because during the transition BOTH platforms decide "is this a bot?"
 * with this pattern and a divergence would prerender different URL sets per
 * platform. Deliberately not "improved": the generic [Bb]ot / [Cc]rawler /
 * [Ss]pider alternations are the tested production trigger (they also admit
 * e.g. AhrefsBot/SemrushBot, by design), and the mixed-case classes exist
 * because the platform matcher was case-sensitive. tests/seoPrerender.test.ts
 * pins representative matches and non-matches.
 */
export const BOT_UA_REGEX =
  /.*([Bb]ot|[Cc]rawler|[Ss]pider|facebookexternalhit|[Ff]acebot|[Tt]witterbot|[Ll]inked[Ii]n[Bb]ot|[Ss]lackbot|[Ww]hats[Aa]pp|[Tt]elegram[Bb]ot|[Dd]iscordbot|[Ee]mbedly|[Aa]pplebot|[Pp]interest|[Ss]kype[Uu]ri[Pp]review|[Bb]ingbot|[Gg]ooglebot|[Dd]uck[Dd]uck[Bb]ot|[Bb]aiduspider|[Yy]andex|[Rr]edditbot|[Mm]astodon|[Vv]k[Ss]hare|[Ww]3[Cc]_[Vv]alidator).*/;
