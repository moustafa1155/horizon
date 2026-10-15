const iso = (date) => date.toISOString().slice(0, 10);
export function weekYear(monday) {
  const date = new Date(monday + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + 3);
  return date.getUTCFullYear();
}
export function weeksOfYear(year) {
  const first = (y) => {
    const d = new Date(Date.UTC(y, 0, 4, 12));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d;
  };
  const start = first(year),
    end = first(year + 1),
    weeks = [];
  const format = (d) =>
    d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  for (
    let d = new Date(start), number = 1;
    d < end;
    d.setUTCDate(d.getUTCDate() + 7), number++
  ) {
    const last = new Date(d);
    last.setUTCDate(last.getUTCDate() + 6);
    weeks.push({
      value: iso(d),
      number,
      label: "Week " + number + " · " + format(d) + " – " + format(last),
    });
  }
  return weeks;
}
