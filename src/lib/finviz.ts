// Links to Finviz for a holding. Links only: broke never signs in to Finviz or reads its pages, so there is no
// password to store and nothing that breaks its terms. Open them in a browser where you are signed in to Finviz.
// Pure, so `node src/lib/finviz.test.ts` runs it.

/** Finviz writes share classes with a dash (BRK-B), banks and Plaid with a dot or a slash (BRK.B, BRK/B). */
export const finvizTicker = (ticker: string) => ticker.trim().toUpperCase().replace(/[./ ]/g, "-");

/** Stocks and ETFs have a Finviz page. Mutual funds, money market funds, CDs, bonds and cash do not. */
export function onFinviz(h: { ticker: string | null; type: string | null }) {
  const t = (h.ticker ?? "").trim();
  if (!/^[A-Za-z]{1,5}([./-][A-Za-z]{1,2})?$/.test(t)) return false;
  if (/^[A-Za-z]{5}$/.test(t) && /X$/i.test(t)) return false; // five letters ending in X: a mutual or money market fund
  return h.type == null || /equity|etf|stock/i.test(h.type);
}

/** The Finviz front page: market map, movers and news. */
export const FINVIZ_HOME = "https://finviz.com/";
export const finvizQuote = (ticker: string) => `https://finviz.com/quote.ashx?t=${encodeURIComponent(finvizTicker(ticker))}`;
/** One Finviz screener page for a list of tickers: v=111 is the overview table, v=211 the charts. */
export const finvizScreener = (tickers: string[], view: "table" | "charts" = "table") =>
  `https://finviz.com/screener.ashx?v=${view === "charts" ? 211 : 111}&t=${[...new Set(tickers.map(finvizTicker))].map(encodeURIComponent).join(",")}`;
