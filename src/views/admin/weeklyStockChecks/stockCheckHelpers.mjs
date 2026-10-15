export const STORAGE_KEY = "horizon.weekly-stock-checks.v1";

export function currentWeek() {
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export function validateStockCheck(check, branches, checks) {
  if (!branches.includes(check.branch)) return "Select a valid branch.";
  if (!check.employee.trim()) return "Enter the employee's name.";
  const date = new Date(`${check.week}T12:00:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(check.week) ||
    Number.isNaN(date.getTime()) ||
    date.getDay() !== 1 ||
    date.toISOString().slice(0, 10) !== check.week
  )
    return "Choose a Monday as the start of the stock check week.";
  if (
    !check.items.length ||
    check.items.some(
      (item) =>
        !item.product.trim() ||
        !Number.isSafeInteger(Number(item.quantity)) ||
        Number(item.quantity) < 0 ||
        String(item.quantity).trim() === ""
    )
  )
    return "Each product needs a name and a non-negative whole-number stock count.";
  const names = check.items.map((item) => item.product.trim().toLowerCase());
  if (new Set(names).size !== names.length)
    return "Combine duplicate products into one check line.";
  if (
    checks.some(
      (existing) =>
        existing.branch === check.branch && existing.week === check.week
    )
  )
    return "This branch already has a stock check for that week.";
  return "";
}

export function loadStockChecks(storage) {
  const checks = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
  if (
    !Array.isArray(checks) ||
    checks.some(
      (check) =>
        !check ||
        typeof check.id !== "string" ||
        typeof check.branch !== "string" ||
        typeof check.employee !== "string" ||
        typeof check.week !== "string" ||
        !Array.isArray(check.items) ||
        check.items.some(
          (item) =>
            !item ||
            typeof item.product !== "string" ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity < 0
        )
    )
  )
    throw new Error("Invalid saved checks");
  return checks;
}
