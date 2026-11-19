import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
export default function useDatabaseRecords(url, key, enabled = true) {
  const { user } = useAuth();
  const scope = [user?.id, user?.role, user?.branchId, enabled].join("|");
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const sequence = useRef(0);
  const [state, setState] = useState({ records: [], error: "", loading: true, scope });
  const refresh = useCallback(async () => {
    const ticket = ++sequence.current;
    const apply = value => { if (scopeRef.current === scope && ticket === sequence.current) setState({ ...value, scope }); };
    if (!enabled || !user?.id) { apply({ records: [], error: "", loading: false }); return; }
    try {
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Records could not be loaded.");
      apply({ records: data[key], error: "", loading: false });
    } catch (error) { apply({ records: [], error: error.message, loading: false }); }
  }, [url, key, enabled, scope]);
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("horizon:database-updated", refresh);
    return () => { sequence.current++; window.removeEventListener("focus", refresh); window.removeEventListener("horizon:database-updated", refresh); };
  }, [refresh]);
  return { ...(state.scope === scope ? state : { records: [], error: "", loading: true }), refresh };
}
export async function saveDatabaseRecord(url, body, method = "POST") {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Changes could not be saved.");
  window.dispatchEvent(new Event("horizon:database-updated"));
  return data;
}
