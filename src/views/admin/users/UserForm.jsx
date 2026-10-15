import useBranches from "../../../hooks/useBranches";
import { useState } from "react";
import Card from "components/card";
import { PAGES, ROLES, rolePermissions } from "../../../data/userHelpers.mjs";
const field =
  "mt-2 w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 text-sm text-navy-700 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-navy-900 dark:text-white";

export default function UserForm({
  account,
  currentId,
  onSave,
  onCancel,
  readOnly = false,
}) {
  const {records:branchRecords}=useBranches();
  const [draft, setDraft] = useState({
    name: account?.name || "",
    username: account?.username || "",
    password: "",
    branchId: account?.branchId || "",
    role: account?.role || "Employee",
    permissions: account?.role === "Employee" ? rolePermissions("Employee") : account?.permissions || rolePermissions("Employee"),
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const update = (key) => (event) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));
  function grant(page, action, checked) {
    setDraft((current) => {
      const old = current.permissions[page];
      return {
        ...current,
        permissions: {
          ...current.permissions,
          [page]:
            action === "view"
              ? { view: checked, manage: checked && old.manage }
              : { view: checked || old.view, manage: checked },
        },
      };
    });
  }
  async function submit(event) {
    event.preventDefault();
    if (readOnly) return;
    setPending(true);
    try {
      setError(await onSave(draft, account?.id));
    } finally {
      setPending(false);
    }
  }
  return (
    <Card extra="p-6">
      <h2 className="text-xl font-bold">
        {account ? "Edit user and permissions" : "Add user"}
      </h2>
      <form onSubmit={submit} className="mt-5 space-y-5">
        <fieldset disabled={pending} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="user-name" className="text-sm font-medium">
                Full name
              </label>
              <input
                id="user-name"
                required
                maxLength={120}
                value={draft.name}
                onChange={update("name")}
                className={field}
              />
            </div>
            <div>
              <label htmlFor="user-username" className="text-sm font-medium">
                Username
              </label>
              <input
                id="user-username"
                type="text"
                autoComplete="off"
                required
                maxLength={32}
                minLength={3}
                pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}"
                title="3–32 letters, numbers, dots, underscores or hyphens"
                value={draft.username}
                onChange={update("username")}
                className={field}
              />
            </div>
            <div>
              <label htmlFor="user-role" className="text-sm font-medium">
                Role
              </label>
              <select
                id="user-role"
                value={draft.role}
                disabled={account?.id === currentId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    role: event.target.value,
                    permissions: rolePermissions(event.target.value),
                  }))
                }
                className={field}
              >
                {ROLES.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="user-password" className="text-sm font-medium">
                {account ? "New password (optional)" : "Password"}
              </label>
              <input
                id="user-password"
                type="password"
                autoComplete="new-password"
                required={!account}
                minLength={12}
                maxLength={128}
                value={draft.password}
                onChange={update("password")}
                className={field}
              />
              <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                12–128 characters.
                {account && " Leave blank to keep the existing password."}
              </p>
            </div>
          </div>
          {draft.role==='Branch Manager'&&<label className="block text-sm font-medium">Designated branch<select className={field} value={draft.branchId} onChange={update('branchId')}><option value="">Not assigned</option>{branchRecords.filter(b=>!b.removed).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><span className="mt-2 block text-xs">Only staff assigned to this branch appear in the manager's timetable.</span></label>}
          <div>
            <h3 className="font-bold">Page permissions</h3>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
              View opens the page. Manage allows adding or updating records.
              Admins have full access; only admins can manage users. Employees can only view and submit weekly stock checks.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10">
                    <th scope="col" className="py-3 text-start">
                      Page
                    </th>
                    <th scope="col">View</th>
                    <th scope="col">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {PAGES.map((page) => (
                    <tr
                      key={page.key}
                      className="border-b border-gray-100 dark:border-white/10"
                    >
                      <th scope="row" className="py-3 text-start font-medium">
                        {page.label}
                      </th>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          aria-label={`View ${page.label}`}
                          checked={draft.permissions[page.key].view}
                          disabled={
                            draft.role === "Admin" || draft.role === "Employee" || page.key === "users"
                          }
                          onChange={(event) =>
                            grant(page.key, "view", event.target.checked)
                          }
                        />
                      </td>
                      <td className="text-center">
                        {page.editable ? (
                          <input
                            type="checkbox"
                            aria-label={`Manage ${page.label}`}
                            checked={draft.permissions[page.key].manage}
                            disabled={
                              draft.role === "Admin" || draft.role === "Employee" || page.key === "users"
                            }
                            onChange={(event) =>
                              grant(page.key, "manage", event.target.checked)
                            }
                          />
                        ) : (
                          <span className="text-gray-700 dark:text-gray-300">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl bg-lightPrimary px-5 py-3 text-sm dark:bg-navy-700"
            >
              Cancel
            </button>
            <button
              disabled={readOnly}
              type="submit"
              className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white"
            >
              {pending ? "Saving…" : "Save user"}
            </button>
          </div>
        </fieldset>
      </form>
    </Card>
  );
}
