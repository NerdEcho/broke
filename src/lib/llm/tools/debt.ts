import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { payoff } from "@/lib/debt";
import type { Tool } from "@/lib/llm/shared";

const tool = <S extends z.ZodObject>(t: { name: string; description: string; schema: S; run: (input: z.infer<S>) => Promise<string> }) => t as unknown as Tool;
const r2 = (n: number) => Math.round(n * 100) / 100;

// One payoff, worked out in code so a model never does interest arithmetic itself.
function line(balance: number, apr: number, payment: number) {
  const p = payoff(balance, apr, payment);
  if (!p) return null;
  return p.never ? { never_paid_off: true, why: "The payment doesn't cover the monthly interest." } : { payoff_months: p.months, interest_still_to_pay: r2(p.interest) };
}

// Debts with the rate and payment the user saved on the Debt page, and a payoff calculator.
export function debtTools(supabase: SupabaseClient, userId: string): Tool[] {
  return [
    tool({
      name: "list_debts",
      description: "Every card and loan the user owes on: balance, the interest rate (APR) and monthly payment they saved on the Debt page, and the payoff at that payment. apr_rate_pct or monthly_payment is null when the user has not saved one: ask for it, never assume a rate or a payment. highest_rate is the debt with the highest saved rate.",
      schema: z.object({}),
      run: async () => {
        const { data } = await supabase.from("accounts").select("name, custom_name, type, subtype, balance:home_balance, apr, debt_payment, included").eq("user_id", userId).in("type", ["credit", "loan"]);
        const debts = ((data ?? []) as { name: string; custom_name: string | null; type: string; subtype: string | null; balance: number | null; apr: number | null; debt_payment: number | null; included: boolean }[])
          .map((a) => ({ ...a, owed: Math.abs(Number(a.balance ?? 0)) }))
          .filter((a) => a.owed >= 1)
          .sort((a, b) => b.owed - a.owed)
          .map((a) => ({
            account: a.custom_name || a.name,
            kind: a.type === "credit" ? "credit card" : a.subtype ?? "loan",
            balance: r2(a.owed),
            apr_rate_pct: a.apr == null ? null : Number(a.apr),
            monthly_payment: a.debt_payment == null ? null : Number(a.debt_payment),
            at_this_payment: a.apr != null && a.debt_payment ? line(a.owed, Number(a.apr), Number(a.debt_payment)) : null,
          }));
        const rated = debts.filter((d) => d.apr_rate_pct != null).sort((a, b) => b.apr_rate_pct! - a.apr_rate_pct!);
        return JSON.stringify({
          debts,
          highest_rate: rated[0] ? { account: rated[0].account, apr_rate_pct: rated[0].apr_rate_pct } : null,
          rates_missing_count: debts.length - rated.length,
          note: debts.length ? "Rates and payments are the ones the user typed on the Debt page (/debt). Where one is null, ask the user for it." : "No cards or loans with a balance.",
        });
      },
    }),
    tool({
      name: "debt_payoff",
      description: "Works out how long a debt takes to pay off and how much interest it costs, month by month. Use it for every payoff, interest or 'how much sooner' question: never do this arithmetic yourself. Give the balance, the APR and the monthly payment; extra_monthly adds a second result with that much more paid each month, and the months and interest saved.",
      schema: z.object({
        balance: z.number().positive().describe("What is owed today"),
        apr: z.number().min(0).max(100).describe("Yearly interest rate in percent, e.g. 24.99"),
        monthly_payment: z.number().positive().describe("What is paid each month now"),
        extra_monthly: z.number().min(0).optional().describe("Extra paid each month on top, to compare"),
      }),
      run: async ({ balance, apr, monthly_payment, extra_monthly }) => {
        const now = line(balance, apr, monthly_payment);
        const out: Record<string, unknown> = { balance: r2(balance), apr_rate_pct: apr, monthly_payment: r2(monthly_payment), at_this_payment: now };
        if (extra_monthly && extra_monthly > 0) {
          const a = payoff(balance, apr, monthly_payment), b = payoff(balance, apr, monthly_payment + extra_monthly);
          out.with_extra = { monthly_payment: r2(monthly_payment + extra_monthly), ...line(balance, apr, monthly_payment + extra_monthly) };
          if (a && b && !a.never && !b.never) out.saved = { months_sooner: a.months - b.months, interest_saved: r2(a.interest - b.interest) };
        }
        return JSON.stringify(out);
      },
    }),
  ];
}
