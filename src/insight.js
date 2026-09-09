/* One honest daily insight, derived rather than written.

   The audit's fair complaint was that the page's "personal guidance" was a generic
   planet definition with the placement bolted on beside it. This composes the line the
   other way round: find which slow graha is transiting which natal house right now, then
   say what that house is about and what the graha is traditionally associated with.

   The rules the constitution sets for this text hold here:
     - traditional association only, never a prediction or an outcome
     - the reason is always visible, because the reason is what produced the sentence
     - nothing is asserted that the engine did not compute

   Rahu and Ketu are excluded: they are computed points, and a "transit" of a node
   through a house carries enough interpretive disagreement that a landing page is the
   wrong place to take a side. */

/* what each house is traditionally taken to cover — short, plain, no jargon */
export const HOUSE_THEME = {
  1:  ["how you begin", "your body, your bearing, the way you start things"],
  2:  ["what you hold", "money, speech, and the family you came from"],
  3:  ["your own effort", "courage, siblings, and the work you do with your hands"],
  4:  ["home", "where you rest, your mother, and what makes you feel settled"],
  5:  ["what you make", "creativity, learning, play, and children"],
  6:  ["daily work", "routine, health, service, and the obstacles you meet"],
  7:  ["partnership", "marriage, close alliances, and the agreements you enter"],
  8:  ["what changes you", "depth, upheaval, inheritance, and what is shared"],
  9:  ["what you believe", "teachers, long journeys, and the meaning you live by"],
  10: ["your work in the world", "standing, reputation, and what you are known for"],
  11: ["what comes back", "gains, friendships, networks, and long-held hopes"],
  12: ["what you let go", "retreat, rest, closure, and what is spent"]
};

/* the quality each graha is traditionally read as bringing to a house it crosses */
const GRAHA_QUALITY = {
  Saturn:  "patience, and the slow work of building something that lasts",
  Jupiter: "growth, perspective, and a willingness to take the wider view",
  Mars:    "energy and directness, and the urge to finish what has stalled",
  Sun:     "attention and visibility, and the pull to act in your own name",
  Venus:   "ease, warmth, and an eye for what is worth keeping",
  Mercury: "quick thinking, talk, and the sorting of detail",
  Moon:    "feeling, and a sensitivity to what is going on around you"
};

/* slowest first: a Saturn transit is the one worth naming */
const BY_WEIGHT = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"];

/* transits: the array transitInto() returns. natal: the birth chart's planets. */
export function dailyInsight(transits, natal) {
  const t = BY_WEIGHT.map(g => transits.find(p => p.graha === g)).find(Boolean);
  if (!t) return null;

  const [theme, gloss] = HOUSE_THEME[t.house];
  const natalHere = natal.filter(p => p.house === t.house && p.graha !== "Rahu" && p.graha !== "Ketu");

  return {
    graha: t.graha,
    house: t.house,
    sign: t.signName,
    nakshatra: t.nakshatra,
    retro: t.retro,
    theme,
    /* the sentence, and separately the working that produced it */
    line: `${t.graha} is crossing your ${ord(t.house)} house — ${theme}. Within Vedic tradition a passage like this is associated with ${GRAHA_QUALITY[t.graha]}.`,
    gloss: `Your ${ord(t.house)} house covers ${gloss}.`,
    because: [
      `${t.graha} is at ${t.deg.toFixed(1)}° ${t.signName} today, in ${t.nakshatra}${t.retro ? ", retrograde" : ""}.`,
      `From your ascendant, ${t.signName} is your ${ord(t.house)} house.`,
      natalHere.length
        ? `You were born with ${list(natalHere.map(p => p.graha))} already there, so this passage meets something of your own.`
        : `You were born with no graha there, so the house is lit only by what crosses it.`
    ]
  };
}

const ord = n => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
const list = a => a.length < 2 ? a[0] : a.slice(0, -1).join(", ") + " and " + a.at(-1);
