import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyFinancialValues,
  validFinancialValues,
  amountToCents,
  amountInputValue,
  validFinancialWeek,
  prepareFinancialDays,
  emptyFinancialDays,
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

test("Daily financial totals preserve blank columns, zero, costs and losses", () => {
  const rows = emptyFinancialDays();
  rows[0].totalSaleCents = 12345; rows[1].totalSaleCents = 100;
  rows[0].costCents = 250; rows[1].costCents = 0;
  rows[0].profitLossCents = -100;
  const result = prepareFinancialDays(rows);
  assert.equal(result.values.totalSaleCents, 12445);
  assert.equal(result.values.costCents, 250);
  assert.equal(result.daily[1].costCents, 0);
  assert.equal(result.daily[2].costCents, null);
  assert.equal(result.values.rentCents, null);
  assert.equal(result.values.profitLossCents, -100);
  assert.equal(prepareFinancialDays(emptyFinancialDays()).values.totalSaleCents, null);
});
test("Daily finances reject malformed days, negative costs and aggregate overflow", () => {
  const rows = emptyFinancialDays();
  rows[0].costCents = -1; assert.throws(() => prepareFinancialDays(rows));
  rows[0].costCents = 1.5; assert.throws(() => prepareFinancialDays(rows));
  rows[0].costCents = 100000000000; rows[1].costCents = 1;
  assert.throws(() => prepareFinancialDays(rows));
  assert.throws(() => prepareFinancialDays(rows.slice(1)));
  assert.throws(() => prepareFinancialDays(emptyFinancialDays().map(row => ({ ...row, day: 0 }))));
});
