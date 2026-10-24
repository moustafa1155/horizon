import useImportedSales, { mergeSales } from "../../../hooks/useImportedSales";
import WeekSelector from "components/weekSelector";
import FinancialSummary from "./FinancialSummary";
import { useAuth } from "../../../contexts/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { Link } from "lib/navigation";
import Card from "components/card";
import {
  FiUsers,
  FiShoppingBag,
  FiClipboard,
  FiRefreshCw,
} from "react-icons/fi";
import useEmployees from "../../../hooks/useEmployees";
import useBranches from "../../../hooks/useBranches";
import { currentWeek, loadOrders } from "../weeklyOrders/orderHelpers.mjs";
import { loadStockChecks } from "../weeklyStockChecks/stockCheckHelpers.mjs";
import {
  loadReports,
  formatMoney,
} from "../weeklySalesReports/salesHelpers.mjs";
import { summarize } from "./dashboardHelpers.mjs";

function readDashboard(can) {
  const errors = [];
  const read = (name, loader) => {
    try {
      return loader(window.localStorage);
    } catch {
      errors.push(`${name} could not be loaded from browser storage.`);
      return null;
    }
  };
  return {
    orders: can("weekly-orders") ? read("Weekly orders", loadOrders) : null,
    checks: can("weekly-stock-checks")
      ? read("Stock checks", loadStockChecks)
      : null,
    reports: can("weekly-sales-reports")
      ? read("Sales reports", loadReports)
      : null,
    errors,
  };
}

const quickLinks = [
  {
    label: "Branches",
    path: "branches",
    description: "Permanent and temporary locations",
    Icon: FiUsers,
  },
  {
    label: "Employees",
    path: "employees",
    description: "Team details and weekly timetables",
    Icon: FiUsers,
  },
  {
    label: "Weekly Orders",
    path: "weekly-orders",
    description: "Product orders from branch managers",
    Icon: FiShoppingBag,
  },
  {
    label: "Stock Checks",
    path: "weekly-stock-checks",
    description: "Stock counts recorded by employees",
    Icon: FiClipboard,
  },
  {
    label: "Sales Reports",
    path: "weekly-sales-reports",
    description: "Branch card and cash sales",
    Icon: FiClipboard,
  },
];
const field =
  "rounded-xl border border-gray-200 bg-lightPrimary px-3 py-2 text-sm text-navy-700 dark:border-white/10 dark:bg-navy-900 dark:text-white";
const linkStyle =
  "text-sm font-medium text-brand-500 hover:underline dark:text-brand-200";

function Status({ count, expected = true }) {
  return (
    <span
      className={`inline-block rounded-lg px-2 py-1 text-xs ${
        count === null
          ? "bg-gray-100 text-gray-700 dark:bg-navy-900 dark:text-gray-300"
          : count
          ? "bg-green-100 text-green-800"
          : "bg-amber-100 text-amber-800"
      }`}
    >
      {count === null
        ? "Unavailable"
        : count
        ? "Recorded locally"
        : expected
        ? "Missing"
        : "Not expected"}
    </span>
  );
}

