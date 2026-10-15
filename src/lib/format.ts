// Text the screens build from data: counts, lists of names, and movie details.
// One fixed locale, so the server and the browser render the same string.

const counts = new Intl.NumberFormat("en");
const conjunction = new Intl.ListFormat("en", { type: "conjunction" });
// Built from its code point: the formatter turns a "\u00a0" escape into the
// invisible character itself.
export const NO_BREAK_SPACE = String.fromCodePoint(0xa0);

/** "1,284", not "1284". */
export function formatCount(count: number): string {
  return counts.format(count);
}

/**
 * "Sam", "Sam and Alex", "Sam, Alex, and Jo", and past `max` names,
 * "Sam, Alex, Jo, and 95 others": a group can have 100 members, and a
 * sentence naming all of them fills the screen.
 */
export function listNames(names: readonly string[], max = 3): string {
  if (names.length <= max) return conjunction.format(names);
  const rest = names.length - max;
  return conjunction.format([
    ...names.slice(0, max),
    rest === 1 ? "1 other" : `${formatCount(rest)} others`,
  ]);
}

/**
 * "1999 · 2 h · Drama", skipping missing parts. The space before each dot
 * doesn't break, so a wrapped line never starts with "·".
 */
export function joinDetails(parts: readonly (string | null)[]): string {
  return parts.filter((part) => part !== null).join(`${NO_BREAK_SPACE}· `);
}
