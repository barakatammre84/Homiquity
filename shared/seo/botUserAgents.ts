/**
 * Crawler / link-unfurler user-agent matcher for the SEO bot prerender.
 *
 * Originally ported verbatim from a platform edge-rewrite user-agent matcher,
 * and kept deliberately GENERIC rather than tightened: this is now the single
 * place that decides "is this a bot?", so narrowing it silently stops
 * prerendering for whichever crawler falls out. Divergence would prerender
 * different URL sets per
 * platform. Deliberately not "improved": the generic [Bb]ot / [Cc]rawler /
 * [Ss]pider alternations are the tested production trigger (they also admit
 * e.g. AhrefsBot/SemrushBot, by design), and the mixed-case classes exist
 * because the platform matcher was case-sensitive. tests/seoPrerender.test.ts
 * pins representative matches and non-matches.
 */
export const BOT_UA_REGEX =
  /.*([Bb]ot|[Cc]rawler|[Ss]pider|facebookexternalhit|[Ff]acebot|[Tt]witterbot|[Ll]inked[Ii]n[Bb]ot|[Ss]lackbot|[Ww]hats[Aa]pp|[Tt]elegram[Bb]ot|[Dd]iscordbot|[Ee]mbedly|[Aa]pplebot|[Pp]interest|[Ss]kype[Uu]ri[Pp]review|[Bb]ingbot|[Gg]ooglebot|[Dd]uck[Dd]uck[Bb]ot|[Bb]aiduspider|[Yy]andex|[Rr]edditbot|[Mm]astodon|[Vv]k[Ss]hare|[Ww]3[Cc]_[Vv]alidator).*/;
