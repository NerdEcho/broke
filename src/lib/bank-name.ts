// A bank's name as shown on screen. The stored name stays exactly as the bank feed gives it: sync writes it, and
// matching (the Watchlist's Chase filter) reads it. Pure, so `node src/lib/bank-name.test.ts` runs it.
const SHORT: [RegExp, string][] = [
  [/^citibank\b/i, "Citi"],
  [/^american express\b/i, "American Express"],
];
export function shortBank(name: string | null | undefined, fallback = "Bank") {
  const full = (name ?? "").trim();
  if (!full) return fallback;
  for (const [re, short] of SHORT) if (re.test(full)) return short;
  // "Lakeside Bank of Ohio" is Lakeside Bank. "Bank of America" has nothing before "Bank", so it stays.
  const regional = /^(.+ bank) of [a-z ]+$/i.exec(full);
  if (regional) return regional[1];
  // "Edward Jones - U.S. Clients Access" and "Best Buy - Citi Card": the part before the dash is the name.
  const head = full.split(/\s+[-–—]\s+/)[0].trim();
  return head.replace(/\s+(credit card|online|online banking)$/i, "").trim() || full;
}
