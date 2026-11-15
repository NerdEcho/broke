// Run: node src/lib/finviz.test.ts
import assert from "node:assert/strict";
import { finvizQuote, finvizScreener, finvizTicker, onFinviz } from "./finviz.ts";

assert.equal(finvizTicker("brk.b"), "BRK-B");
assert.equal(finvizTicker(" VOO "), "VOO");
assert.equal(onFinviz({ ticker: "AAPL", type: "equity" }), true);
assert.equal(onFinviz({ ticker: "VOO", type: "etf" }), true);
assert.equal(onFinviz({ ticker: "BRK.B", type: "equity" }), true);
assert.equal(onFinviz({ ticker: "PCOXX", type: "mutual fund" }), false); // money market fund
assert.equal(onFinviz({ ticker: "HGIFX", type: null }), false); // mutual fund by its ticker shape
assert.equal(onFinviz({ ticker: null, type: "cash" }), false);
assert.equal(onFinviz({ ticker: "CUR:USD", type: "cash" }), false);
assert.equal(onFinviz({ ticker: "KO", type: "fixed income" }), false);
assert.equal(finvizQuote("BRK.B"), "https://finviz.com/quote.ashx?t=BRK-B");
assert.equal(finvizScreener(["VOO", "aapl", "VOO", "BRK.B"]), "https://finviz.com/screener.ashx?v=111&t=VOO,AAPL,BRK-B");
assert.equal(finvizScreener(["KO"], "charts"), "https://finviz.com/screener.ashx?v=211&t=KO");
console.log("finviz: ok");
