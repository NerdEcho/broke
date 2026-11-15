import Link from "next/link";
import { GoalSphere } from "@/components/GoalSphere";
import { RetirementFields } from "@/components/RetirementFields";
import { getUser } from "@/lib/data";
import { money0 } from "@/lib/format";
import { monthlyNeeded, retireChance, retireRange, RETURN_SWING_PCT } from "@/lib/retirement";
import { retirementInputs } from "@/lib/retirement-data";

const KIND: Record<string, string> = { "401k": "401(k)", ira: "IRA", roth: "Roth IRA", brokerage: "Brokerage", "roth 401k": "Roth 401(k)", hsa: "HSA" };

// Where your investment accounts could be at the age you want to retire, in today's money. The numbers on this page
// and the ones broke ai gives (retirement_projection) come from the same function, src/lib/retirement.ts.
export default async function Retirement() {
  const { supabase, user } = await getUser();
  // The live record, not the sign-in token's copy: the token can be up to an hour behind, and the form below saves
  // every field at once, so a stale copy would both show old numbers and write them back.
  const { data: live } = await supabase.auth.getUser();
  const { accounts, invested, settings, thisYear } = await retirementInputs(supabase, user!.id, live.user?.user_metadata ?? user!.user_metadata);
  const range = retireRange(invested, settings, thisYear);
  const e = range?.expected ?? null;
  const top = e ? Math.max(...e.series.map((p) => p.pot), 1) : 1;
  // One bar every few years, always ending on the retirement year.
  const step = e && e.series.length > 14 ? Math.ceil(e.series.length / 12) : 1;
  const bars = e ? e.series.filter((_, i) => i % step === 0 || i === e.series.length - 1) : [];
  const age = settings.birthYear == null ? null : thisYear - settings.birthYear;
  // What it would take to replace today's assumptions with a round target: the pot's income plus 1,000 a month.
  const roundTarget = e ? Math.ceil((e.monthlyIncome + 1000) / 500) * 500 : null;
  // With a goal saved, the round target is the goal itself.
  const goal = settings.goalMonthly >= 1 ? settings.goalMonthly : null;
  const target = goal ?? roundTarget;
  const need = target != null ? monthlyNeeded(invested, settings, thisYear, target) : null;
  const odds = goal != null ? retireChance(invested, settings, thisYear) : null;
  // Shown between 1 and 99 unless it is certain either way: a model this rough should not print 0% or 100% lightly.
  const pct = odds ? (odds.neededPct == null ? Math.round(odds.chance * 100) : Math.min(99, Math.max(1, Math.round(odds.chance * 100)))) : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <p className="text-sm text-muted">
        A projection of your investment accounts to age {settings.retireAge}, in today&apos;s money. It moves when your balances do and when you change an assumption below.
      </p>

      {!e && (
        <section className="card p-5 md:p-6 space-y-2">
          <h2 className="text-lg font-semibold">Add the year you were born</h2>
          <p className="text-sm text-muted">That sets how many years are left until {settings.retireAge}. You have {money0(invested)} in investment accounts today.</p>
        </section>
      )}

      {e && range && (
        <>
          <section className="card p-5 md:p-6 flex flex-col @md:flex-row items-center gap-5 @md:gap-8">
            <GoalSphere pct={pct} label={odds ? `${pct}% likely to reach your retirement goal` : "No retirement goal set yet"} />
            {odds && goal != null ? (
              <div className="space-y-2 min-w-0 text-center @md:text-left">
                <div className="section-label">Your goal</div>
                <h2 className="text-2xl font-semibold tracking-[-0.02em]">{pct}% likely to reach it</h2>
                <p className="text-sm">
                  You want {money0(goal)} a month at {settings.retireAge}. You are on course for {money0(e.monthlyIncome)}, which is {Math.round(odds.ratio * 100)}% of it.
                  {odds.neededPct != null && e.years > 0 && ` Getting there takes about ${odds.neededPct.toFixed(1)}% a year; you assume ${settings.returnPct}%.`}
                </p>
                <p className="text-xs text-muted">
                  A rough estimate, not a forecast: it supposes one year&apos;s return can land about {RETURN_SWING_PCT} points either side of your figure. Putting in more, retiring later or a lower goal all fill the ball.
                </p>
              </div>
            ) : (
              <div className="space-y-2 min-w-0 text-center @md:text-left">
                <div className="section-label">Your goal</div>
                <h2 className="text-xl font-semibold">Set the income you want</h2>
                <p className="text-sm text-muted">Enter &quot;Income you want a month in retirement&quot; under Your assumptions, and this fills with how likely you are to reach it.</p>
              </div>
            )}
          </section>

          <section className="card grid grid-cols-1 @md:grid-cols-3 divide-y @md:divide-y-0 @md:divide-x divide-line">
            {[
              ["Invested today", money0(invested), age != null ? `Age ${age}` : ""],
              [`At ${settings.retireAge}`, money0(e.pot), e.years ? `In ${e.years} ${e.years === 1 ? "year" : "years"}, at ${settings.returnPct}% a year` : "You are at this age now"],
              ["Income a month", money0(e.monthlyIncome), settings.otherMonthly >= 1 ? `${money0(e.fromPot)} from investments, ${money0(settings.otherMonthly)} other` : `Taking ${settings.withdrawPct}% a year`],
            ].map(([label, value, sub]) => (
              <div key={label} className="px-6 py-4 @md:py-6">
                <div className="section-label">{label}</div>
                <div className="text-2xl font-semibold tracking-[-0.02em] tabular mt-1">{value}</div>
                {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
              </div>
            ))}
          </section>

          {e.years > 0 && (
            <section className="card p-5 md:p-6 space-y-4">
              <div className="section-label">Year by year</div>
              <div className="flex items-end gap-1.5 h-40" role="img" aria-label={`Projected balance from ${money0(invested)} today to ${money0(e.pot)} at ${settings.retireAge}`}>
                {bars.map((p) => (
                  <div key={p.year} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1" title={`Age ${p.age} (${p.year}): ${money0(p.pot)}`}>
                    <div className="w-full rounded-t-md bg-ink/70" style={{ height: `${Math.max(2, (p.pot / top) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 text-[11px] text-muted tabular">
                {bars.map((p) => <div key={p.year} className="flex-1 min-w-0 text-center truncate">{p.age}</div>)}
              </div>
              <p className="text-sm text-muted">
                Of {money0(e.pot)}, about {money0(Math.max(0, e.growth))} is growth and {money0(e.contributed)} is what you have today plus what you put in.
              </p>
            </section>
          )}

          <section className="card overflow-hidden">
            <div className="px-5 md:px-6 pt-5 section-label">If returns differ</div>
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="text-muted text-xs">
                  <th className="font-normal text-left pl-5 md:pl-6 pb-2">Return a year</th>
                  <th className="font-normal text-right pb-2">At {settings.retireAge}</th>
                  <th className="font-normal text-right pr-5 md:pr-6 pb-2">Income a month</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {[
                  [`${range.lowPct}% (lower)`, range.low],
                  [`${settings.returnPct}% (yours)`, range.expected],
                  [`${range.highPct}% (higher)`, range.high],
                ].map(([label, r]) => (
                  <tr key={label as string} className="border-t border-line">
                    <td className="pl-5 md:pl-6 py-3">{label as string}</td>
                    <td className="text-right py-3">{money0((r as typeof e).pot)}</td>
                    <td className="text-right pr-5 md:pr-6 py-3">{money0((r as typeof e).monthlyIncome)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {target != null && need != null && e.years > 0 && (
            <p className="text-sm">
              To have {money0(target)} a month at {settings.retireAge}, you would put in about <span className="font-medium">{money0(need)}</span> a month
              {need > settings.monthly ? `, ${money0(need - settings.monthly)} more than now.` : ", which you already do."}
            </p>
          )}
        </>
      )}

      <section className="card p-5 md:p-6 space-y-4">
        <div className="section-label">Your assumptions</div>
        <RetirementFields settings={settings} />
      </section>

      <section className="card p-5 md:p-6 space-y-3">
        <div className="section-label">What is counted</div>
        {accounts.length ? (
          <ul className="text-sm divide-y divide-line">
            {accounts.map((a) => (
              <li key={a.name + a.balance} className="flex justify-between gap-4 py-2">
                <span className="min-w-0 truncate">{a.name}<span className="text-muted"> · {KIND[a.subtype ?? ""] ?? "Investment"}</span></span>
                <span className="tabular shrink-0">{money0(a.balance)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No investment accounts are linked yet.</p>
        )}
        <p className="text-xs text-muted">
          Investment accounts that are switched on in <Link href="/accounts" className="underline underline-offset-2">Accounts</Link>. Switch one off there to leave it out, such as an account held for a child. Cash, a home and debts are not counted.
        </p>
      </section>

      <p className="text-xs text-muted">
        A projection from the assumptions above, not a forecast. Returns are not guaranteed, taxes on withdrawals are not taken off, and it assumes you keep putting in the same amount, raised with inflation. Not financial advice.
      </p>
    </div>
  );
}
