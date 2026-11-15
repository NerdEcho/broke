import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountToggle } from "@/components/AccountToggle";
import { APART, isApart } from "@/lib/apart";
import { shortBank } from "@/lib/bank-name";
import { getUser } from "@/lib/data";
import { dateLabel, money, money0, plural } from "@/lib/format";

type Holding = { id: string; name: string | null; ticker: string | null; type: string | null; value: number | null; cost_basis: number | null };
type Account = { id: string; name: string; custom_name: string | null; mask: string | null; type: string; subtype: string | null; current_balance: number | null; currency: string | null; home: number | null; included: boolean; holdings: Holding[] };
type Item = { id: string; institution_name: string | null; accounts: Account[] };
type Txn = { id: string; date: string; name: string; merchant_name: string | null; custom_name: string | null; amount: number; currency: string | null; account_id: string };

const KIND: Record<string, string> = { savings: "Savings", checking: "Checking", brokerage: "Brokerage", "529": "529 plan", ugma: "Custodial", utma: "Custodial", ira: "IRA", roth: "Roth IRA" };

// The accounts held for one person, by the name on the account: what is there, what it holds and what moved lately.
// They show here whether or not they are counted in your own totals; the switch on each row decides that.
export default async function Apart() {
  if (!APART) notFound();
  const who = APART.name;
  const { supabase } = await getUser();
  const { data } = await supabase
    .from("plaid_items")
    .select("id, institution_name, accounts(id, name, custom_name, mask, type, subtype, current_balance, currency, home:home_balance, included, holdings(id, name, ticker, type, value, cost_basis))")
    .order("created_at");
  const accounts = ((data ?? []) as unknown as Item[]).flatMap((i) => i.accounts.filter(isApart).map((a) => ({ ...a, bank: shortBank(i.institution_name, "") })));
  const ids = accounts.map((a) => a.id);
  const { data: recent } = ids.length
    ? await supabase.from("transactions").select("id, date, name, merchant_name, custom_name, amount, currency, account_id").in("account_id", ids).order("date", { ascending: false }).order("id").limit(12)
    : { data: [] };
  const txns = (recent ?? []) as Txn[];
  const total = accounts.reduce((s, a) => s + Number(a.home ?? a.current_balance ?? 0), 0);
  const counted = accounts.filter((a) => a.included);
  const nameOf = new Map(accounts.map((a) => [a.id, a.custom_name || a.name]));

  if (!accounts.length)
    return (
      <div className="card p-8 max-w-xl space-y-3">
        <h2 className="text-xl font-semibold">No accounts for {who} yet</h2>
        <p className="text-sm text-muted">An account shows here when its name has &quot;{who}&quot; in it. Rename one with the pencil on the <Link href="/accounts" className="underline underline-offset-2">Accounts</Link> page.</p>
      </div>
    );

  return (
    <div className="space-y-6 max-w-4xl">
      <section className="card grid grid-cols-1 @md:grid-cols-2 divide-y @md:divide-y-0 @md:divide-x divide-line">
        <div className="px-6 py-4 @md:py-6">
          <div className="section-label">{who}&apos;s money</div>
          <div className="text-2xl font-semibold tracking-[-0.02em] tabular mt-1">{money0(total)}</div>
          <div className="text-xs text-muted mt-1">Across {plural(accounts.length, "account")}</div>
        </div>
        <div className="px-6 py-4 @md:py-6">
          <div className="section-label">In your own totals</div>
          <div className="text-2xl font-semibold tracking-[-0.02em] mt-1">{counted.length ? `${counted.length} of ${accounts.length} counted` : "Kept apart"}</div>
          <div className="text-xs text-muted mt-1">{counted.length ? "Switch an account off below to leave it out of your net worth, savings and retirement numbers." : "None of this is in your net worth, savings or retirement numbers."}</div>
        </div>
      </section>

      <section className="card overflow-hidden">
        {accounts.map((a) => (
          <div key={a.id} className="border-b border-line last:border-0">
            <div className="flex items-center gap-3 px-6 py-4">
              <span className="flex-1 min-w-0">
                <span className="block font-medium truncate">{a.custom_name || a.name}{a.mask ? <span className="text-muted"> ··{a.mask}</span> : null}</span>
                <span className="block text-sm text-muted truncate">{[a.bank, KIND[a.subtype ?? ""] ?? (a.type === "investment" ? "Investments" : a.type === "depository" ? "Cash" : a.type)].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="tabular font-medium">{money(a.current_balance, a.currency)}</span>
              <AccountToggle id={a.id} included={a.included} name={a.custom_name || a.name} />
            </div>
            {!!a.holdings?.length && (
              <details className="group">
                <summary className="px-6 pb-3 text-xs text-muted cursor-pointer select-none hover:text-ink">
                  <span className="group-open:hidden">Show {plural(a.holdings.length, "holding")}</span>
                  <span className="hidden group-open:inline">Hide {plural(a.holdings.length, "holding")}</span>
                </summary>
                <ul className="px-6 pb-3 space-y-2">
                  {[...a.holdings].sort((x, y) => Number(y.value ?? 0) - Number(x.value ?? 0)).map((h) => (
                    <li key={h.id} className="flex items-baseline gap-3 text-sm">
                      <span className="w-14 shrink-0 text-xs font-medium tabular text-muted truncate">{h.ticker ?? ""}</span>
                      <span className="flex-1 min-w-0 truncate">{h.name ?? "Cash"}</span>
                      <span className="shrink-0 text-right tabular">{money(h.value, a.currency)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </section>

      <section className="card overflow-hidden">
        <div className="px-6 pt-5 pb-2 text-sm text-muted">Latest activity</div>
        {txns.length ? (
          <ul>
            {txns.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-6 py-3 border-t border-line text-sm">
                <span className="w-16 shrink-0 text-muted tabular">{dateLabel(t.date, { month: "short", day: "numeric" })}</span>
                <span className="flex-1 min-w-0 truncate">{t.custom_name || t.merchant_name || t.name}<span className="text-muted"> · {nameOf.get(t.account_id)}</span></span>
                <span className={`shrink-0 tabular font-medium ${t.amount < 0 ? "text-good" : ""}`}>{t.amount < 0 ? "+" : ""}{money(Math.abs(t.amount), t.currency)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="px-6 pb-5 text-sm text-muted">Nothing has moved in these accounts yet.</p>}
      </section>

      <p className="text-xs text-muted">Accounts with &quot;{who}&quot; in their name. The switch on each one is the same as on the Accounts page: off keeps it out of your totals, and it still shows here.</p>
    </div>
  );
}
