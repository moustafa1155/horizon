import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyFinancialValues,
  validFinancialValues,
  amountToCents,
  amountInputValue,
  validFinancialWeek,
} from "../src/data/financialSummary.mjs";
test("Financial summaries preserve blanks and distinguish zero", () => {
  const empty = emptyFinancialValues();
  assert.equal(validFinancialValues(empty), true);
  assert.equal(
    Object.values(empty).every((v) => v === null),
    true
  );
  assert.equal(amountToCents(""), null);
  assert.equal(amountToCents("  "), null);
  assert.equal(amountToCents("0"), 0);
  assert.equal(amountInputValue(null), "");
  assert.equal(amountInputValue(0), "0.00");
});
test("Financial amounts are exact pennies and only profit/loss may be negative", () => {
  assert.equal(amountToCents("120.05"), 12005);
  assert.equal(amountToCents("-5.50", true), -550);
  assert.throws(() => amountToCents("-5.50"));
  for (const value of ["1.001", "1e3", "NaN", "Infinity", "1000000001"])
    assert.throws(() => amountToCents(value));
  assert.equal(
    validFinancialValues({ ...emptyFinancialValues(), profitLossCents: -550 }),
    true
  );
  for (const key of [
    "totalSaleCents",
    "expensesCents",
    "goodsCents",
    "rentCents",
  ])
    assert.equal(
      validFinancialValues({ ...emptyFinancialValues(), [key]: -1 }),
      false
    );
  assert.equal(
    validFinancialValues({ ...emptyFinancialValues(), totalSaleCents: 1.5 }),
    false
  );
});
test("Financial summaries require actual ISO Mondays", () => {
  assert.equal(validFinancialWeek("2025-12-29"), true);
  assert.equal(validFinancialWeek("2026-10-19"), true);
  for (const value of ["2026-10-20", "2026-02-30", "2026-99-12", null, "bad"])
    assert.equal(validFinancialWeek(value), false);
});
