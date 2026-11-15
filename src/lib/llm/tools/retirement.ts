import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Tool } from "@/lib/llm/shared";
import { monthlyNeeded, retireRange } from "@/lib/retirement";
import { retirementInputs } from "@/lib/retirement-data";

const tool = <S extends z.ZodObject>(t: { name: string; description: string; schema: S; run: (input: z.infer<S>) => Promise<string> }) => t as unknown as Tool;
const r0 = (n: number) => Math.round(n);

// The Retirement page's projection, so broke ai answers "am I on track?" with the same maths the page shows.
export function retirementTools(supabase: SupabaseClient, userId: string): Tool[] {
  return [
    tool({
      name: "retirement_projection",
      description: "Projects the user's investment accounts to their retirement age, in today's money, with the settings saved on the Retirement page (/retirement): monthly contribution, return, inflation, withdrawal rate and other income such as Social Security. Use it for every retirement question; never do this arithmetic yourself. target_monthly_income adds the monthly contribution that would reach that income. It is a projection from assumptions, not a forecast: say so, and name the assumptions.",
      schema: z.object({ target_monthly_income: z.number().positive().optional().describe("A monthly income in retirement to aim for, in today's money") }),
      run: async ({ target_monthly_income }) => {
        const { data: { user } } = await supabase.auth.getUser();
        const { invested, settings: s, thisYear } = await retirementInputs(supabase, userId, user?.user_metadata);
        if (s.birthYear == null) return JSON.stringify({ note: "The user has not set their birth year on the Retirement page (/retirement), so there is nothing to project yet. Send them there." });
        const range = retireRange(invested, s, thisYear)!;
        const e = range.expected;
        const out: Record<string, unknown> = {
          assumed: { age_years: thisYear - s.birthYear, retire_age_years: s.retireAge, return_pct: s.returnPct, inflation_pct: s.inflationPct, withdraw_pct: s.withdrawPct, monthly_contribution: r0(s.monthly), other_monthly_income: r0(s.otherMonthly) },
          invested_today: r0(invested),
          years_until_retirement: e.years,
          at_retirement_in_todays_money: { pot: r0(e.pot), of_which_growth: r0(e.growth), monthly_income: r0(e.monthlyIncome), monthly_income_from_pot: r0(e.fromPot) },
          if_returns_are_lower: { return_pct: range.lowPct, pot: r0(range.low.pot), monthly_income: r0(range.low.monthlyIncome) },
          if_returns_are_higher: { return_pct: range.highPct, pot: r0(range.high.pot), monthly_income: r0(range.high.monthlyIncome) },
          note: "A home is not counted. Returns are assumptions and are not guaranteed. The user can change every assumption on /retirement.",
        };
        if (target_monthly_income) {
          const need = monthlyNeeded(invested, s, thisYear, target_monthly_income);
          out.to_reach_target = need == null ? { note: "No years left to save in." } : { target_monthly_income: r0(target_monthly_income), monthly_contribution_needed: r0(need), more_than_now: r0(Math.max(0, need - s.monthly)) };
        }
        return JSON.stringify(out);
      },
    }),
  ];
}
