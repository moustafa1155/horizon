import { hostedPreview } from "lib/previewMode";
import useBranches from "../../../hooks/useBranches";
import { useEffect, useRef, useState } from "react";
export default function EmployeeForm({
  onSave,
  onCancel,
  readOnly,
  employee,
  allowAssignment = false,
  allowLogin = false,
  assignedBranchName = "",
}) {
  const { records: branches } = useBranches();
  const dialog = useRef(null);
  const [draft, setDraft] = useState({
    branchId: employee?.branchId || "",
    fullName: employee?.fullName || "",
    phoneNumber: employee?.phoneNumber || "",
    nationalInsuranceNumber: employee?.nationalInsuranceNumber || "",
    email: employee?.email || "",
  });
  const [createAccount, setCreateAccount] = useState(false);
  const [username, setUsername] = useState(employee?.username || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [accountNotice, setAccountNotice] = useState("");
  useEffect(() => {
    dialog.current.showModal();
    return () => dialog.current?.close();
  }, []);
  async function submit(e) {
    e.preventDefault();
    if (readOnly || pending) return;
    setPending(true);
    setError("");
    try {
      const payload = { ...draft, ...(!employee && createAccount ? { account: { username, password } } : {}) };
      if (!allowAssignment) delete payload.branchId;
      const result = await onSave(payload);
      if (result) setError(result);
    } catch {
      setError("Unable to save employee. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onCancel();
      }}
      aria-labelledby="employee-dialog-title"
      className="backdrop:bg-black/40 m-auto w-[calc(100%-2rem)] max-w-2xl rounded-3xl bg-white p-6 text-navy-700 shadow-xl dark:bg-navy-800 dark:text-white"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="employee-dialog-title" className="text-xl font-bold">
          {employee ? "Edit staff details" : "Add employee"}
        </h2>
        <button
          type="button"
          aria-label="Close employee form"
          disabled={pending}
          onClick={onCancel}
          className="rounded-lg px-3 py-2"
        >
          ✕
        </button>
      </div>
      <p className="my-4 text-sm">
        {hostedPreview
          ? "Enter preview employee details. They are saved only in this browser."
          : "Enter employee details to save them to the database."}
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={pending}>
          <table className="w-full text-sm">
            <caption className="sr-only">Employee details</caption>
            <tbody>
              {[
                ["fullName", "Full name", "text", 150],
                ["phoneNumber", "Phone number", "tel", 40],
                [
                  "nationalInsuranceNumber",
                  "National Insurance number",
                  "text",
                  20,
                ],
                ["email", "Email", "email", 254],
              ].map(([key, label, type, max]) => (
                <tr
                  key={key}
                  className="border-b border-gray-200 dark:border-white/10"
                >
                  <th className="w-2/5 py-4 pr-3 text-left font-medium">
                    <label htmlFor={"employee-" + key}>{label}</label>
                  </th>
                  <td className="py-3">
                    <input
                      id={"employee-" + key}
                      required
                      type={type}
                      maxLength={max}
                      value={draft[key]}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [key]: e.target.value }))
                      }
                      className="w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 dark:border-white/10 dark:bg-navy-900"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!allowAssignment && assignedBranchName && <p className="mt-4 text-sm">Assigned branch: <strong>{assignedBranchName}</strong></p>}
          {allowAssignment && (
            <label className="mt-4 block text-sm">
              Assigned branch
              <select
                value={draft.branchId}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, branchId: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 dark:bg-navy-900"
              >
                <option value="">Not assigned</option>
                {branches
                  .filter((b) => !b.removed)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {employee?.username && (
            <div className="mt-5 space-y-3 rounded-xl border border-gray-200 p-4">
              <label className="block text-sm">Username
                <input value={username} onChange={event => setUsername(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 dark:bg-navy-900" />
              </label>
              <label className="block text-sm">New password
                <input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 dark:bg-navy-900" />
              </label>
              <p className="text-xs">Leave the password empty to keep it. New passwords need 12–128 characters.</p>
              <button type="button" disabled={readOnly || pending} className="rounded-lg bg-brand-500 px-4 py-2 text-white" onClick={async () => {
                setPending(true); setError(""); setAccountNotice("");
                try {
                  const response = await fetch("/api/employees", {
                    method: "PATCH", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: employee.id, username, password }),
                  });
                  const data = await response.json();
                  if (!response.ok) throw Error(data.error);
                  setPassword(""); setAccountNotice("Login details updated.");
                  window.dispatchEvent(new Event("horizon:employees-updated"));
                } catch (error) { setError(error.message || "Login details could not be updated."); }
                finally { setPending(false); }
              }}>Save login details</button>
              {accountNotice && <p role="status" className="text-sm">{accountNotice}</p>}
            </div>
          )}
          {!employee && allowLogin && (
            <div className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-white/10">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} />
                Create a login account
              </label>
              {createAccount && (
                <div className="mt-4 space-y-4">
                  <p className="text-sm">This account can access stock checking only. {allowAssignment ? "Select an assigned branch above." : "It will be assigned to your branch."}</p>
                  <label className="block text-sm">Username
                    <input required autoComplete="off" minLength={3} maxLength={32} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 dark:bg-navy-900" />
                  </label>
                  <label className="block text-sm">Password
                    <input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 dark:bg-navy-900" />
                  </label>
                  <p className="text-xs">Use 12–128 characters for the password. Share these login details with the employee.</p>
                </div>
              )}
            </div>
          )}
          {readOnly && (
            <p className="mt-4 text-sm">
              Preview is read-only. Sign in as an admin to save employees.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 text-red-600">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-5 py-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={readOnly || pending}
              className="rounded-xl bg-brand-500 px-5 py-3 font-bold text-white disabled:opacity-50"
            >
              {pending
                ? "Saving…"
                : employee
                ? "Save changes"
                : "Save employee"}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
