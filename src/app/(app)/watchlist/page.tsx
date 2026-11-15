import Link from "next/link";
import { getUser } from "@/lib/data";
import { FINVIZ_HOME, finvizQuote, finvizScreener, finvizTicker, onFinviz } from "@/lib/finviz";
import { money0 } from "@/lib/format";

type Holding = { id: string; name: string | null; ticker: string | null; type: string | null; quantity: number | null; value: number | null; cost_basis: number | null };
type Account = { id: string; name: string; custom_name: string | null; subtype: string | null; type: string; included: boolean; holdings: Holding[] };
type Item = { id: string; institution_name: string | null; accounts: Account[] };

// The stocks and ETFs you hold, each with a link to its Finviz page, and one link that opens them all in Finviz's
// screener. Chase accounts by default; ?from=all shows every linked brokerage. Prices here are the bank's, from the
// last sync. Finviz itself is never read: its charts and news open in your browser, signed in as you.
export default async function Watchlist({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const all = (await searchParams).from === "all";
  const { supabase } = await getUser();
  const { data } = await supabase
    .from("plaid_items")
    .select("id, institution_name, accounts(id, name, custom_name, subtype, type, included, holdings(id, name, ticker, type, quantity, value, cost_basis))")
    .order("created_at");
  const items = ((data ?? []) as unknown as Item[]).filter((i) => i.accounts.some((a) => a.type === "investment" && a.holdings.length));
  const isChase = (i: Item) => /chase|j\.?p\.? ?morgan/i.test(i.institution_name ?? "");
  const hasChase = items.some(isChase);
  const shown = all || !hasChase ? items : items.filter(isChase);

  // One row per ticker across the accounts shown, biggest first.
  const byTicker = new Map<string, { ticker: string; name: string; value: number; cost: number | null; quantity: number; where: Set<string> }>();
  let skipped = 0;
  for (const i of shown)
    for (const a of i.accounts) {
      if (a.type !== "investment") continue;
      for (const h of a.holdings) {
        if (!onFinviz(h)) {
          if (Number(h.value ?? 0) >= 1) skipped++;
          continue;
        }
        const t = finvizTicker(h.ticker!);
        const row = byTicker.get(t) ?? { ticker: t, name: h.name ?? t, value: 0, cost: null, quantity: 0, where: new Set<string>() };
        row.value += Number(h.value ?? 0);
        row.quantity += Number(h.quantity ?? 0);
        if (h.cost_basis != null) row.cost = (row.cost ?? 0) + Number(h.cost_basis);
        row.where.add(a.custom_name || a.name);
        byTicker.set(t, row);
      }
    }
  const rows = [...byTicker.values()].sort((a, b) => b.value - a.value);
  const tickers = rows.map((r) => r.ticker);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const link = "underline underline-offset-2 decoration-muted/60 hover:decoration-ink";

  if (!items.length)
    return (
      <div className="card p-8 max-w-xl space-y-3">
        <h2 className="text-xl font-semibold">No holdings yet</h2>
        <p className="text-sm text-muted">Link a brokerage account and the stocks and ETFs in it show here, each with a link to Finviz.</p>
        <Link href="/accounts/add" className="btn-primary inline-block">Add an account</Link>
      </div>
    );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {all || !hasChase ? "Stocks and ETFs in every linked brokerage account." : "Stocks and ETFs in your Chase investing accounts."}{" "}
          {hasChase && (all ? <Link href="/watchlist" className={link}>Show Chase only</Link> : <Link href="/watchlist?from=all" className={link}>Show every account</Link>)}
        </p>
        <div className="flex flex-wrap gap-2">
          {!!tickers.length && (
            <>
              <a href={finvizScreener(tickers)} target="_blank" rel="noopener noreferrer" className="btn-primary">Open all in Finviz</a>
              <a href={finvizScreener(tickers, "charts")} target="_blank" rel="noopener noreferrer" className="btn">Charts in Finviz</a>
            </>
          )}
          <a href={FINVIZ_HOME} target="_blank" rel="noopener noreferrer" className="btn">Finviz home</a>
        </div>
      </div>

      {rows.length ? (
        <section className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-xs">
                <th className="font-normal text-left pl-5 md:pl-6 py-3">Ticker</th>
                <th className="font-normal text-left py-3">Name</th>
                <th className="font-normal text-right py-3">Value</th>
                <th className="font-normal text-right py-3 hidden @md:table-cell">Gain or loss</th>
                <th className="font-normal text-right pr-5 md:pr-6 py-3">Finviz</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const gain = r.cost == null ? null : r.value - r.cost;
                return (
                  <tr key={r.ticker} className="border-t border-line">
                    <td className="pl-5 md:pl-6 py-3 font-medium tabular">{r.ticker}</td>
                    <td className="py-3 min-w-0 max-w-[16rem] truncate" title={[...r.where].join(", ")}>{r.name}</td>
                    <td className="py-3 text-right tabular">{money0(r.value)}</td>
                    <td className={`py-3 text-right tabular hidden @md:table-cell ${gain != null && gain < 0 ? "text-bad" : ""}`}>{gain == null ? "" : `${gain < 0 ? "-" : "+"}${money0(Math.abs(gain))}`}</td>
                    <td className="pr-5 md:pr-6 py-3 text-right"><a href={finvizQuote(r.ticker)} target="_blank" rel="noopener noreferrer" className={link}>Open</a></td>
                  </tr>
                );
              })}
              <tr className="border-t border-line text-muted">
                <td className="pl-5 md:pl-6 py-3" colSpan={2}>{rows.length} {rows.length === 1 ? "holding" : "holdings"}</td>
                <td className="py-3 text-right tabular">{money0(total)}</td>
                <td className="hidden @md:table-cell" />
                <td />
              </tr>
            </tbody>
          </table>
        </section>
      ) : (
        <p className="text-sm text-muted">Nothing here has a Finviz page. {hasChase && !all && <Link href="/watchlist?from=all" className={link}>Show every account</Link>}</p>
      )}

      <p className="text-xs text-muted">
        Values are from your bank at the last sync, and gain or loss is against the cost the bank reports. Finviz opens in a new tab: sign in there once and your browser keeps you signed in. broke does not sign in to Finviz, store its password or read its pages.
        {skipped > 0 && ` ${skipped} ${skipped === 1 ? "holding is" : "holdings are"} left out: mutual funds, money market funds, CDs and cash have no Finviz page.`} Not financial advice.
      </p>
    </div>
  );
}
