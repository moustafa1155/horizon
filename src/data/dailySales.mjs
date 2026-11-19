import { toCents } from "../views/admin/weeklySalesReports/salesHelpers.mjs";
export const SALES_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export function prepareDailySales(rows) {
  if (!Array.isArray(rows) || rows.length !== 7) throw Error("Enter one row for every day of the week.");
  let entered = false, cardCents = 0, cashCents = 0, costCents = null;
  const daily = rows.map((row, day) => {
    if (!row || row.day !== day) throw Error("Days must run from Monday to Sunday without duplicates.");
    const result = { day, label: SALES_DAYS[day] };
    for (const key of ["card", "cash", "cost"]) {
      const value = row[key];
      if (value === null || value === "" || (key === "cost" && value === undefined)) result[key + "Cents"] = null;
      else {
        if (!["string", "number"].includes(typeof value) || toCents(value) === null) throw Error("Enter non-negative amounts with up to two decimal places.");
        result[key + "Cents"] = toCents(value);
        entered = true;
      }
    }
    cardCents += result.cardCents || 0;
    cashCents += result.cashCents || 0;
    if (result.costCents !== null) costCents = (costCents || 0) + result.costCents;
    return result;
  });
  if (!entered) throw Error("Enter sales or costs for at least one day before saving.");
  if (cardCents > 100000000000 || cashCents > 100000000000 || costCents > 100000000000) throw Error("Weekly card, cash and cost totals must each be no more than £1 billion.");
  return { daily, cardCents, cashCents, costCents };
}
