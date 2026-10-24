import { useEffect, useState } from "react";
import Card from "components/card";
import {
  FINANCIAL_FIELDS,
  emptyFinancialValues,
  amountToCents,
  amountInputValue,
} from "../../../data/financialSummary.mjs";
import { formatMoney } from "../weeklySalesReports/salesHelpers.mjs";
const field =
  "w-full rounded-lg border border-gray-200 bg-lightPrimary px-2.5 py-1.5 text-sm dark:border-white/10 dark:bg-navy-900";
export default function FinancialSummary({ branches, branchName, week }) {
  const preferred =
    branches.find((b) => b.name === branchName)?.id ||
    (branches.length === 1 ? branches[0].id : "");
  const [choice, setChoice] = useState("");
  const branchId = preferred || choice;
  return (
    <Card extra="w-full max-w-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Weekly financial summary</h2>
          <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
            Blank cells mean no figure has been entered. Amounts are in GBP.
          </p>
        </div>
        <label className="text-sm font-medium">
          Branch
          <select
            aria-label="Financial summary branch"
            value={branchId}
            onChange={(event) => setChoice(event.target.value)}
            disabled={!!preferred}
            className={field + " mt-1"}
          >
            <option value="">Select a branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {branchId ? (
        <SummaryEditor
          key={branchId + "|" + week}
          branchId={branchId}
          week={week}
        />
      ) : (
        <p className="mt-5 text-sm text-gray-700 dark:text-gray-300">
          Choose a branch to view or add its financial figures.
        </p>
      )}
    </Card>
  );
}
function SummaryEditor({ branchId, week }) {
  const [record, setRecord] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load(signal) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        "/api/financial-summaries?" + new URLSearchParams({ branchId, week }),
        { cache: "no-store", signal }
      );
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setRecord(data.summary);
      setEditing(false);
    } catch (e) {
      if (e.name !== "AbortError")
        setError(e.message || "Financial summary could not be loaded.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [branchId, week]);
  function start() {
    const values = record || emptyFinancialValues();
    setDraft(
      Object.fromEntries(
        FINANCIAL_FIELDS.map(([key]) => [key, amountInputValue(values[key])])
      )
    );
    setNotice("");
    setError("");
    setEditing(true);
  }
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setError("");
    let values;
    try {
      values = Object.fromEntries(
        FINANCIAL_FIELDS.map(([key]) => [
          key,
          amountToCents(draft[key] ?? "", key === "profitLossCents"),
        ])
      );
    } catch (e) {
      setError(e.message);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/financial-summaries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          week,
          revision: record?.revision || 0,
          values,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setRecord(data.summary);
      setEditing(false);
      setNotice("Financial summary saved.");
    } catch (e) {
      setError(e.message || "Financial summary could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mt-3">
      <p className="mb-2 text-xs">
        Week beginning{" "}
        {new Date(week + "T12:00:00Z").toLocaleDateString("en-GB", {
          timeZone: "UTC",
        })}
      </p>
      {loading ? (
        <p role="status">Loading financial summary…</p>
      ) : (
        <form onSubmit={save}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Weekly financial summary for the selected branch
              </caption>
              <tbody>
                {FINANCIAL_FIELDS.map(([key, label]) => (
                  <tr key={key}>
                    <th
                      scope="row"
                      className="w-1/2 border border-gray-200 bg-lightPrimary px-3 py-2 text-left font-medium dark:border-white/10 dark:bg-navy-900"
                    >
                      {editing ? (
                        <label htmlFor={"finance-" + key}>{label}</label>
                      ) : (
                        label
                      )}
                    </th>
                    <td className="border border-gray-200 px-3 py-2 text-right dark:border-white/10">
                      {editing ? (
                        <input
                          id={"finance-" + key}
                          aria-label={label + " (GBP)"}
                          type="number"
                          step="0.01"
                          min={key === "profitLossCents" ? undefined : "0"}
                          disabled={saving}
                          value={draft[key] ?? ""}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          className={field + " text-right"}
                        />
                      ) : record?.[key] === null ||
                        record?.[key] === undefined ? (
                        ""
                      ) : (
                        formatMoney(record[key])
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {editing ? (
              <>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save figures"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false);
                    setError("");
                  }}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/20"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={start}
                disabled={!!error}
                className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {record ? "Edit figures" : "Add figures"}
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setNotice("");
                load();
              }}
              className="rounded-lg px-3 py-2 text-sm text-brand-600 dark:text-brand-200"
            >
              Reload figures
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-3 text-sm text-green-700 dark:text-green-300"
        >
          {notice}
        </p>
      )}
      {record?.source && (
        <p className="mt-3 text-xs text-gray-700 dark:text-gray-300">
          Imported from {record.source.file}, {record.source.sheet}. Figures can
          be edited here.
        </p>
      )}
    </div>
  );
}
