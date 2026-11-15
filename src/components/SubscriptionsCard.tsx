import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Merchant } from "@/components/Merchant";
import { FREQ_PER_MONTH, money0 } from "@/lib/format";
import { bankEvent } from "@/lib/privacy";

type Row = { id: string; merchant_name: string; logo_url: string | null; frequency: string | null; average_amount: number | null; category: { key: string; label: string } | null };
// Rent, utilities and loan payments are bills, not subscriptions; interest, fees and transfers are bank events.
const BILL_KEYS = ["RENT_AND_UTILITIES", "LOAN_PAYMENTS"];

// Home's glance at subscriptions: what repeats, what it comes to a month and a year, biggest first.
// The full list, with cancel links and price rises, is the Recurring tab.
export async function SubscriptionsCard({ supabase, uid, show = 6 }: { supabase: SupabaseClient; uid: string; show?: number }) {
  const { data } = await supabase
    .from("recurring")
    .select("id, merchant_name, logo_url, frequency, average_amount:home_average, category:categories(key, label)")
    .eq("user_id", uid).eq("active", true).eq("is_income", false).neq("status", "TOMBSTONED");
  const subs = ((data ?? []) as unknown as Row[])
    .filter((r) => !BILL_KEYS.includes(r.category?.key ?? "") && !bankEvent(r.merchant_name, r.category?.label))
    .map((r) => ({ ...r, monthly: Number(r.average_amount ?? 0) * (FREQ_PER_MONTH[r.frequency ?? ""] ?? 1) }))
    .filter((r) => r.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly);
  if (!subs.length) return null;
  const monthly = subs.reduce((s, r) => s + r.monthly, 0);
  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">Subscriptions</span>
        <Link href="/recurring" className="text-sm text-muted hover:text-ink">See all {subs.length}</Link>
      </div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-2xl font-semibold tracking-[-0.02em] tabular">{money0(monthly)}</span>
        <span className="text-sm text-muted">a month, about {money0(monthly * 12)} a year</span>
      </div>
      <ul className="space-y-2.5">
        {subs.slice(0, show).map((r) => (
          <li key={r.id} className="flex items-center gap-3 text-sm">
            <Merchant name={r.merchant_name} logo={r.logo_url} />
            <span className="flex-1 min-w-0 truncate">{r.merchant_name.replace(/\s*\(\s*\)\s*$/, "")}</span>
            <span className="tabular shrink-0 w-20 text-right">{money0(r.monthly)}<span className="text-muted"> /mo</span></span>
          </li>
        ))}
      </ul>
      {subs.length > show && <p className="text-xs text-muted">And {subs.length - show} more. Bills such as rent, utilities and loan payments are not counted here.</p>}
    </section>
  );
}
