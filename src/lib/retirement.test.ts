// Run: node src/lib/retirement.test.ts
import assert from "node:assert/strict";
import { monthlyNeeded, projectRetirement, retireChance, retireRange, retireSettings, RETIRE_DEFAULTS } from "./retirement.ts";

const Y = 2026;
// Nothing saved: the defaults, and no projection without a birth year.
const d = retireSettings(null, Y);
assert.equal(d.retireAge, 65);
assert.equal(d.birthYear, null);
assert.equal(projectRetirement(100_000, d, Y), null);

// Out-of-range and text values are tidied.
const s = retireSettings({ birthYear: "1986", retireAge: 200, monthly: -5, returnPct: "7", inflationPct: 2, withdrawPct: 4, otherMonthly: 2000 }, Y);
assert.deepEqual([s.birthYear, s.retireAge, s.monthly, s.returnPct], [1986, 80, 0, 7]);

// No growth, no inflation: the pot is what is there plus what goes in.
const flat = { ...RETIRE_DEFAULTS, birthYear: 1986, returnPct: 0, inflationPct: 0, monthly: 1000 };
const r = projectRetirement(100_000, flat, Y)!;
assert.equal(r.years, 25);
assert.equal(Math.round(r.pot), 100_000 + 1000 * 12 * 25);
assert.equal(Math.round(r.growth), 0);
assert.equal(r.series.length, 26);
assert.equal(Math.round(r.fromPot), Math.round((400_000 * 0.04) / 12));

// Return equal to inflation is also flat in today's money.
const even = projectRetirement(100_000, { ...flat, returnPct: 3, inflationPct: 3 }, Y)!;
assert.equal(Math.round(even.pot), 400_000);

// Growth compounds: 10 years at a real 5% roughly turns 100 into 163.
const g = projectRetirement(100, { ...RETIRE_DEFAULTS, birthYear: Y - 55, returnPct: 5, inflationPct: 0 }, Y)!;
assert.ok(Math.abs(g.pot - 162.89) < 0.01, String(g.pot));

// Already past the retirement age: nothing more is added.
const past = projectRetirement(50_000, { ...flat, birthYear: Y - 70 }, Y)!;
assert.equal(past.years, 0);
assert.equal(past.pot, 50_000);

// Low is below expected is below high.
const range = retireRange(100_000, { ...RETIRE_DEFAULTS, birthYear: 1986, monthly: 500 }, Y)!;
assert.ok(range.low.pot < range.expected.pot && range.expected.pot < range.high.pot);

// The monthly amount that hits a target reproduces the target.
const base = { ...RETIRE_DEFAULTS, birthYear: 1986, otherMonthly: 2000 };
const need = monthlyNeeded(100_000, base, Y, 6000)!;
const check = projectRetirement(100_000, { ...base, monthly: need }, Y)!;
assert.ok(Math.abs(check.monthlyIncome - 6000) < 1, String(check.monthlyIncome));
assert.equal(monthlyNeeded(5_000_000, base, Y, 6000), 0);

// The chance of a goal: none without a goal, a coin toss when the goal is exactly the projection, and it falls as the goal rises.
assert.equal(d.goalMonthly, 0);
assert.equal(retireChance(100_000, base, Y), null);
const on = projectRetirement(100_000, { ...base, monthly: 500 }, Y)!.monthlyIncome;
const fifty = retireChance(100_000, { ...base, monthly: 500 }, Y, on)!;
assert.ok(Math.abs(fifty.chance - 0.5) < 0.001, String(fifty.chance));
assert.ok(Math.abs(fifty.ratio - 1) < 1e-9 && Math.abs(fifty.neededPct! - base.returnPct) < 0.001);
const easy = retireChance(100_000, { ...base, monthly: 500 }, Y, on * 0.8)!, hard = retireChance(100_000, { ...base, monthly: 500 }, Y, on * 1.5)!;
assert.ok(easy.chance > 0.5 && hard.chance < 0.5 && hard.chance > 0 && easy.chance < 1);
// Other income alone covers it: certain. Nothing could: none.
assert.equal(retireChance(0, base, Y, 1500)!.chance, 1);
assert.equal(retireChance(1, { ...base, otherMonthly: 0 }, Y, 1e9)!.chance, 0);
// At the retirement age already: met or not.
assert.equal(retireChance(3_000_000, { ...base, birthYear: Y - 70 }, Y, 6000)!.chance, 1);
assert.equal(retireChance(10_000, { ...base, birthYear: Y - 70 }, Y, 6000)!.chance, 0);

console.log("retirement: ok");
