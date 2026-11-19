import { useEffect, useRef, useState } from "react";
import Card from "components/card";
import { FINANCIAL_FIELDS, FINANCIAL_DAYS, emptyFinancialDays, amountToCents, amountInputValue, prepareFinancialDays } from "../../../data/financialSummary.mjs";
import { formatMoney } from "../weeklySalesReports/salesHelpers.mjs";
const field = "w-full rounded-lg border border-gray-200 bg-lightPrimary px-2 py-2 text-sm dark:border-white/10 dark:bg-navy-900";
const display = value => value === null || value === undefined ? "" : formatMoney(value);
const workbookType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
function latestClosedWeek() {
  const today = new Date(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()) + "T12:00:00Z");
  today.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7) - 7);
  return today.toISOString().slice(0, 10);
}

async function saveWorkbook(branchId, week, automatic, signal, open = false) {
  const response = await fetch("/api/financial-summaries?" + new URLSearchParams({ branchId, week, format: "xlsx" }), { cache: "no-store", signal });
  if (automatic && response.status === 404) return;
  const { filename, base64, error } = await response.json();
  if (!response.ok) throw Error(error || "Could not prepare the Excel sheet.");
  if (typeof window.ReactNativeWebView?.postMessage === "function") {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "financial-workbook", filename, base64, open, automatic }));
    return;
  }
  const key = "horizon:export:" + filename;
  if (automatic && localStorage.getItem(key)) return;
  const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: workbookType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  localStorage.setItem(key, "1");
}

