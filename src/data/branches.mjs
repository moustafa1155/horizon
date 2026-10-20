export const BRANCH_STORAGE_KEY = "horizon.branches.v1";

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDate(date) === value;
}

export function validateBranch(draft, records, editingId = null) {
  if (!draft.name.trim()) return "Enter a branch name.";
  if (draft.name.trim().toLowerCase() === "all")
    return "Choose a branch name other than all.";
  if (draft.name.trim().length > 120)
    return "Branch names must be 120 characters or fewer.";
  if (!["permanent", "temporary"].includes(draft.type))
    return "Select a branch type.";
  if (
    records.some(
      (record) =>
        record.id !== editingId &&
        record.name.toLowerCase() === draft.name.trim().toLowerCase()
    )
  )
    return "This branch name already exists, including removed branches. Restore the existing branch instead.";
  if (
    draft.type === "temporary" &&
    (!validDate(draft.startDate) || !validDate(draft.endDate))
  )
    return "Enter valid start and end dates for the temporary branch.";
  if (
    (draft.startDate && !validDate(draft.startDate)) ||
    (draft.endDate && !validDate(draft.endDate))
  )
    return "Enter valid operating dates.";
  if (draft.startDate && draft.endDate && draft.endDate < draft.startDate)
    return "End date must be on or after the start date.";
  return "";
}

export function branchStatus(branch, today = localDate()) {
  if (branch.removed) return "Removed";
  if(!branch.type)return "Not configured";

  if (branch.startDate && today < branch.startDate) return "Upcoming";
  if (branch.endDate && today > branch.endDate) return "Ended";
  return "Active";
}

export function eligibleBranchNames(records, week) {
  if (!validDate(week)) return [];
  const end = new Date(`${week}T12:00:00`);
  end.setDate(end.getDate() + 6);
  const weekEnd = localDate(end);
  return records
    .filter(
      (record) =>
        !!record.type && !record.removed &&
        (!record.startDate || record.startDate <= weekEnd) &&
        (!record.endDate || record.endDate >= week)
    )
    .map((record) => record.name);
}

export function loadBranches(storage) {
  const records = JSON.parse(storage.getItem(BRANCH_STORAGE_KEY) || "[]");
  if (!Array.isArray(records)) throw new Error("Invalid branches");
  const ids = new Set();
  const names = new Set();
  for (const record of records) {
    if (
      !record ||
      typeof record.id !== "string" ||
      !record.id ||
      typeof record.name !== "string" ||
      !record.name.trim() ||
      !["", "permanent", "temporary"].includes(record.type) ||
      typeof record.removed !== "boolean" ||
      (record.startDate && !validDate(record.startDate)) ||
      (record.endDate && !validDate(record.endDate)) ||
      (record.startDate &&
        record.endDate &&
        record.endDate < record.startDate) ||
      ids.has(record.id) ||
      names.has(record.name.toLowerCase()) ||
      (record.type === "temporary" &&
        (!validDate(record.startDate) ||
          !validDate(record.endDate) ||
          record.endDate < record.startDate))
    )
      throw new Error("Invalid branch record");
    ids.add(record.id);
    names.add(record.name.toLowerCase());
  }
  return records;
}
