export function validWeek(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 1 && date.toISOString().slice(0, 10) === value;
}
