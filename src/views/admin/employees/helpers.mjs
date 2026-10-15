export function filterEmployees(
  employees,
  { branch = "all", role = "all", query = "" }
) {
  const search = query.trim().toLowerCase();
  return employees.filter(
    (employee) =>
      (branch === "all" || employee.branch === branch) &&
      (role === "all" || employee.role === role) &&
      [employee.name, employee.id, employee.email, employee.title].some(
        (value) => value.toLowerCase().includes(search)
      )
  );
}

export function getWeekStart(date = new Date()) {
  const monday = new Date(date);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function scheduledHours(shifts) {
  const minutes = (time) =>
    time
      .split(":")
      .reduce(
        (hours, value, index) => hours + Number(value) * (index === 0 ? 60 : 1),
        0
      );
  return shifts.reduce(
    (total, shift) =>
      total +
      (minutes(shift.end) - minutes(shift.start) - shift.breakMinutes) / 60,
    0
  );
}

export function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}
