import useDatabaseRecords, { saveDatabaseRecord } from "./useDatabaseRecords";
export default function useShifts() {
  const state = useDatabaseRecords("/api/timetables", "timetables");
  async function saveWeek(employeeId, week, rows) {
    if (state.loading || state.error) return state.error || "Timetables are still loading.";
    const current = state.records.find(record => record.employeeId === employeeId && record.week === week);
    try {
      await saveDatabaseRecord("/api/timetables", { employeeId, week, rows, revision: current?.revision || 0 }, "PUT");
      await state.refresh();
      return "";
    } catch (error) { await state.refresh(); return error.message; }
  }
  return { ...state, records: state.records.flatMap(record => record.rows), saveWeek };
}
