// A retirement projection in today's money. Pure, so `node src/lib/retirement.test.ts` runs it.
// Assumptions, not promises: every one of them is a field the user can change on the Retirement page.

export type RetireSettings = {
  birthYear: number | null;
  retireAge: number; // 65 unless changed
  monthly: number; // put into investment accounts each month, in today's money
  returnPct: number; // a year, before inflation
  inflationPct: number; // a year
  withdrawPct: number; // of the pot a year once retired
  otherMonthly: number; // Social Security, pension or other income a month at retirement, in today's money
  goalMonthly: number; // the income a month you want at retirement, in today's money; 0 when not set
  homeEquity: boolean; // reserved: a home is not counted
};
export const RETIRE_DEFAULTS: RetireSettings = { birthYear: null, retireAge: 65, monthly: 0, returnPct: 6, inflationPct: 2.5, withdrawPct: 4, otherMonthly: 0, goalMonthly: 0, homeEquity: false };

const num = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
/** Saved settings (user_metadata.retirement) with anything missing or out of range put back to its default. */
export function retireSettings(saved: unknown, thisYear: number): RetireSettings {
  const s = (saved && typeof saved === "object" ? saved : {}) as Record<string, unknown>;
  const d = RETIRE_DEFAULTS;
  const by = num(s.birthYear, thisYear - 100, thisYear - 16, NaN);
  return {
    birthYear: Number.isFinite(by) ? Math.round(by) : null,
    retireAge: Math.round(num(s.retireAge, 40, 80, d.retireAge)),
    monthly: num(s.monthly, 0, 1_000_000, d.monthly),
    returnPct: num(s.returnPct, 0, 15, d.returnPct),
    inflationPct: num(s.inflationPct, 0, 10, d.inflationPct),
    withdrawPct: num(s.withdrawPct, 1, 10, d.withdrawPct),
    otherMonthly: num(s.otherMonthly, 0, 1_000_000, d.otherMonthly),
    goalMonthly: num(s.goalMonthly, 0, 1_000_000, d.goalMonthly),
    homeEquity: false,
  };
}

export type RetirePoint = { age: number; year: number; pot: number };
export type RetireResult = {
  years: number; // from now until retirement; 0 when already there
  pot: number; // at retirement, in today's money
  contributed: number; // of the pot: what is there today plus what gets put in
  growth: number; // of the pot: the rest
  monthlyIncome: number; // the pot's share a month plus otherMonthly, in today's money
  fromPot: number; // the pot's share a month
  series: RetirePoint[]; // one point a year, starting today
};

/** Grows `invested` with `monthly` added each month until `retireAge`, at the return left after inflation. */
export function projectRetirement(invested: number, s: RetireSettings, thisYear: number, returnPct = s.returnPct): RetireResult | null {
  if (s.birthYear == null) return null;
  const age = thisYear - s.birthYear;
  const years = Math.max(0, s.retireAge - age);
  const real = (1 + returnPct / 100) / (1 + s.inflationPct / 100) - 1;
  const m = Math.pow(1 + real, 1 / 12) - 1;
  let pot = Math.max(0, invested), put = pot;
  const series: RetirePoint[] = [{ age, year: thisYear, pot }];
  for (let y = 1; y <= years; y++) {
    for (let i = 0; i < 12; i++) {
      pot = pot * (1 + m) + s.monthly;
      put += s.monthly;
    }
    series.push({ age: age + y, year: thisYear + y, pot });
  }
  const fromPot = (pot * s.withdrawPct) / 100 / 12;
  return { years, pot, contributed: put, growth: pot - put, fromPot, monthlyIncome: fromPot + s.otherMonthly, series };
}

/** The same projection at a lower, the chosen and a higher return: two points either side. */
export function retireRange(invested: number, s: RetireSettings, thisYear: number) {
  const at = (r: number) => projectRetirement(invested, s, thisYear, Math.max(0, r));
  const expected = at(s.returnPct);
  if (!expected) return null;
  return { low: at(s.returnPct - 2)!, expected, high: at(s.returnPct + 2)!, lowPct: Math.max(0, s.returnPct - 2), highPct: s.returnPct + 2 };
}

/** The monthly amount that reaches `targetMonthly` of income at retirement, or null when it can't be worked out. */
export function monthlyNeeded(invested: number, s: RetireSettings, thisYear: number, targetMonthly: number) {
  if (s.birthYear == null) return null;
  const need = Math.max(0, targetMonthly - s.otherMonthly) * 12 / (s.withdrawPct / 100); // the pot that pays the rest
  const base = projectRetirement(invested, { ...s, monthly: 0 }, thisYear);
  const one = projectRetirement(0, { ...s, monthly: 1 }, thisYear);
  if (!base || !one) return null;
  if (base.pot >= need) return 0;
  if (one.pot <= 0) return null; // no years left to save in
  return (need - base.pot) / one.pot;
}

// How far a year's return tends to land from the long-run figure, in points, for a mix of stocks and bonds.
// ponytail: one fixed swing for every portfolio; make it a setting if the mix of the accounts ever becomes known.
export const RETURN_SWING_PCT = 12;

// Share of a normal curve below z (Abramowitz and Stegun 7.1.26, good to about 1e-7).
function below(z: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

export type RetireChance = {
  chance: number; // 0 to 1: how likely the goal is met, given how much returns swing
  ratio: number; // projected income over the goal, at the chosen return
  neededPct: number | null; // the yearly return that just reaches the goal; null when no return in range does
};

/** A rough chance of reaching `goalMonthly` of income at retirement. It finds the yearly return that would just get
 * there, then asks how likely the average return over the years left is to be at least that, when one year's return
 * swings RETURN_SWING_PCT around the chosen figure. Over many years the average swings less (swing / sqrt(years)).
 * No dice are rolled, so the same inputs always give the same answer. */
export function retireChance(invested: number, s: RetireSettings, thisYear: number, goalMonthly = s.goalMonthly): RetireChance | null {
  const now = projectRetirement(invested, s, thisYear);
  if (!now || !(goalMonthly > 0)) return null;
  const ratio = now.monthlyIncome / goalMonthly;
  const income = (r: number) => projectRetirement(invested, s, thisYear, r)!.monthlyIncome;
  // No years left: it is met or it is not.
  if (now.years === 0) return { chance: ratio >= 1 ? 1 : 0, ratio, neededPct: null };
  let lo = -20, hi = 40;
  if (income(lo) >= goalMonthly) return { chance: 1, ratio, neededPct: null };
  if (income(hi) < goalMonthly) return { chance: 0, ratio, neededPct: null };
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (income(mid) >= goalMonthly) hi = mid;
    else lo = mid;
  }
  const spread = RETURN_SWING_PCT / Math.sqrt(now.years);
  return { chance: 1 - below((hi - s.returnPct) / spread), ratio, neededPct: hi };
}
