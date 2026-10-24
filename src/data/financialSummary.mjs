export const FINANCIAL_FIELDS = [
  ["totalSaleCents", "Total Sale"],
  ["expensesCents", "Expenses"],
  ["goodsCents", "Goods"],
  ["rentCents", "Rent"],
  ["profitLossCents", "Profit and Loss"],
];
export const emptyFinancialValues = () =>
  Object.fromEntries(FINANCIAL_FIELDS.map(([key]) => [key, null]));
export function validFinancialWeek(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCDay() === 1 &&
    date.toISOString().slice(0, 10) === value
  );
}
export function validFinancialValues(values) {
  return (
    !!values &&
    typeof values === "object" &&
    !Array.isArray(values) &&
    FINANCIAL_FIELDS.every(
      ([key]) =>
        values[key] === null ||
        (Number.isSafeInteger(values[key]) &&
          Math.abs(values[key]) <= 100000000000 &&
          (key === "profitLossCents" || values[key] >= 0))
    )
  );
}
export function amountToCents(value, negative = false) {
  if (typeof value !== "string")
    throw Error("Enter an amount with up to two decimal places.");
  const text = value.trim();
  if (!text) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(text))
    throw Error("Enter an amount with up to two decimal places.");
  const sign = text.startsWith("-") ? -1 : 1;
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  const result = sign * (Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
  if (
    !Number.isSafeInteger(result) ||
    Math.abs(result) > 100000000000 ||
    (!negative && result < 0)
  )
    throw Error("Enter a valid amount (maximum £1 billion).");
  return result;
}
export const amountInputValue = (value) =>
  value === null || value === undefined ? "" : (value / 100).toFixed(2);
