export const STORAGE_KEY = "horizon.weekly-orders.v1";

export function currentWeek() {
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export function validateOrder(order, branches, orders) {
  if (!branches.includes(order.branch)) return "Select a valid branch.";
  if (!order.manager.trim()) return "Enter the branch manager's name.";
  const date = new Date(`${order.week}T12:00:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(order.week) ||
    Number.isNaN(date.getTime()) ||
    date.getDay() !== 1 ||
    date.toISOString().slice(0, 10) !== order.week
  )
    return "Choose a Monday as the start of the order week.";
  if (
    !order.items.length ||
    order.items.some(
      (item) =>
        !item.product.trim() ||
        !Number.isSafeInteger(Number(item.quantity)) ||
        Number(item.quantity) <= 0
    )
  )
    return "Each product needs a name and a positive whole-number quantity.";
  const names = order.items.map((item) => item.product.trim().toLowerCase());
  if (new Set(names).size !== names.length)
    return "Combine duplicate products into one order line.";
  if (
    orders.some(
      (existing) =>
        existing.branch === order.branch && existing.week === order.week
    )
  )
    return "This branch already has an order for that week.";
  return "";
}

export function loadOrders(storage) {
  const orders = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
  if (
    !Array.isArray(orders) ||
    orders.some(
      (order) =>
        !order ||
        typeof order.id !== "string" ||
        typeof order.branch !== "string" ||
        typeof order.manager !== "string" ||
        typeof order.week !== "string" ||
        !Array.isArray(order.items) ||
        order.items.some(
          (item) =>
            !item ||
            typeof item.product !== "string" ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity <= 0
        )
    )
  )
    throw new Error("Invalid saved orders");
  return orders;
}
