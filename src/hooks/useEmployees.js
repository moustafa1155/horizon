import { useEffect, useState, useCallback } from "react";
const adapt = (e) => ({
  ...e,
  name: e.fullName,
  phone: e.phoneNumber,
  branch: e.branch || "",
  branchId: e.branchId || "",
  role: "Employee",
  title: "",
  employment: "Not specified",
  joined: "",
  schedule: [],
});
export default function useEmployees() {
  const [state, setState] = useState({ records: [], error: "", loading: true });
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/employees", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState({
        records: data.employees.map(adapt),
        error: "",
        loading: false,
      });
    } catch (error) {
      setState((s) => ({
        ...s,
        error: error.message || "Employees could not be loaded.",
        loading: false,
      }));
    }
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("horizon:employees-updated", refresh);
    return () =>
      window.removeEventListener("horizon:employees-updated", refresh);
  }, [refresh]);
  async function save(draft, id = null) {
    try {
      const response = await fetch("/api/employees", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, ...(id ? { id } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) return data.error;
      await refresh();
      window.dispatchEvent(new Event("horizon:employees-updated"));
      return "";
    } catch {
      return "The employee could not be saved. Please try again.";
    }
  }
  return { ...state, save, refresh };
}
