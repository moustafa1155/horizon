import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const products = JSON.parse(readFileSync(new URL("../src/data/orderProducts.json", import.meta.url), "utf8"));
test("Order product catalog preserves every source item with no duplicate names", () => {
  assert.equal(products.length, 154);
  assert.equal(new Set(products.map(product => product.name.toLowerCase())).size, 154);
  for (const product of products) {
    assert.ok(product.name.length <= 160 && product.name.trim() === product.name);
    assert.match(product.source.cell, /^[AC]\d+$/);
    assert.equal(product.source.sheet, "Sheet1");
    assert.match(product.source.sha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(Object.values(products.reduce((counts, product) => { counts[product.category] = (counts[product.category] || 0) + 1; return counts; }, {})), [42, 41, 37, 34]);
});
