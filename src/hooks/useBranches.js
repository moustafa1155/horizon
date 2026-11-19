import useDatabaseRecords, { saveDatabaseRecord } from "./useDatabaseRecords";
export default function useBranches() {
  const state = useDatabaseRecords("/api/branches", "branches");
  async function saveBranches(next) {
    if (state.error || state.loading) return state.error || "Branches are still loading.";
    const changed = next.filter(record => {
      const current = state.records.find(row => row.id === record.id);
      return !current || ["name","type","startDate","endDate","removed"].some(key => current[key] !== record[key]);
    });
    if (changed.length !== 1) return "Change one branch at a time, then save.";
    const record = changed[0];
    const current = state.records.find(row => row.id === record.id);
    try {
      await saveDatabaseRecord("/api/branches", { ...record, revision: current?.revision || 0 }, current ? "PUT" : "POST");
      await state.refresh();
      return "";
    } catch (error) { await state.refresh(); return error.message; }
  }
  return { records: state.records, branchError: state.error, loading: state.loading, saveBranches };
}
