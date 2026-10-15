import { eligibleBranchNames } from "../../../data/branches.mjs";
export function summarize({
  branchRecords = [],
  employees,
  branches,
  orders,
  checks,
  reports,
  branch,
  week,
}) {
  const expectedNames = new Set(eligibleBranchNames(branchRecords, week));
  const matches = (record) =>
    record.week === week && (branch === "all" || record.branch === branch);
  const weeklyOrders = orders?.filter(matches) ?? null;
  const weeklyChecks = checks?.filter(matches) ?? null;
  const weeklyReports = reports?.filter(matches) ?? null;
  const team = employees.filter(
    (employee) => branch === "all" || employee.branch === branch
  );
  const branchNames = Array.from(
    new Set([
      ...branches,
      ...employees.map((employee) => employee.branch),
      ...(orders || []).map((record) => record.branch),
      ...(checks || []).map((record) => record.branch),
      ...(reports || []).map((record) => record.branch),
    ])
  );
  const rows = branchNames
    .filter((name) => branch === "all" || name === branch)
    .map((name) => {
      const sales =
        weeklyReports?.filter((report) => report.branch === name) ?? null;
      return {
        name,
        expected: expectedNames.has(name),
        employees: employees.filter((employee) => employee.branch === name)
          .length,
        managers: employees.filter(
          (employee) =>
            employee.branch === name && employee.role === "Branch manager"
        ),
        orders:
          weeklyOrders === null
            ? null
            : weeklyOrders.filter((order) => order.branch === name).length,
        checks:
          weeklyChecks === null
            ? null
            : weeklyChecks.filter((check) => check.branch === name).length,
        reports: sales === null ? null : sales.length,
        card: sales?.reduce((sum, report) => sum + report.cardCents, 0) ?? null,
        cash: sales?.reduce((sum, report) => sum + report.cashCents, 0) ?? null,
      };
    });
  const card =
    weeklyReports?.reduce((sum, report) => sum + report.cardCents, 0) ?? null;
  const cash =
    weeklyReports?.reduce((sum, report) => sum + report.cashCents, 0) ?? null;
  const activity = [
    ...(weeklyOrders || []).map((record) => ({
      ...record,
      type: "Weekly order",
      person: record.manager,
      date: record.placedAt,
      path: "weekly-orders",
    })),
    ...(weeklyChecks || []).map((record) => ({
      ...record,
      type: "Stock check",
      person: record.employee,
      date: record.recordedAt,
      path: "weekly-stock-checks",
    })),
    ...(weeklyReports || []).map((record) => ({
      ...record,
      type: "Sales report",
      person: record.manager,
      date: record.savedAt,
      path: "weekly-sales-reports",
    })),
  ]
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
    .slice(0, 6);
  return {
    team,
    weeklyOrders,
    weeklyChecks,
    weeklyReports,
    branchNames,
    rows,
    card,
    cash,
    total: card === null || cash === null ? null : card + cash,
    missing: rows.reduce(
      (count, row) =>
        count +
        (row.expected
          ? [row.orders, row.checks, row.reports].filter((value) => value === 0)
              .length
          : 0),
      0
    ),
    zeroStock:
      weeklyChecks?.flatMap((check) =>
        check.items
          .filter((item) => item.quantity === 0)
          .map((item) => ({
            ...item,
            branch: check.branch,
            employee: check.employee,
          }))
      ) ?? null,
    activity,
  };
}
