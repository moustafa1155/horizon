import { useEffect, useState } from "react";
import { BRANCH_STORAGE_KEY, loadBranches } from "../data/branches.mjs";

function readBranches() {
  try {
    return { records: loadBranches(window.localStorage), branchError: "" };
  } catch {
    return {
      records: [],
      branchError:
        "Branches could not be loaded from browser storage. Existing records have not been overwritten.",
    };
  }
}

export default function useBranches() {
  const [state, setState] = useState(readBranches);
  useEffect(() => {
    const refresh = () => setState(readBranches());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("horizon:branches-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("horizon:branches-updated", refresh);
    };
  }, []);
  function saveBranches(records) {
    if (state.branchError) return state.branchError;
    try {
      // Validate before writing; rejected data never replaces the stored list.
      const serialized = JSON.stringify(records);
      loadBranches({ getItem: () => serialized });
      window.localStorage.setItem(BRANCH_STORAGE_KEY, serialized);
    } catch {
      return "Branches could not be saved. Check browser storage and try again.";
    }
    setState({ records, branchError: "" });
    window.dispatchEvent(new Event("horizon:branches-updated"));
    return "";
  }
  return { ...state, saveBranches };
}
