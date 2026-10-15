import WeekSelector from "components/weekSelector";
import { useAuth } from "../../../contexts/AuthContext";
import { useState } from "react";
import Card from "components/card";
import { FiBarChart2 } from "react-icons/fi";
import useBranches from "../../../hooks/useBranches";
import { eligibleBranchNames } from "../../../data/branches.mjs";

import { currentWeek } from "../weeklyOrders/orderHelpers.mjs";
import SalesReportForm from "./SalesReportForm";
import {
  STORAGE_KEY,
  loadReports,
  validateReport,
  toCents,
  totals,
  formatMoney,
} from "./salesHelpers.mjs";

function initialState() {
  try {
    return { reports: loadReports(window.localStorage), error: "" };
  } catch {
    return {
      reports: [],
      error:
        "Saved reports could not be loaded. Check browser storage before saving another report.",
    };
  }
}

export default function WeeklySalesReports() {
  const { can, user } = useAuth();
  const canManage = can("weekly-sales-reports", "manage");
  const { records: branchRecords, branchError } = useBranches();
  const branches = branchRecords
    .filter((record) => !record.removed)
    .map((record) => record.name);
  const [state, setState] = useState(initialState);
  const [showForm, setShowForm] = useState(false);
  const [branch, setBranch] = useState("all");
  const [week, setWeek] = useState(currentWeek);
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState("");
  const filtered = state.reports.filter(
    (report) =>
      (branch === "all" || report.branch === branch) &&
      (!week || report.week === week)
  );
  const summary = totals(filtered);
  const selected = filtered.find((report) => report.id === selectedId);
  function saveReport(draft) {
    if (!canManage)
      return "You do not have permission to add records on this page.";
    if (state.error) return state.error;
    if (branchError) return branchError;
    const error = validateReport(
      draft,
      eligibleBranchNames(branchRecords, draft.week),
      state.reports
    );
    if (error) return error;
    const report = {
      id: crypto.randomUUID(),
      branch: draft.branch,
      manager: draft.manager.trim(),
      week: draft.week,
      cardCents: toCents(draft.card),
      cashCents: toCents(draft.cash),
      notes: draft.notes.trim(),
      savedAt: new Date().toISOString(),
    };
    const reports = [report, ...state.reports];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    } catch {
      return "The report could not be saved. Check browser storage and try again.";
    }
    setState({ reports, error: "" });
    setShowForm(false);
    setSelectedId(report.id);
    setBranch("all");
    setWeek(report.week);
    setNotice(
      "Sales report saved in this browser. It has not been sent to the company."
    );
    return "";
  }
  const field =
    "rounded-xl border border-gray-200 bg-lightPrimary px-3 py-2 text-sm text-navy-700 dark:border-white/10 dark:bg-navy-900 dark:text-white";
  if(user?.role==='Branch Manager')return <div className="mt-4 space-y-5 text-navy-700 dark:text-white"><h1 className="text-xl font-bold">Submit weekly sales report</h1><p className="text-sm">Enter card and cash sales for your branch. Saved company reports are available to admins.</p>{(branchError||state.error)&&<p role="alert" className="text-red-600">{branchError||state.error}</p>}{notice&&<p role="status">{notice}</p>}<SalesReportForm key={state.reports.length} branchRecords={branchRecords} onSave={saveReport} onCancel={()=>setNotice('Report entry cancelled.')} /></div>;
  return (
    <div className="mt-3 space-y-5 text-navy-700 dark:text-white">
      {branchError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300">
          {branchError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Weekly branch sales reported by branch managers, with card and cash
          totals for the admin.
        </p>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setNotice("");
            }}
            className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white hover:bg-brand-600"
          >
            New sales report
          </button>
        )}
      </div>
      <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-white/10 dark:bg-navy-800 dark:text-gray-300">
        Reports save in this browser only. Company-wide submission and manager
        accounts across devices are not connected yet.
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300">
          {state.error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-green-100 p-4 text-sm text-green-800"
        >
          {notice}
        </p>
      )}
      <Card extra="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            Branch
            <select
              aria-label="Filter sales by branch"
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              className={field}
            >
              <option value="all">All branches</option>
              {Array.from(
                new Set([
                  ...branches,
                  ...state.reports.map((report) => report.branch),
                ])
              ).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <WeekSelector
            value={week}
            onChange={setWeek}
            className={field}
            allowAll
            labelPrefix="Sales reports filter"
          />
          <button
            type="button"
            onClick={() => {
              setBranch("all");
              setWeek("");
            }}
            className="text-sm text-brand-500 hover:underline dark:text-brand-200"
          >
            All weeks
          </button>
          <button
            type="button"
            onClick={() => setWeek(currentWeek())}
            className="text-sm text-brand-500 hover:underline dark:text-brand-200"
          >
            This week
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-700 dark:text-gray-300">
          Totals below cover {branch === "all" ? "all branches" : branch},{" "}
          {week ? `week beginning ${week}` : "all weeks"}.
        </p>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Card sales", summary.card],
          ["Cash sales", summary.cash],
          ["Total sales", summary.total],
        ].map(([label, value]) => (
          <Card key={label} extra="p-5">
            <p className="text-sm text-gray-700 dark:text-gray-300">{label}</p>
            <p className="mt-2 text-2xl font-bold">{formatMoney(value)}</p>
            {label === "Total sales" && (
              <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                Card + cash
              </p>
            )}
          </Card>
        ))}
      </div>
      {showForm && canManage && (
        <SalesReportForm
          branchRecords={branchRecords}
          onSave={saveReport}
          onCancel={() => setShowForm(false)}
        />
      )}
      <Card extra="p-6">
        <h2 className="text-lg font-bold">
          Weekly sales reports ({filtered.length})
        </h2>
        {!filtered.length ? (
          <div className="py-14 text-center">
            <FiBarChart2 className="mx-auto mb-4 text-4xl text-gray-600" />
            <h3 className="font-bold">
              {state.reports.length
                ? "No matching reports"
                : "No sales reports yet"}
            </h3>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              {state.reports.length
                ? "Choose another branch or week."
                : "Branch managers' weekly sales reports will appear here once saved."}
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[750px] text-sm">
              <caption className="sr-only">
                Card and cash sales by branch and week in GBP
              </caption>
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-700 dark:border-white/10 dark:text-gray-300">
                  {[
                    "Branch",
                    "Week beginning",
                    "Manager",
                    "Card",
                    "Cash",
                    "Total",
                    "Details",
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
                {filtered.map((report) => (
                  <tr
                    key={report.id}
                    className="border-b border-gray-100 dark:border-white/10"
                  >
                    <td className="px-2 py-4 font-medium">{report.branch}</td>
                    <td className="px-2 py-4">{report.week}</td>
                    <td className="px-2 py-4">{report.manager}</td>
                    <td className="px-2 py-4">
                      {formatMoney(report.cardCents)}
                    </td>
                    <td className="px-2 py-4">
                      {formatMoney(report.cashCents)}
                    </td>
                    <td className="px-2 py-4 font-bold">
                      {formatMoney(report.cardCents + report.cashCents)}
                    </td>
                    <td className="px-2 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedId(report.id)}
                        aria-label={`View ${report.branch} sales for ${report.week}`}
                        className="text-brand-500 hover:underline dark:text-brand-200"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <th scope="row" colSpan={3} className="px-2 py-4 text-start">
                    Filtered totals
                  </th>
                  <td className="px-2 py-4">{formatMoney(summary.card)}</td>
                  <td className="px-2 py-4">{formatMoney(summary.cash)}</td>
                  <td className="px-2 py-4">{formatMoney(summary.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
      {selected && (
        <Card extra="p-6">
          <div className="flex justify-between gap-3">
            <h2 className="text-lg font-bold">Sales report details</h2>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-sm text-brand-500 hover:underline dark:text-brand-200"
            >
              Close details
            </button>
          </div>
          <p className="mt-2 text-sm">
            {selected.branch} · Week beginning {selected.week} ·{" "}
            {selected.manager}
          </p>
          <dl className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              ["Card sales", selected.cardCents],
              ["Cash sales", selected.cashCents],
              ["Total sales", selected.cardCents + selected.cashCents],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-gray-700 dark:text-gray-300">
                  {label}
                </dt>
                <dd className="mt-1 text-lg font-bold">{formatMoney(value)}</dd>
              </div>
            ))}
          </dl>
          {selected.notes && (
            <p className="mt-5 whitespace-pre-wrap text-sm">
              Notes: {selected.notes}
            </p>
          )}
          <p className="mt-4 text-xs text-gray-700 dark:text-gray-300">
            Saved locally on{" "}
            {new Date(selected.savedAt).toLocaleString("en-GB")}
          </p>
        </Card>
      )}
    </div>
  );
}
