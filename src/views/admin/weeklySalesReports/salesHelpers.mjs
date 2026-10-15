export const STORAGE_KEY = "horizon.weekly-sales.v1";
export const currency = "GBP";
export const formatMoney = (cents) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    cents / 100
  );

export function toCents(value) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, decimal = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= 100000000000 ? cents : null;
}

export function validateReport(draft, branches, reports) {
  if (!branches.includes(draft.branch)) return "Select a valid branch.";
  if (!draft.manager.trim()) return "Enter the branch manager's name.";
  const date = new Date(`${draft.week}T12:00:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.week) ||
    Number.isNaN(date.getTime()) ||
    date.getDay() !== 1 ||
    date.toISOString().slice(0, 10) !== draft.week
  )
    return "Choose a Monday for the week beginning.";
  if (toCents(draft.card) === null || toCents(draft.cash) === null)
    return "Enter non-negative card and cash amounts with no more than two decimal places (maximum £1 billion each).";
  if (
    reports.some(
      (report) => report.branch === draft.branch && report.week === draft.week
    )
  )
    return "This branch already has a sales report for that week.";
  return "";
}

export function totals(reports) {
  return reports.reduce(
    (sum, report) => ({
      card: sum.card + report.cardCents,
      cash: sum.cash + report.cashCents,
      total: sum.total + report.cardCents + report.cashCents,
    }),
    { card: 0, cash: 0, total: 0 }
  );
}

export function loadReports(storage) {
  const reports = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
  if (
    !Array.isArray(reports) ||
    reports.some(
      (report) =>
        !report ||
        typeof report.id !== "string" ||
        typeof report.branch !== "string" ||
        typeof report.manager !== "string" ||
        typeof report.week !== "string" ||
        ![report.cardCents, report.cashCents].every(
          (amount) =>
            Number.isSafeInteger(amount) &&
            amount >= 0 &&
            amount <= 100000000000
        )
    )
  )
    throw new Error("Invalid saved sales reports");
  return reports;
}
