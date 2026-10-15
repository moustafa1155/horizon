import WeekSelector from "components/weekSelector";
import { eligibleBranchNames } from "../../../data/branches.mjs";
import { useState } from "react";
import Card from "components/card";
import { currentWeek } from "../weeklyOrders/orderHelpers.mjs";
import { toCents, formatMoney } from "./salesHelpers.mjs";

const field =
  "mt-2 w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 text-sm text-navy-700 outline-none focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-navy-900 dark:text-white";

export default function SalesReportForm({ branchRecords, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    branch: "",
    manager: "",
    week: currentWeek(),
    card: "",
    cash: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const branches = eligibleBranchNames(branchRecords, draft.week);
  const update = (key) => (event) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));
  const card = toCents(draft.card);
  const cash = toCents(draft.cash);
  return (
    <Card extra="p-6">
      <h2 className="text-xl font-bold">New weekly sales report</h2>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
        Record card and cash sales for the full week. Amounts are in GBP.
      </p>
      {!branches.length && (
        <p className="mt-4 rounded-xl bg-lightPrimary p-3 text-sm text-gray-700 dark:bg-navy-900 dark:text-gray-300">
          No branches are available for this week. Add a branch or choose a week
          within a temporary branch's operating dates.
        </p>
      )}
      <form
        className="mt-5 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          setError(onSave(draft));
        }}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="sales-branch" className="text-sm font-medium">
              Branch
            </label>
            <select
              id="sales-branch"
              required
              disabled={!branches.length}
              value={draft.branch}
              onChange={update("branch")}
              className={field}
            >
              <option value="">
                {branches.length
                  ? "Select branch"
                  : "No branches available for this week"}
              </option>
              {branches.map((branch) => (
                <option key={branch}>{branch}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sales-manager" className="text-sm font-medium">
              Branch manager
            </label>
            <input
              id="sales-manager"
              required
              maxLength={120}
              value={draft.manager}
              onChange={update("manager")}
              placeholder="Manager's name"
              className={field}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <WeekSelector
              value={draft.week}
              onChange={(value) =>
                setDraft((current) => ({ ...current, week: value }))
              }
              className={field}
              labelPrefix="Sales report"
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["card", "Card sales (£)"],
            ["cash", "Cash sales (£)"],
          ].map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`sales-${key}`} className="text-sm font-medium">
                {label}
              </label>
              <input
                id={`sales-${key}`}
                type="number"
                inputMode="decimal"
                min="0"
                max="1000000000"
                step="0.01"
                required
                value={draft[key]}
                onChange={update(key)}
                placeholder="0.00"
                className={field}
              />
            </div>
          ))}
          <div className="rounded-xl bg-brand-50 p-4 dark:bg-navy-700">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Total sales
            </p>
            <output
              aria-live="polite"
              className="mt-2 block text-2xl font-bold text-brand-500 dark:text-white"
            >
              {card !== null && cash !== null ? formatMoney(card + cash) : "—"}
            </output>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
              Card + cash
            </p>
          </div>
        </div>
        <div>
          <label htmlFor="sales-notes" className="text-sm font-medium">
            Notes (optional)
          </label>
          <textarea
            id="sales-notes"
            rows={3}
            maxLength={2000}
            value={draft.notes}
            onChange={update("notes")}
            className={field}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-lightPrimary px-5 py-3 text-sm dark:bg-navy-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!branches.length}
            className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save sales report
          </button>
        </div>
      </form>
    </Card>
  );
}
