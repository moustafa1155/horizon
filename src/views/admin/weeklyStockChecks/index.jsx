import WeekSelector from "components/weekSelector";
import { useAuth } from "../../../contexts/AuthContext";
import { useState } from "react";
import Card from "components/card";
import { FiPackage } from "react-icons/fi";
import useBranches from "../../../hooks/useBranches";
import { eligibleBranchNames } from "../../../data/branches.mjs";

import StockCheckForm from "./StockCheckForm";
import {
  STORAGE_KEY,
  loadStockChecks,
  validateStockCheck,
} from "./stockCheckHelpers.mjs";

function initialState() {
  try {
    return { checks: loadStockChecks(window.localStorage), error: "" };
  } catch {
    return {
      checks: [],
      error:
        "Saved checks could not be loaded. Please check browser storage before saving another stock check.",
    };
  }
}

export default function WeeklyStockChecks() {
  const { can } = useAuth();
  const canManage = can("weekly-stock-checks", "manage");
  const { records: branchRecords, branchError } = useBranches();
  const branches = branchRecords
    .filter((record) => !record.removed)
    .map((record) => record.name);
  const [state, setState] = useState(initialState);
  const [showForm, setShowForm] = useState(false);
  const [branch, setBranch] = useState("all");
  const [week, setWeek] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState("");
  const filtered = state.checks.filter(
    (check) =>
      (branch === "all" || check.branch === branch) &&
      (!week || check.week === week)
  );
  const selected = filtered.find((check) => check.id === selectedId);
  function saveStockCheck(draft) {
    if (!canManage)
      return "You do not have permission to add records on this page.";
    if (state.error) return state.error;
    if (branchError) return branchError;
    const error = validateStockCheck(
      draft,
      eligibleBranchNames(branchRecords, draft.week),
      state.checks
    );
    if (error) return error;
    const check = {
      ...draft,
      id: crypto.randomUUID(),
      employee: draft.employee.trim(),
      notes: draft.notes.trim(),
      items: draft.items.map((item) => ({
        product: item.product.trim(),
        quantity: Number(item.quantity),
      })),
      recordedAt: new Date().toISOString(),
    };
    const checks = [check, ...state.checks];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checks));
    } catch {
      return "The check could not be saved. Check browser storage and try again.";
    }
    setState({ checks, error: "" });
    setShowForm(false);
    setSelectedId(check.id);
    setBranch("all");
    setWeek("");
    setNotice(
      "Stock check saved in this browser. It has not been sent to the company."
    );
    return "";
  }
  const field =
    "rounded-xl border border-gray-200 bg-lightPrimary px-3 py-2 text-sm text-navy-700 dark:border-white/10 dark:bg-navy-900 dark:text-white";
  return (
    <div className="mt-3 space-y-5 text-navy-700 dark:text-white">
      {branchError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300">
          {branchError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Weekly stock counts recorded by employees for each branch.
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
            New weekly stock check
          </button>
        )}
      </div>
      <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-navy-800 dark:text-gray-300">
        Stock checks are saved on this browser only. Company submission and
        employee accounts across devices are not connected yet.
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
      {showForm && canManage && (
        <StockCheckForm
          branchRecords={branchRecords}
          onSave={saveStockCheck}
          onCancel={() => setShowForm(false)}
        />
      )}
      <Card extra="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold">
            Weekly stock checks{" "}
            <span className="text-sm font-normal text-gray-700 dark:text-gray-300">
              ({filtered.length})
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              Branch
              <select
                aria-label="Filter checks by branch"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                className={field}
              >
                <option value="all">All branches</option>
                {Array.from(
                  new Set([
                    ...branches,
                    ...state.checks.map((check) => check.branch),
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
              labelPrefix="Stock checks filter"
            />
            <button
              type="button"
              onClick={() => {
                setBranch("all");
                setWeek("");
              }}
              className="text-sm text-brand-500 hover:underline dark:text-brand-200"
            >
              Clear filters
            </button>
          </div>
        </div>
        {!filtered.length ? (
          <div className="py-14 text-center">
            <FiPackage className="mx-auto mb-4 text-4xl text-gray-600" />
            <h3 className="font-bold">
              {state.checks.length
                ? "No matching checks"
                : "No weekly stock checks yet"}
            </h3>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              {state.checks.length
                ? "Try another branch or stock check week."
                : "Employees' stock checks will appear here once recorded."}
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[600px] text-start text-sm">
              <caption className="sr-only">Weekly stock checks</caption>
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-700 dark:border-white/10 dark:text-gray-300">
                  {[
                    "Branch",
                    "Week beginning",
                    "Employee",
                    "Product lines",
                    "",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-2 py-3 text-start"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((check) => (
                  <tr
                    key={check.id}
                    className="border-b border-gray-100 dark:border-white/10"
                  >
                    <td className="px-2 py-4 font-medium">{check.branch}</td>
                    <td className="px-2 py-4">{check.week}</td>
                    <td className="px-2 py-4">{check.employee}</td>
                    <td className="px-2 py-4">{check.items.length}</td>
                    <td className="px-2 py-4">
                      <button
                        type="button"
                        aria-label={`View ${check.branch} check for ${check.week}`}
                        aria-pressed={selectedId === check.id}
                        onClick={() => setSelectedId(check.id)}
                        className="font-medium text-brand-500 hover:underline dark:text-brand-200"
                      >
                        View check
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {selected && (
        <Card extra="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Stock check details</h2>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {selected.branch} · Week beginning {selected.week} ·{" "}
                {selected.employee}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-sm text-brand-500 hover:underline dark:text-brand-200"
            >
              Close details
            </button>
          </div>
          <ul className="mt-5 divide-y divide-gray-200 dark:divide-white/10">
            {selected.items.map((item) => (
              <li
                key={item.product}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <span>{item.product}</span>
                <span className="font-bold">
                  Counted stock: {item.quantity}
                </span>
              </li>
            ))}
          </ul>
          {selected.notes && (
            <p className="mt-4 whitespace-pre-wrap text-sm">
              Notes: {selected.notes}
            </p>
          )}
          <p className="mt-4 text-xs text-gray-700 dark:text-gray-300">
            Saved locally on{" "}
            {new Date(selected.recordedAt).toLocaleString("en-GB")}
          </p>
        </Card>
      )}
    </div>
  );
}
