import test from "node:test";
import assert from "node:assert/strict";
import { prepareDailySales } from "../src/data/dailySales.mjs";
const blank = () => Array.from({ length: 7 }, (_, day) => ({ day, card: "", cash: "" }));
test("Daily sales retain empty days and calculate exact weekly pennies", () => {
  const rows = blank(); rows[0] = { day: 0, card: "12.30", cash: "0" }; rows[2].cash = "0.05";
  const result = prepareDailySales(rows);
  assert.equal(result.cardCents, 1230); assert.equal(result.cashCents, 5);
  assert.equal(result.daily[0].cashCents, 0); assert.equal(result.daily[1].cardCents, null);
});
test("Daily sales reject missing/duplicate days, negative or malformed amounts", () => {
  const rows = blank(); rows[0].card = "1";
  for (const value of [-1, "1.001", "NaN", true, {}, undefined]) { const bad = structuredClone(rows); bad[1].card = value; assert.throws(() => prepareDailySales(bad)); }
  assert.throws(() => prepareDailySales(rows.slice(1)));
  assert.throws(() => prepareDailySales(rows.map(row => ({ ...row, day: 0 }))));
  assert.throws(() => prepareDailySales(blank()));
});
test("Daily sales reject excessive aggregate weekly totals", () => {
  const rows = blank(); rows[0].card = "1000000000"; rows[1].card = "0.01";
  assert.throws(() => prepareDailySales(rows));
});

test("Daily costs are optional, preserve zero and do not change sales totals", () => {
  const rows = blank(); rows[0].card = "10"; rows[0].cost = "2.15"; rows[1].cost = "0";
  const result = prepareDailySales(rows);
  assert.equal(result.costCents, 215); assert.equal(result.cardCents + result.cashCents, 1000);
  assert.equal(result.daily[1].costCents, 0); assert.equal(result.daily[2].costCents, null);
  assert.equal(prepareDailySales(blank().map((row, day) => ({ ...row, cost: day === 0 ? "1.50" : "" }))).costCents, 150);
  rows[0].cost = "-1"; assert.throws(() => prepareDailySales(rows));
  rows[0].cost = "1.001"; assert.throws(() => prepareDailySales(rows));
  rows[0].cost = "1000000000"; rows[1].cost = "0.01"; assert.throws(() => prepareDailySales(rows));
  rows[0].cost = ""; rows[1].cost = ""; assert.equal(prepareDailySales(rows).costCents, null);
});
