import { hostedPreview } from "lib/previewMode";
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
      if (hostedPreview) {
        const employees = JSON.parse(
          localStorage.getItem("horizon.preview-employees.v1") || "[]"
        );
        if (!Array.isArray(employees))
          throw new Error("Preview employee records could not be loaded.");
        setState({ records: employees.map(adapt), error: "", loading: false });
        return;
      }
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
      if (hostedPreview) {
        const employees = JSON.parse(
          localStorage.getItem("horizon.preview-employees.v1") || "[]"
        );
        if (!Array.isArray(employees))
          return "Preview employees could not be loaded.";
        if (
          employees.some(
            (e) =>
              e.id !== id &&
              (e.email.toLowerCase() === draft.email.trim().toLowerCase() ||
                e.nationalInsuranceNumber.replace(/\s/g, "").toUpperCase() ===
                  draft.nationalInsuranceNumber
                    .replace(/\s/g, "")
                    .toUpperCase())
          )
        )
          return "This employee email or National Insurance number already exists.";
        if (id && !employees.some((e) => e.id === id))
          return "Employee no longer exists.";
        const record = {
          ...draft,
          id: id || crypto.randomUUID(),
          email: draft.email.trim().toLowerCase(),
        };
        localStorage.setItem(
          "horizon.preview-employees.v1",
          JSON.stringify(
            id
              ? employees.map((e) => (e.id === id ? { ...e, ...record } : e))
              : [...employees, record]
          )
        );
        await refresh();
        window.dispatchEvent(new Event("horizon:employees-updated"));
        return "";
      }
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
