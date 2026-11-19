import { useEffect, useState } from "react";
import Card from "components/card";
import WeekSelector from "components/weekSelector";
import { currentWeek } from "../weeklyOrders/orderHelpers.mjs";
import { stockCheckBranchNames } from "../weeklyStockChecks/stockCheckHelpers.mjs";
import { prepareDailySales } from "../../../data/dailySales.mjs";
import { saveDatabaseRecord } from "../../../hooks/useDatabaseRecords";
import DailySalesTable, { dailyRows } from "./DailySalesTable";
const field = "rounded-xl border border-gray-200 bg-lightPrimary px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900";
export default function SalesReportForm({ branchRecords, onSave, onCancel, initialReport }) {
  const [branchId, setBranchId] = useState(() => initialReport?.branchId || branchRecords.find(branch => branch.name === initialReport?.branch)?.id || "");
  const [week, setWeek] = useState(initialReport?.week || currentWeek());
  const [rows, setRows] = useState(() => dailyRows());
  const [notes, setNotes] = useState("");
  const [report, setReport] = useState(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const branches = branchRecords.filter(branch => stockCheckBranchNames([branch], week).length);
  const selectionKey = branchId + "|" + week;
  useEffect(() => {
    if (branchRecords.length === 1 && !branchId) setBranchId(branchRecords[0].id);
  }, [branchRecords, branchId]);
  useEffect(() => {
    if (!branchId) return;
    let active = true;
    setLoading(true); setLoadError(""); setError(""); setNotice("");
    fetch("/api/sales-reports?" + new URLSearchParams({ branchId, week }), { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Report could not be loaded.");
      if (!active) return;
      setReport(data.report); setRows(dailyRows(data.report)); setNotes(data.report?.notes || "");
      setRevision(data.report?.revision || 0); setDirty(false); setLoadedKey(selectionKey);
    }).catch(error => { if (active) setLoadError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchId, week, reload]);
  function changeSelection(setter, value) {
    if (dirty && !window.confirm("Discard unsaved daily sales changes?")) return;
    setter(value); setDirty(false);
  }
  async function submit(event) {
    event.preventDefault();
    if (pending || loading || loadError || loadedKey !== selectionKey) return;
    try { prepareDailySales(rows); } catch (error) { setError(error.message); return; }
    setPending(true); setError(""); setNotice("");
    try {
      const data = await saveDatabaseRecord("/api/sales-reports", { branchId, week, daily: rows, notes, revision }, "PUT");
      setRows(dailyRows(data.report)); setRevision(data.report.revision); setReport(data.report); setDirty(false);
      setNotice("Daily sales saved. You can edit the table and save again.");
      await onSave(data.report);
    } catch (error) { setError(error.message); }
    finally { setPending(false); }
  }
  return <Card extra="p-6">
    <h2 className="text-xl font-bold">Daily sales report</h2>
    <p className="mt-2 text-sm">Enter card sales, cash sales and costs for each day. Blank days stay empty. Sales totals are card plus cash; costs are totalled separately.</p>
    <form onSubmit={submit} className="mt-5 space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">Branch<select required value={branchId} onChange={event => changeSelection(setBranchId, event.target.value)} className={field}><option value="">Select branch</option>{branchRecords.filter(branch => !branch.removed).map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <WeekSelector value={week} onChange={value => changeSelection(setWeek, value)} className={field} labelPrefix="Daily sales" />
        </div>
        {loading && <p role="status">Loading saved sales…</p>}
        {loadError && <p role="alert" className="text-red-600">{loadError}</p>}
        {branchId && !branches.some(branch => branch.id === branchId) && <p className="text-sm text-orange-700">This branch was not operating during the selected week.</p>}
        {report && !report.daily && <p className="text-sm text-orange-700">This report contains weekly totals only. Enter the daily figures to replace those totals; the weekly amount has not been split across days.</p>}
        <fieldset disabled={loading || !!loadError || !branchId || loadedKey !== selectionKey} className="space-y-4">
          <DailySalesTable rows={rows} onChange={(index, key, value) => { setRows(current => current.map((row, day) => day === index ? { ...row, [key]: value } : row)); setDirty(true); setNotice(""); }} />
          <label className="block text-sm">Notes (optional)<textarea value={notes} maxLength={2000} rows={2} onChange={event => { setNotes(event.target.value); setDirty(true); }} className={field + " mt-2 w-full"} /></label>
        </fieldset>
        {notice && <p role="status" className="text-sm text-brand-600 dark:text-brand-200">{notice}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => { if (!dirty || window.confirm("Discard unsaved daily sales changes?")) onCancel(); }} className="rounded-xl px-4 py-3">Close</button>
          <button type="button" onClick={() => { if (!dirty || window.confirm("Discard unsaved changes and reload the saved report?")) setReload(value => value + 1); }} disabled={!branchId || loading} className="rounded-xl border border-gray-200 px-4 py-3">Reload saved report</button>
          <button type="submit" disabled={!dirty || loading || !!loadError || !branches.some(branch => branch.id === branchId) || loadedKey !== selectionKey} className="rounded-xl bg-brand-500 px-5 py-3 font-bold text-white disabled:opacity-50">{pending ? "Saving…" : "Save sales report"}</button>
        </div>
      </fieldset>
    </form>
  </Card>;
}