export default function Dashboard() {
  const { can, user } = useAuth();
  const imported = useImportedSales(user?.role === "Admin");
  const { records: employeeRecords, error: employeeError } = useEmployees();
  const employees = can("employees") ? employeeRecords : [];
  const { records: branchRecords, branchError } = useBranches();
  const branches = branchRecords.map((record) => record.name);
  const [data, setData] = useState(() => readDashboard(can));
  const [branch, setBranch] = useState("all");
  const [week, setWeek] = useState(currentWeek);
  useEffect(() => {
    const refresh = () => setData(readDashboard(can));
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [user]);
  const summary = useMemo(
    () =>
      summarize({
        ...data,
        orders: can("weekly-orders") ? data.orders : null,
        checks: can("weekly-stock-checks") ? data.checks : null,
        reports: can("weekly-sales-reports")
          ? data.reports === null
            ? null
            : mergeSales(data.reports, imported.reports)
          : null,
        employees,
        branches,
        branchRecords,
        branch,
        week,
      }),
    [data, user, branchRecords, branch, week, employeeRecords, imported.reports]
  );
  const salesValue = (amount) =>
    amount === null
      ? "Unavailable"
      : !summary.weeklyReports?.length
      ? "—"
      : formatMoney(amount);
  const salesHint =
    summary.weeklyReports === null
      ? "Sales data unavailable"
      : summary.weeklyReports.length
      ? `${summary.weeklyReports.length} branch report(s)`
      : "No sales reports recorded";
  const metrics = [
    ["Card sales", salesValue(summary.card), salesHint, "weekly-sales-reports"],
    ["Cash sales", salesValue(summary.cash), salesHint, "weekly-sales-reports"],
    [
      "Total sales",
      salesValue(summary.total),
      "Card + cash · GBP",
      "weekly-sales-reports",
    ],
  ];
  return (
    <div className="mt-3 space-y-5 text-navy-700 dark:text-white">
      {imported.error && (
        <p role="alert" className="text-red-600">
          {imported.error}
        </p>
      )}
      {branchError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300">
          {branchError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Company overview</h1>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            Team, branch reporting and weekly sales in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setData(readDashboard(can));
            imported.refresh();
          }}
          className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium dark:bg-navy-800"
        >
          <FiRefreshCw />
          Refresh data
        </button>
      </div>
      <Card extra="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            Branch
            <select
              aria-label="Dashboard branch"
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              className={field}
            >
              <option value="all">All branches</option>
              {summary.branchNames.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <WeekSelector value={week} onChange={setWeek} className={field} />
          <button
            type="button"
            onClick={() => setWeek(currentWeek())}
            className={linkStyle}
          >
            This week
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-700 dark:text-gray-300">
          Weekly figures cover {branch === "all" ? "all branches" : branch},
          week beginning {week}.
        </p>
      </Card>
      {user?.role === "Admin" && (
        <FinancialSummary
          key={branch}
          branches={branchRecords}
          branchName={branch}
          week={week}
        />
      )}
      <p className="text-xs text-gray-700 dark:text-gray-300">
        The financial summary is saved in the company database. Other reporting
        below includes records saved in this browser.
      </p>
      {data.errors.length > 0 && (
        <div
          role="alert"
          className="rounded-xl bg-red-100 p-4 text-sm text-red-800"
        >
          {data.errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {metrics
          .filter((metric) => can(metric[3]))
          .map(([label, value, hint, path]) => (
            <Card key={label} extra="p-5">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold">{value}</p>
              <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                {hint}
              </p>
              <Link to={`/admin/${path}`} className={`${linkStyle} mt-4`}>
                View {label.toLowerCase()}
              </Link>
            </Card>
          ))}
      </div>
      <Card extra="p-6">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Branch reporting status</h2>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              Orders, stock checks and sales reports for the selected week.
            </p>
          </div>
          {summary.rows.length > 0 && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {summary.missing} missing report{summary.missing === 1 ? "" : "s"}
              {data.errors.length ? " · Some data unavailable" : ""}
            </p>
          )}
        </div>
        {!summary.rows.length ? (
          <div className="py-10 text-center">
            <h3 className="font-bold">No branches added yet</h3>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Branch reporting status will appear when company branches are
              available.
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <caption className="sr-only">
                Weekly reporting and sales by branch
              </caption>
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-700 dark:border-white/10 dark:text-gray-300">
                  {[
                    "Branch / manager",
                    "Employees",
                    "Orders",
                    "Stock checks",
                    "Sales report",
                    "Card sales",
                    "Cash sales",
                    "Total",
                  ].map((label) => (
                    <th
                      scope="col"
                      key={label}
                      className="px-2 py-3 text-start"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr
                    key={row.name}
                    className="border-b border-gray-100 dark:border-white/10"
                  >
                    <th scope="row" className="px-2 py-4 text-start">
                      <p>{row.name}</p>
                      <p className="mt-1 text-xs font-normal text-gray-700 dark:text-gray-300">
                        {row.managers
                          .map((manager) => manager.name)
                          .join(", ") || "No manager assigned"}
                      </p>
                    </th>
                    <td className="px-2 py-4">{row.employees}</td>
                    {[row.orders, row.checks, row.reports].map(
                      (count, index) => (
                        <td key={index} className="px-2 py-4">
                          <Status count={count} expected={row.expected} />
                        </td>
                      )
                    )}
                    {[
                      row.card,
                      row.cash,
                      row.card === null || row.cash === null
                        ? null
                        : row.card + row.cash,
                    ].map((amount, index) => (
                      <td
                        key={index}
                        className={`px-2 py-4 ${
                          index === 2 ? "font-bold" : ""
                        }`}
                      >
                        {row.reports === null
                          ? "Unavailable"
                          : row.reports
                          ? formatMoney(amount)
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="grid items-start gap-5 2xl:grid-cols-2">
        <Card extra="p-6">
          <h2 className="text-lg font-bold">Stock requiring attention</h2>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            Products recorded with zero stock this week.
          </p>
          {summary.zeroStock === null ? (
            <p className="py-8 text-sm text-gray-700 dark:text-gray-300">
              Stock check data unavailable.
            </p>
          ) : !summary.weeklyChecks.length ? (
            <p className="py-8 text-sm text-gray-700 dark:text-gray-300">
              No stock checks recorded for this week.
            </p>
          ) : !summary.zeroStock.length ? (
            <p className="py-8 text-sm text-gray-700 dark:text-gray-300">
              No zero-stock products in the recorded checks.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-200 dark:divide-white/10">
              {summary.zeroStock.map((item, index) => (
                <li
                  key={`${item.branch}-${item.product}-${index}`}
                  className="flex justify-between gap-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.product}</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">
                      {item.branch} · {item.employee}
                    </p>
                  </div>
                  <span className="text-red-600 dark:text-red-300">
                    0 in stock
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            aria-disabled={!can("weekly-stock-checks")}
            to={can("weekly-stock-checks") ? "/admin/weekly-stock-checks" : "#"}
            className={linkStyle}
          >
            View stock checks
          </Link>
        </Card>
        <Card extra="p-6">
          <h2 className="text-lg font-bold">Recent weekly activity</h2>
          {!summary.activity.length ? (
            <p className="py-8 text-sm text-gray-700 dark:text-gray-300">
              No activity recorded for the selected branch and week.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-200 dark:divide-white/10">
              {summary.activity.map((record) => (
                <li key={`${record.path}-${record.id}`} className="py-3">
                  <Link to={`/admin/${record.path}`} className={linkStyle}>
                    {record.type} · {record.branch}
                  </Link>
                  <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                    {record.person}
                    {Number.isNaN(Date.parse(record.date))
                      ? ""
                      : ` · ${new Date(record.date).toLocaleString("en-GB")}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {quickLinks
          .filter((link) => can(link.path))
          .map(({ label, path, description, Icon }) => (
            <Link
              key={path}
              to={`/admin/${path}`}
              className="rounded-[20px] bg-white p-5 shadow-sm transition hover:bg-brand-50 dark:bg-navy-800 dark:hover:bg-navy-700"
            >
              <Icon className="mb-3 text-xl text-brand-500 dark:text-brand-200" />
              <h2 className="font-bold">{label}</h2>
              <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                {description}
              </p>
            </Link>
          ))}
      </div>
    </div>
  );
}
