// Run: node src/lib/bank-name.test.ts
import assert from "node:assert/strict";
import { shortBank } from "./bank-name.ts";

assert.equal(shortBank("Edward Jones - U.S. Clients Access"), "Edward Jones");
assert.equal(shortBank("Home Depot Credit Card - Personal Credit Card"), "Home Depot");
assert.equal(shortBank("Best Buy - Citi Card"), "Best Buy");
assert.equal(shortBank("Citibank Online"), "Citi");
assert.equal(shortBank("Lakeside Bank of Ohio"), "Lakeside Bank");
assert.equal(shortBank("First Community Bank of New Mexico"), "First Community Bank");
assert.equal(shortBank("Chase"), "Chase");
assert.equal(shortBank("Bank of America"), "Bank of America");
assert.equal(shortBank("Capital One"), "Capital One");
assert.equal(shortBank("Empower"), "Empower");
assert.equal(shortBank("American Express"), "American Express");
assert.equal(shortBank("Added by you"), "Added by you");
assert.equal(shortBank(null), "Bank");
assert.equal(shortBank("  ", "this bank"), "this bank");
console.log("bank-name: ok");