export default function FinancialSummary({ branches, branchName, week }) {
  const preferred = branches.find(branch => branch.name === branchName)?.id || (branches.length === 1 ? branches[0].id : "");
  const [choice, setChoice] = useState("");
  const branchId = preferred || choice;
  const [closedWeek, setClosedWeek] = useState(latestClosedWeek);
  const [archiveError, setArchiveError] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setClosedWeek(latestClosedWeek()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!branchId || week === closedWeek) return;
    const controller = new AbortController();
    saveWorkbook(branchId, closedWeek, true, controller.signal).catch(error => {
      if (error.name !== "AbortError") setArchiveError("Could not archive last week. Select that week to save its Excel sheet.");
    });
    return () => controller.abort();
  }, [branchId, closedWeek, week]);
  return <Card extra="w-full min-w-0 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-base font-bold">Weekly financial summary</h2><p className="mt-1 text-xs text-gray-700 dark:text-gray-300">Daily figures in GBP. Blank cells stay empty. Weekly totals add the entered days.</p></div>
      <label className="text-sm font-medium">Branch<select aria-label="Financial summary branch" value={branchId} onChange={event => setChoice(event.target.value)} disabled={!!preferred} className={field + " mt-1"}><option value="">Select a branch</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
    </div>
    {archiveError && <p role="alert" className="mt-3 text-sm text-red-600">{archiveError}</p>}
    {branchId ? <SummaryEditor key={branchId + "|" + week} branchId={branchId} week={week} /> : <p className="mt-5 text-sm">Choose a branch to view or add its financial figures.</p>}
  </Card>;
}
function SummaryEditor({ branchId, week }) {
  const [record, setRecord] = useState(null);
  const [draft, setDraft] = useState([]);
  const preview = useRef(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load(signal) {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/financial-summaries?" + new URLSearchParams({ branchId, week }), { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setRecord(data.summary); setEditing(false);
    } catch (error) { if (error.name !== "AbortError") setError(error.message || "Financial summary could not be loaded."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [branchId, week]);
  useEffect(() => {
    if (loading || !record || week > latestClosedWeek()) return;
    const controller = new AbortController();
    saveWorkbook(branchId, week, true, controller.signal).catch(error => {
      if (error.name !== "AbortError") setNotice("Automatic Excel export failed. Use the Excel button to retry.");
    });
    return () => controller.abort();
  }, [branchId, week, loading, record]);

  async function exportWorkbook(open = false) {
    if (open && typeof window.ReactNativeWebView?.postMessage !== "function") {
      preview.current?.showModal();
      return;
    }
    try { await saveWorkbook(branchId, week, false, undefined, open); }
    catch (error) { setNotice(error.message || "Could not save the Excel sheet."); }
  }
  function start() {
    setDraft((record?.daily || emptyFinancialDays()).map(row => ({ day: row.day, ...Object.fromEntries(FINANCIAL_FIELDS.map(([key]) => [key, amountInputValue(row[key])])) })));
    setNotice(""); setError(""); setEditing(true);
  }
  function parseDraft() {
    return prepareFinancialDays(draft.map(row => ({ day: row.day, ...Object.fromEntries(FINANCIAL_FIELDS.map(([key]) => [key, amountToCents(row[key] ?? "", key === "profitLossCents")])) })));
  }
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    let prepared;
    try { prepared = parseDraft(); } catch (error) { setError(error.message); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/financial-summaries", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId, week, revision: record?.revision || 0, daily: prepared.daily }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setRecord(data.summary); setEditing(false); setNotice("Daily financial figures saved.");
      window.dispatchEvent(new Event("horizon:database-updated"));
    } catch (error) { setError(error.message || "Financial summary could not be saved."); }
    finally { setSaving(false); }
  }
  const rows = editing ? draft : record?.daily || emptyFinancialDays();
  let totals = record;
  if (editing) { try { totals = parseDraft().values; } catch { totals = null; } }
  const legacyWeekly = !record?.daily && record && FINANCIAL_FIELDS.some(([key]) => record[key] != null);
  return <div className="mt-3">
    <p className="mb-3 text-xs">Week beginning {new Date(week + "T12:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC" })}</p>
    {legacyWeekly && <p className="mb-3 text-xs text-gray-700 dark:text-gray-300">Existing figures are weekly totals without a daily breakdown. {editing ? "Saving daily figures will replace those totals; previous figures are shown below." : "Daily cells are empty until a breakdown is entered."}</p>}
    {loading ? <p role="status">Loading financial summary…</p> : <form onSubmit={save}>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
        <table className="portal-stacked-table w-full min-w-[850px] border-collapse text-sm">
          <caption className="sr-only">Daily financial summary for the selected branch and week</caption>
          <thead className="bg-lightPrimary dark:bg-navy-900"><tr><th scope="col" className="px-3 py-3 text-left">Day</th>{FINANCIAL_FIELDS.map(([key,label]) => <th key={key} scope="col" className="px-3 py-3 text-right">{label} (£)</th>)}</tr></thead>
          <tbody>{rows.map((row, day) => {
            const date = new Date(week + "T12:00:00Z"); date.setUTCDate(date.getUTCDate() + day);
            return <tr key={day} className="border-t border-gray-200 dark:border-white/10"><th scope="row" className="px-3 py-2 text-left font-medium">{FINANCIAL_DAYS[day]}<span className="mt-1 block whitespace-nowrap text-xs font-normal text-gray-700 dark:text-gray-300">{date.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" })}</span></th>
              {FINANCIAL_FIELDS.map(([key,label]) => <td key={key} data-label={label + " (£)"} className="px-2 py-2 text-right">{editing ? <input aria-label={FINANCIAL_DAYS[day] + " " + label + " (GBP)"} type="number" step="0.01" min={key === "profitLossCents" ? undefined : "0"} max="1000000000" disabled={saving} value={row[key] ?? ""} onChange={event => setDraft(current => current.map((entry,index) => index === day ? { ...entry, [key]: event.target.value } : entry))} className={field + " min-w-[95px] text-right"} /> : display(row[key])}</td>)}
            </tr>;
          })}</tbody>
          <tfoot className="border-t border-gray-200 bg-lightPrimary font-bold dark:border-white/10 dark:bg-navy-900"><tr><th scope="row" className="px-3 py-3 text-left">{legacyWeekly && !editing ? "Existing week total" : "Week total"}</th>{FINANCIAL_FIELDS.map(([key, label]) => <td key={key} data-label={label + " (£)"} className="px-3 py-3 text-right">{display(totals?.[key])}</td>)}</tr>
            {legacyWeekly && editing && <tr><th scope="row" className="px-3 py-3 text-left font-medium">Previous week total</th>{FINANCIAL_FIELDS.map(([key, label]) => <td key={key} data-label={label + " (£)"} className="px-3 py-3 text-right font-normal">{display(record[key])}</td>)}</tr>}
          </tfoot>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{editing ? <><button type="submit" disabled={saving} className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save figures"}</button><button type="button" disabled={saving} onClick={() => { setEditing(false); setError(""); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/20">Cancel</button></> : <button type="button" disabled={!!error} onClick={start} className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{record ? "Edit figures" : "Add figures"}</button>}
        {record && !editing && <button type="button" onClick={() => exportWorkbook()} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/20">Save Excel sheet</button>}
        {record && !editing && <button type="button" onClick={() => exportWorkbook(true)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/20">Open Excel sheet</button>}
        <button type="button" disabled={saving} onClick={() => { if (editing && !window.confirm("Discard unsaved figures and reload?")) return; setNotice(""); load(); }} className="rounded-lg px-3 py-2 text-sm text-brand-600 dark:text-brand-200">Reload figures</button>
      </div>
    </form>}
    <dialog ref={preview} className="max-h-[85vh] w-[min(95vw,64rem)] overflow-auto rounded-xl bg-white p-5 text-navy-700 backdrop:bg-black/40 dark:bg-navy-800 dark:text-white" aria-labelledby="excel-preview-title">
      <form method="dialog" className="flex items-center justify-between gap-3">
        <h3 id="excel-preview-title" className="font-bold">Excel sheet preview</h3>
        <button className="rounded-lg border border-gray-200 px-3 py-2 text-sm">Close</button>
      </form>
      <p className="mt-2 text-sm">{record?.branchName} · Week beginning {week}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr><th scope="col" className="p-2 text-left">Day</th>{FINANCIAL_FIELDS.map(([key, label]) => <th key={key} scope="col" className="p-2 text-right">{label} (£)</th>)}</tr></thead>
          <tbody>{FINANCIAL_DAYS.map((day, index) => <tr key={day} className="border-t border-gray-200"><th scope="row" className="p-2 text-left">{day}</th>{FINANCIAL_FIELDS.map(([key]) => <td key={key} className="p-2 text-right">{display(record?.daily?.[index]?.[key])}</td>)}</tr>)}</tbody>
          <tfoot><tr className="border-t border-gray-200 font-bold"><th scope="row" className="p-2 text-left">Week total</th>{FINANCIAL_FIELDS.map(([key]) => <td key={key} className="p-2 text-right">{display(record?.[key])}</td>)}</tr></tfoot>
        </table>
      </div>
    </dialog>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-300">{notice}</p>}
    {record?.source && <p className="mt-3 text-xs text-gray-700 dark:text-gray-300">Imported from {record.source.file}, {record.source.sheet}. Figures can be edited here.</p>}
  </div>;
}
