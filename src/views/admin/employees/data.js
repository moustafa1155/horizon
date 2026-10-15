export const EMPLOYEE_STORAGE_KEY = "horizon.employees.v1";
export function loadEmployees(storage) {
  const records = JSON.parse(storage.getItem(EMPLOYEE_STORAGE_KEY) || "[]");
  if (
    !Array.isArray(records) ||
    records.some(
      (e) =>
        !e ||
        ![
          e.id,
          e.name,
          e.email,
          e.branch,
          e.role,
          e.title,
          e.phone,
          e.employment,
          e.joined,
        ].every((v) => typeof v === "string") ||
        !e.id ||
        !e.name.trim() ||
        !e.branch.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email) ||
        !["Employee","Branch manager"].includes(e.role) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(e.joined) ||
        !Array.isArray(e.schedule)
    )
  )
    throw new Error("Invalid employee records");
  if(new Set(records.map(e=>e.id)).size!==records.length || new Set(records.map(e=>e.email.toLowerCase())).size!==records.length) throw new Error("Duplicate employee records");
  return records;
}
